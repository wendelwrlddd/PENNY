
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import admin from 'firebase-admin';
import { extractFinancialData } from './lib/openai.js';
import { db } from './lib/firebase.js';
import { sendMessage, logoutInstance, deleteInstance } from './lib/evolution.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
// --- NEW: Raw Body Middleware for Webhook ---
// This allows us to see the original payload before Express parses it
app.use('/webhook', express.text({ type: 'application/json' }));

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check and root debug
app.get('/', (req, res) => {
  console.log('--- DEBUG: GET / received ---');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  res.status(200).send('Penny Finance API is OK');
});

app.head('/', (req, res) => {
  console.log('🚨 DEBUG: HEAD / recebido - Meta está acessando URL errada!');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Query:', JSON.stringify(req.query, null, 2));
  res.sendStatus(200);
});

app.post('/', (req, res) => {
  console.log('🚨 DEBUG: POST / recebido - Meta usando URL errada!');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// Facebook Webhook Verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === 'penny123') {
      console.log('✅ Webhook verified by Facebook!');
      res.status(200).send(challenge);
    } else {
      console.error('❌ Verification token mismatch.');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// 4. Disarm Endpoint (Security Kill Switch)
app.post('/api/sys/disarm', async (req, res) => {
  const { instance } = req.body;
  const apiKey = req.headers['x-api-key'];

  if (apiKey !== process.env.EVOLUTION_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!instance) {
    return res.status(400).json({ error: 'Instance name required' });
  }

  try {
    console.log(`🚨 [API PANIC] Disarm requested for instance: ${instance}`);
    await logoutInstance(instance);
    res.json({ success: true, message: `Instance ${instance} disconnected.` });
  } catch (error) {
    try {
        await deleteInstance(instance);
        res.json({ success: true, message: `Instance ${instance} deleted (logout failed).` });
    } catch (err) {
        res.status(500).json({ error: error.message });
    }
  }
});

// Helper function to process message in background
async function processMessageBackground(text, sender, instance, source) {
  try {
    console.log(`[Background] 💬 Processing from ${sender} (${source}): ${text}`);

    // 1. Detect Region
    const isBrazil = sender.startsWith('55');
    console.log(`[Background] 🤖 Region detected: ${isBrazil ? 'Brazil (PT-BR/R$)' : 'International (EN-GB/£)'}`);
    
    // --- KILL SWITCH: Disarm bot ---
    if (text.toUpperCase() === '#DESARMAR') {
      console.log(`🚨 [PANIC] Disarm command received from ${sender}. Logging out instance ${instance}...`);
      await sendMessage(instance, sender, isBrazil ? "⚠️ *COMANDO DE DESARME ATIVADO!* Desconectando este número agora para sua segurança..." : "⚠️ *DISARM COMMAND ACTIVATED!* Disconnecting this number now for your security...");
      
      try {
        await logoutInstance(instance);
        console.log(`✅ [PANIC] Instance ${instance} logged out successfully.`);
      } catch (err) {
        console.error(`❌ [PANIC] Failed to logout instance ${instance}:`, err.message);
        // Fallback: Delete instance if logout fails
        await deleteInstance(instance);
      }
      return;
    }

    // --- NEW: Fetch User Data early to provide context to OpenAI ---
    const userRef = db.collection('usuarios').doc(sender);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};

    let transactionData = null;
    let aiFailed = false;

    // --- STRATEGY: Regex Fallback for SYNC (Bulletproof) ---
    const syncRegex = /(atualize|ajuste|saldo|balance|tenho|resta|only|so|só).*?(\d+([.,]\d+)?)/i;
    const match = text.match(syncRegex);
    
    if (match && (text.toLowerCase().includes('saldo') || text.toLowerCase().includes('balance') || text.toLowerCase().includes('tenho') || text.toLowerCase().includes('atualize'))) {
      const amountStr = match[2].replace(',', '.');
      transactionData = {
        intent: 'SYNC',
        amount: parseFloat(amountStr)
      };
      console.log(`[Background] 🎯 Regex Matched SYNC: ${transactionData.amount}`);
    } else {
      try {
        // Pass userData as 3rd param for context
        transactionData = await extractFinancialData(text, isBrazil, userData);
      } catch (aiError) {
        console.error('[Background] ⚠️ OpenAI failed:', aiError.message);
        aiFailed = true;
      }
    }

    if (aiFailed || !transactionData) {
      if (source === 'whatsapp-evolution') {
        const doubtMsg = isBrazil 
          ? `🤔 *Fiquei em dúvida!* Não consegui entender muito bem essa mensagem. Se for seu salário ou dia de pagamento, pode repetir de uma forma mais clara?`
          : `🤔 *I'm in doubt!* I couldn't quite understand that message. If it was about your income or payday, could you please rephrase it?`;
        await sendMessage(instance, sender, doubtMsg);
      }
      return;
    }
    
    // 2. Handle based on Intent (userRef already defined above)
    // Update last interaction
    await userRef.set({ 
      lastInteraction: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // --- ONBOARDING LOGIC & PROFILE UPDATES ---
    if (transactionData.intent === 'PROFILE_UPDATE') {
      console.log(`[Background] 👤 Updating profile for ${sender}...`);
      
      const updates = {};
      if (transactionData.amount) updates.monthlyIncome = parseFloat(transactionData.amount);
      if (transactionData.payDay) updates.payDay = parseInt(transactionData.payDay);

      await userRef.set(updates, { merge: true });

      if (source === 'whatsapp-evolution') {
        // If we just got the income, ask for payday
        if (updates.monthlyIncome && !userData.payDay && !updates.payDay) {
          const paydayMsg = isBrazil
            ? `✅ *Renda salva!* Agora, por favor, me informe o *dia do mês* em que você costuma receber seu salário (ex: "dia 5", "todo dia 10").`
            : `✅ *Income saved!* Now, please let me know the *date* you typically receive your monthly income (e.g., "the 5th", "every 10th").`;
          await sendMessage(instance, sender, paydayMsg);
          return;
        }

        // If we just got the payday (or both), check if we need to sync previous spending
        if (updates.payDay || (userData.monthlyIncome && updates.payDay)) {
          const finalPayDay = updates.payDay || userData.payDay;
          const today = new Date().getDate();
          
          let syncNeeded = false;
          if (today > finalPayDay) syncNeeded = true; // Payday already passed this month
          if (today < finalPayDay && today > 1) syncNeeded = true; // Still early, but month started

          if (syncNeeded) {
            const syncMsg = isBrazil
              ? `✅ *Entendido!* Como o dia do seu pagamento (${finalPayDay}) já passou ou o mês já começou, qual é o seu *saldo atual*? Assim poderei atualizar seu dashboard e controlar tanto seus gastos quanto seu saldo daqui para frente. 📈`
              : `✅ *Got it!* Since your payday (${finalPayDay}) has passed or the month has already started, what is your *current balance*? This will allow me to update your dashboard and help you track both your spending and balance moving forward. 📈`;
            await sendMessage(instance, sender, syncMsg);
          } else {
            const doneMsg = isBrazil
              ? `✅ *Tudo pronto!* Seu perfil foi configurado com sucesso. Agora, basta me enviar seus gastos diários para mantermos tudo sob controle! 🚀`
              : `✅ *All set!* Your profile has been successfully configured. Now, simply send me your daily expenses, and I'll keep everything on track for you! 🚀`;
            await sendMessage(instance, sender, doneMsg);
          }
          return;
        }

        // Generic update
        const reply = isBrazil 
          ? `✅ *Perfil atualizado!* Informações salvas com sucesso. 😉`
          : `✅ *Profile updated!* Information saved successfully. 😉`;
        await sendMessage(instance, sender, reply);
      }
      return;
    }

    if (transactionData.intent === 'SYNC') {
      console.log(`[Background] 🔄 Syncing balance for ${sender}...`);
      const reportedBalance = parseFloat(transactionData.amount);
      const { totalIncome, currentBalance: oldBalance } = await calculateUserTotals(userRef, isBrazil);
      
      let initialSpending = 0;
      let isInitialSync = false;

      if (totalIncome === 0 && (userData.monthlyIncome || 0) > 0) {
        isInitialSync = true;
        console.log(`[Background] 💰 Adding monthly income (R$${userData.monthlyIncome}) before sync.`);
        await userRef.collection('transactions').add({
          amount: userData.monthlyIncome,
          type: 'income',
          category: 'General',
          description: isBrazil ? 'Renda Mensal (Onboarding)' : 'Monthly Income (Onboarding)',
          createdAt: new Date().toISOString(),
          intent: 'RECORD'
        });
        
        const refreshed = await calculateUserTotals(userRef, isBrazil);
        const diff = reportedBalance - refreshed.currentBalance;
        
        if (Math.abs(diff) > 0.01) {
          initialSpending = Math.abs(diff);
          await userRef.collection('transactions').add({
            amount: initialSpending,
            type: diff > 0 ? 'income' : 'expense',
            category: 'General',
            description: isBrazil ? 'Ajuste Inicial' : 'Initial Adjustment',
            createdAt: new Date().toISOString(),
            intent: 'RECORD'
          });
        }
      } else {
        const diff = reportedBalance - oldBalance;
        if (Math.abs(diff) > 0.01) {
          await userRef.collection('transactions').add({
            amount: Math.abs(diff),
            type: diff > 0 ? 'income' : 'expense',
            category: 'General',
            description: isBrazil ? 'Ajuste de Saldo' : 'Balance Adjustment',
            createdAt: new Date().toISOString(),
            intent: 'RECORD'
          });
        }
      }

      if (source === 'whatsapp-evolution') {
        const formatVal = (val) => val.toLocaleString(isBrazil ? 'pt-BR' : 'en-GB', { minimumFractionDigits: 2 });
        let syncReply = "";

        if (isInitialSync) {
          syncReply = isBrazil
            ? `🔄 *Saldo atualizado!* Como sua renda é de R$${formatVal(userData.monthlyIncome)} e seu saldo atual é R$${formatVal(reportedBalance)}, identifiquei que você já gastou aproximadamente *R$${formatVal(initialSpending)}* antes de começar a usar o Penny. 📈\n\nAgora que seu perfil está completo, vou te ajudar a controlar cada centavo! 🚀`
            : `🔄 *Balance updated!* Since your income is £${formatVal(userData.monthlyIncome)} and your current balance is £${formatVal(reportedBalance)}, I've identified that you spent approximately *£${formatVal(initialSpending)}* before starting with Penny. 📈\n\nNow that your profile is complete, I'll help you track every penny! 🚀`;
        } else {
          syncReply = isBrazil
            ? `🔄 *Saldo sincronizado!* Agora entendi que você tem R$${reportedBalance.toFixed(2)} na conta. Ajustei aqui para bater com seu banco! 😉`
            : `🔄 *Balance synced!* I've updated your record to match the £${reportedBalance.toFixed(2)} in your account. All set! 😉`;
        }
        await sendMessage(instance, sender, syncReply);
      }
      return;
    }

    if (transactionData.intent === 'UNCERTAIN') {
      if (source === 'whatsapp-evolution') {
        const reply = isBrazil
          ? `🤔 *Hum... não tenho certeza.* Poderia repetir de uma forma mais simples?`
          : `🤔 *Hmm... I'm not sure.* Could you please rephrase that for me?`;
        await sendMessage(instance, sender, reply);
      }
      return;
    }

    if (transactionData.intent === 'REMOVE') {
      console.log(`[Background] 🗑️ Removing last transaction for ${sender}...`);
      const amountToRemove = transactionData.amount;
      const lastTransactions = await userRef.collection('transactions').orderBy('createdAt', 'desc').limit(10).get();

      let deleted = false;
      for (const doc of lastTransactions.docs) {
        if (parseFloat(doc.data().amount) === parseFloat(amountToRemove) && doc.data().type !== 'error') {
          await doc.ref.update({ type: 'error' });
          deleted = true;
          break;
        }
      }

      if (source === 'whatsapp-evolution') {
        const reply = deleted
          ? (isBrazil ? `✅ *Feito!* Removi o registro de R$${amountToRemove.toFixed(2)}.` : `✅ *Done!* Removed the £${amountToRemove.toFixed(2)} record.`)
          : (isBrazil ? `❌ *Ops!* Não encontrei um registro recente de R$${amountToRemove.toFixed(2)}.` : `❌ *Oops!* I couldn't find a recent record of £${amountToRemove.toFixed(2)}.`);
        await sendMessage(instance, sender, reply);
      }
      return;
    }

    if (transactionData.intent === 'RESET') {
      console.log(`[Background] 🗑️ Resetting profile for ${sender}...`);
      await userRef.update({
        monthlyIncome: admin.firestore.FieldValue.delete(),
        payDay: admin.firestore.FieldValue.delete(),
        lastProactivePrompt: admin.firestore.FieldValue.delete()
      });
      
      // Also clear transactions if you want a TRULY clean slate
      const txs = await userRef.collection('transactions').get();
      const batch = db.batch();
      txs.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      if (source === 'whatsapp-evolution') {
        const reply = isBrazil 
          ? `🗑️ *Perfil resetado!* Apaguei seus dados de renda, dia de pagamento e histórico de transações. Você é um novo usuário agora! 😉`
          : `🗑️ *Profile reset!* I've cleared your income, payday, and transaction history. You're a new user now! 😉`;
        await sendMessage(instance, sender, reply);
      }
      return;
    }

    // --- RECORD (Income or Expense) ---
    console.log(`[Background] 💾 Saving to usuarios/${sender}/transactions...`);
    const docData = {
      ...transactionData,
      description: text,
      createdAt: new Date().toISOString(),
      originalMessage: text,
      userPhone: sender,
      instance: instance,
      source: source
    };
    const docRef = await userRef.collection('transactions').add(docData);
    console.log(`[Background] ✅ Saved with ID: ${docRef.id}`);
    
    await logRawMessage(instance, sender, text);

    if (source === 'whatsapp-evolution') {
      try {
        const { totalDia, totalMes, currentBalance } = await calculateUserTotals(userRef, isBrazil);
        const formatVal = (val) => val.toLocaleString(isBrazil ? 'pt-BR' : 'en-GB', { minimumFractionDigits: 2 });
        const dashboardUrl = 'https://penny-finance.vercel.app'; 
        const personalizedLink = `${dashboardUrl}?user=${sender}`;

        let replyText = "";
        const isIncome = transactionData.type === 'income';
        const categoryKey = transactionData.category || 'General';
        
        // Category Map for display
        const categoryNames = {
          Food: { name: isBrazil ? 'Alimentação' : 'Food', emoji: '🍔' },
          Transport: { name: isBrazil ? 'Transporte' : 'Transport', emoji: '🚗' },
          Shopping: { name: isBrazil ? 'Compras' : 'Shopping', emoji: '🛒' },
          Leisure: { name: isBrazil ? 'Lazer' : 'Leisure', emoji: '🎡' },
          Bills: { name: isBrazil ? 'Contas' : 'Bills', emoji: '📝' },
          General: { name: isBrazil ? 'Geral' : 'General', emoji: '💡' }
        };
        const categoryObj = categoryNames[categoryKey] || categoryNames.General;
        const categoryDisplay = categoryObj.name;
        const emoji = categoryObj.emoji;

        if (isBrazil) {
          replyText = isIncome 
            ? `💰 *Saldo adicionado!* +R$${formatVal(transactionData.amount)}\n\n`
            : `💸 *Gasto registrado!* -R$${formatVal(transactionData.amount)} ${emoji} (${categoryDisplay})\n\n`;
          
          replyText += `📊 *Resumo:*\n` +
            `• Gasto hoje: R$${formatVal(totalDia)}\n` +
            `• Gasto no mês: R$${formatVal(totalMes)}\n` +
            `• *Saldo Atual: R$${formatVal(currentBalance)}*\n\n`;

          // Budget Alert (80%)
          if (userData.monthlyIncome > 0 && totalMes > 0.8 * userData.monthlyIncome) {
             replyText += `⚠️ *ALERTA:* Você já usou mais de 80% da sua renda este mês! Tente segurar um pouco. 🛑\n\n`;
          }

          replyText += `🔗 ${personalizedLink}`;
        } else {
          replyText = isIncome 
            ? `💰 *Balance added!* +£${formatVal(transactionData.amount)}\n\n`
            : `💸 *Expense logged!* -£${formatVal(transactionData.amount)} ${emoji} (${categoryDisplay})\n\n`;
          
          replyText += `📊 *Summary:*\n` +
              `• Today's spending: £${formatVal(totalDia)}\n` +
              `• This month's spending: £${formatVal(totalMes)}\n` +
              `• *Current Balance: £${formatVal(currentBalance)}*\n\n`;

          // Budget Alert (80%)
          if (userData.monthlyIncome > 0 && totalMes > 0.8 * userData.monthlyIncome) {
             replyText += `⚠️ *BUDGET ALERT:* You've used over 80% of your income this month! Tread carefully. 🛑\n\n`;
          }

          replyText += `🔗 ${personalizedLink}`;
        }
        
        await sendMessage(instance, sender, replyText);

        // --- ONBOARDING TRIGGER: Ask about income if missing ---
        if (!userData.monthlyIncome && !transactionData.monthlyIncome) {
           const onboardingMsg = isBrazil
            ? `Oi! Notei que ainda não sei qual sua renda mensal. *Qual seria sua renda mensal? Para adicionar ao seu dashboard?* 💰`
            : `Hi! I noticed I don't know your monthly income yet. *What would your monthly income be? To add to your dashboard?* 💰`;
          await sendMessage(instance, sender, onboardingMsg);
        }

      } catch (replyError) {
        console.error('[Background] ⚠️ Failed to send WhatsApp reply:', replyError.message);
      }
    }

  } catch (error) {
    console.error('[Background] ❌ Error processing message:', error);
  }
}

/**
 * Helper to calculate user totals for messages
 */
async function calculateUserTotals(userRef, isBrazil) {
  const tz = isBrazil ? 'America/Sao_Paulo' : 'Europe/London';
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });
  const monthStr = todayStr.substring(0, 7);

  const totalsSnapshot = await userRef.collection('transactions').get();

  let totalDia = 0;
  let totalMes = 0;
  let totalIncome = 0;
  let totalExpenses = 0;

  totalsSnapshot.forEach(doc => {
    const data = doc.data();
    const amt = parseFloat(data.amount || 0);
    
    if (data.type === 'error') return;
    
    if (data.type === 'income') {
      totalIncome += amt;
    } else {
      totalExpenses += amt;
      const created = new Date(data.createdAt || data.date);
      const createdTodayStr = created.toLocaleDateString('en-CA', { timeZone: tz });
      const createdMonthStr = createdTodayStr.substring(0, 7);

      if (createdTodayStr === todayStr) totalDia += amt;
      if (createdMonthStr === monthStr) totalMes += amt;
    }
  });

  return {
    totalDia,
    totalMes,
    totalIncome,
    totalExpenses,
    currentBalance: totalIncome - totalExpenses
  };
}

async function logRawMessage(instance, sender, text) {
  try {
    await db.collection('instancias')
      .doc(instance)
      .collection('mensagens')
      .add({
        texto: text,
        de: sender,
        timestamp: new Date().toISOString()
      });
  } catch (e) {
    console.error('❌ Error logging raw:', e.message);
  }
}

// Handle Incoming Messages
app.post('/webhook', (req, res) => {
  console.log('========================================');
  console.log('📦 Webhook POST received:', new Date().toISOString());
  
  // 1. Respond IMEDIATAMENTE com 200 OK para o Meta
  // Isso evita que o Meta descarte a mensagem por timeout (>10s)
  res.sendStatus(200);
  console.log('🚀 [Ack] Sent 200 OK to Meta immediately');

  try {
    let body;
    
    // If we used express.text(), the body is a string
    if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError.message);
        return; // Already sent 200
      }
    } else {
      body = req.body;
    }

    // CASE 1: Meta Official API
    if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      if (message.type === 'text') {
        processMessageBackground(message.text.body, message.from, 'OfficialMeta', 'whatsapp-meta');
      } else {
        console.log('ℹ️ Meta: Non-text message ignored');
      }
      return;
    }

    // CASE 2: Evolution API
    const evoEvent = body.event || body.type;
    console.log('ℹ️ Evolution Event Type:', evoEvent);
    
    if (evoEvent && (evoEvent === "messages.upsert" || evoEvent === "MESSAGES_UPSERT")) {
      const data = Array.isArray(body.data) ? body.data[0] : body.data;
      if (!data) {
        console.log('ℹ️ Evolution: No data in payload');
        return;
      }

      const message = data.message;
      const key = data.key;
      const instance = body.instance || body.sender || 'UnknownInstance';
      
      const text = message?.conversation || message?.extendedTextMessage?.text || message?.imageMessage?.caption || "";
      const sender = key?.remoteJid?.split('@')[0];
      
      console.log(`ℹ️ Evolution: From=${sender}, Text=${text}`);

      if (text && sender) {
        // 🔒 Filtro de Segurança: Apenas o número do usuário
        if (sender === '557391082831' || sender === '73991082831') {
          processMessageBackground(text, sender, instance, 'whatsapp-evolution');
        } else {
          console.log(`ℹ️ Evolution: Ignorando mensagem de número não autorizado: ${sender}`);
        }
      } else {
        console.log('ℹ️ Evolution: No text or sender found');
      }
      return;
    }

    // Default: Check if this is a WhatsApp status update (ignore them)
    if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
      console.log('ℹ️ Status update received');
      return;
    }

    console.log('ℹ️ Webhook received but unrecognized event');

  } catch (error) {
    console.error('❌ Error in webhook handler:', error);
  }
  console.log('========================================');
});

// --- Proactive AI Messaging Loop ---
async function checkProactiveMessages() {
  console.log('🕒 [Proactive] Running 30min check...');
  try {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000);
    
    // Find users active in last 24h to avoid spamming old users
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60000).toISOString();
    const usersSnapshot = await db.collection('usuarios')
      .where('lastInteraction', '>', twentyFourHoursAgo)
      .get();

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const lastPrompt = userData.lastProactivePrompt ? new Date(userData.lastProactivePrompt) : new Date(0);

      // Only prompt if last prompt was > 30 mins ago
      if (lastPrompt < thirtyMinsAgo) {
        const isBrazil = userId.startsWith('55');
        const instance = userData.instance || 'penny-instance'; // Better default, but should come from DB
        
        let message = "";
        
        if (!userData.monthlyIncome) {
          message = isBrazil 
            ? "Oi! Notei que ainda não sei qual sua renda mensal ou salário. Quanto você costuma receber para eu organizar seu saldo? 💰"
            : "Hi! I noticed I don't know your monthly income yet. How much do you usually receive so I can track your balance? 💰";
        } else if (userData.isSalaried && !userData.payDay) {
          message = isBrazil
            ? "Vi que você é assalariado! Que dia do mês você costuma receber seu salário? 📅"
            : "I see you're salaried! What day of the month do you usually receive your salary? 📅";
        } else {
          // Check if user has synced balance this month
          const monthStr = new Date().toISOString().substring(0, 7);
          const monthTxs = await doc.ref.collection('transactions')
            .where('createdAt', '>=', monthStr + '-01')
            .limit(1)
            .get();

          if (monthTxs.empty) {
            // Se é assalariado e não é dia de pagamento, perguntar quanto tem na conta para sincronizar
            const today = new Date().getDate();
            if (userData.isSalaried && today !== userData.payDay) {
               message = isBrazil
                ? "Para eu organizar seu saldo hoje, quanto você tem na sua conta agora? Assim calculo quanto você já gastou este mês! 📈"
                : "To organize your balance today, how much do you have in your account right now? This way I can calculate how much you've already spent this month! 📈";
            }
          }
        }

        if (message) {
          console.log(`🕒 [Proactive] Sending prompt to ${userId}`);
          await sendMessage(instance, userId, message);
          await doc.ref.update({ lastProactivePrompt: now.toISOString() });
        }
      }
    }
  } catch (error) {
    console.error('❌ [Proactive] Error:', error.message);
  }
}

// Start the loop every 30 minutes
setInterval(checkProactiveMessages, 30 * 60000);

// --- Scheduled Daily Night Report (00:00) ---
cron.schedule('0 0 * * *', async () => {
  console.log('🕒 [Cron] Running daily night report (00:00)...');
  try {
    const now = new Date();
    // Use last 24h as activity filter
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60000).toISOString();
    const usersSnapshot = await db.collection('usuarios')
      .where('lastInteraction', '>', twentyFourHoursAgo)
      .get();

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const sender = doc.id;
      const isBrazil = sender.startsWith('55');
      const instance = userData.instance || 'penny-instance';

      const { totalDia, totalMes, currentBalance } = await calculateUserTotals(doc.ref, isBrazil);
      const formatVal = (val) => val.toLocaleString(isBrazil ? 'pt-BR' : 'en-GB', { minimumFractionDigits: 2 });
      
      let reportMsg = "";
      if (isBrazil) {
        reportMsg = `🌙 *Resumo do Dia - Penny*\n\n` +
          `Hoje você gastou: *R$${formatVal(totalDia)}*\n` +
          `Total no mês: R$${formatVal(totalMes)}\n` +
          `Saldo atual: *R$${formatVal(currentBalance)}*\n\n` +
          `Tenha uma ótima noite! Amanhã estarei aqui para registrar seus novos gastos. 😴`;
      } else {
        reportMsg = `🌙 *Daily Summary - Penny*\n\n` +
          `Today's spending: *£${formatVal(totalDia)}*\n` +
          `Total this month: £${formatVal(totalMes)}\n` +
          `Current balance: *£${formatVal(currentBalance)}*\n\n` +
          `Have a great night! I'll be here tomorrow to track your new expenses. 😴`;
      }

      await sendMessage(instance, sender, reportMsg);
      console.log(`[Cron] Sent report to ${sender}`);
    }
  } catch (err) {
    console.error('[Cron] ❌ Daily report failed:', err.message);
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment:`);
  console.log(`- FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  
  // Initial run in 10 seconds to not block startup
  setTimeout(checkProactiveMessages, 10000);
});
