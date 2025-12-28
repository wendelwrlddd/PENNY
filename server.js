
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { extractFinancialData } from './lib/gemini.js';
import { db } from './lib/firebase.js';
import { sendMessage } from './lib/evolution.js';

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

// Helper function to process message in background
async function processMessageBackground(text, sender, instance, source) {
  try {
    console.log(`[Background] 💬 Processing from ${sender} (${source}): ${text}`);

    // 1. Detect Region and Extract Data with Gemini
    const isBrazil = sender.startsWith('55');
    console.log(`[Background] 🤖 Region detected: ${isBrazil ? 'Brazil (PT-BR/R$)' : 'International (EN-GB/£)'}`);
    
    let transactionData;
    let aiFailed = false;
    try {
      transactionData = await extractFinancialData(text, isBrazil);
    } catch (aiError) {
      console.error('[Background] ⚠️ Gemini failed:', aiError.message);
      aiFailed = true;
    }

    if (aiFailed) {
      if (source === 'whatsapp-evolution') {
        const doubtMsg = isBrazil 
          ? `🤔 *Fiquei em dúvida!* Não consegui entender muito bem essa mensagem. Pode repetir de uma forma mais clara?`
          : `🤔 *I'm in doubt!* I couldn't quite understand that message. Could you please rephrase it?`;
        await sendMessage(instance, sender, doubtMsg);
      }
      return;
    }
    
    // 2. Handle based on Intent
    const userRef = db.collection('usuarios').doc(sender);
    
    // Update last interaction for proactivity tracking
    await userRef.set({ 
      lastInteraction: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (transactionData.intent === 'PROFILE_UPDATE' && transactionData.profile) {
      console.log(`[Background] 👤 Updating profile for ${sender}...`);
      await userRef.set(transactionData.profile, { merge: true });
      
      if (source === 'whatsapp-evolution') {
        const reply = isBrazil 
          ? `✅ *Perfil atualizado!* Salvei suas informações de renda e pagamento. 😉`
          : `✅ *Profile updated!* I've saved your income and payment info. 😉`;
        await sendMessage(instance, sender, reply);

        // Se o usuário acabou de informar o salário mas não a data, avisar que logo perguntaremos
        const profile = transactionData.profile;
        if (profile.monthlyIncome && !profile.payDay) {
           const waitMsg = isBrazil 
            ? `Dica: Notei que você não informou o dia do pagamento. Em breve te perguntarei sobre isso para organizar melhor! 📅`
            : `Tip: I noticed you didn't mention your payday. I'll ask you about that soon to help organize better! 📅`;
           await sendMessage(instance, sender, waitMsg);
        }
      }
      return;
    }

    if (transactionData.intent === 'SYNC') {
      console.log(`[Background] 🔄 Syncing balance for ${sender}...`);
      const reportedBalance = parseFloat(transactionData.amount);
      
      // Get current state
      const userSnap = await userRef.get();
      const userData = userSnap.data() || {};
      const { totalIncome, currentBalance } = await calculateUserTotals(userRef, isBrazil);
      
      // If no income recorded this month, add the monthlyIncome from profile first
      if (totalIncome === 0 && userData.monthlyIncome > 0) {
        console.log(`[Background] 💰 Adding monthly income (R$${userData.monthlyIncome}) before sync.`);
        await userRef.collection('transactions').add({
          amount: userData.monthlyIncome,
          type: 'income',
          category: isBrazil ? 'Salário' : 'Salary',
          description: isBrazil ? 'Renda Mensal' : 'Monthly Income',
          createdAt: new Date().toISOString(),
          intent: 'RECORD'
        });
        
        // Refresh totals after adding income
        const refreshed = await calculateUserTotals(userRef, isBrazil);
        const diff = reportedBalance - refreshed.currentBalance;
        
        if (Math.abs(diff) > 0.01) {
          await userRef.collection('transactions').add({
            amount: Math.abs(diff),
            type: diff > 0 ? 'income' : 'expense',
            category: isBrazil ? 'Ajuste' : 'Adjustment',
            description: isBrazil ? 'Ajuste de Saldo' : 'Balance Adjustment',
            createdAt: new Date().toISOString(),
            intent: 'RECORD'
          });
        }
      } else {
        // Just standard differential sync
        const diff = reportedBalance - currentBalance;
        if (Math.abs(diff) > 0.01) {
          await userRef.collection('transactions').add({
            amount: Math.abs(diff),
            type: diff > 0 ? 'income' : 'expense',
            category: isBrazil ? 'Ajuste' : 'Adjustment',
            description: isBrazil ? 'Ajuste de Saldo' : 'Balance Adjustment',
            createdAt: new Date().toISOString(),
            intent: 'RECORD'
          });
        }
      }

      if (source === 'whatsapp-evolution') {
        const syncReply = isBrazil
          ? `🔄 *Saldo sincronizado!* Agora entendi que você tem R$${reportedBalance.toFixed(2)} na conta. Ajustei aqui para bater com seu banco! 😉`
          : `🔄 *Balance synced!* I've updated your record to match the £${reportedBalance.toFixed(2)} in your account. All set! 😉`;
        await sendMessage(instance, sender, syncReply);
      }
      return;
    }

    if (transactionData.intent === 'UNCERTAIN') {
      console.log(`[Background] ❓ Uncertain intent for ${sender}. Suggestion: ${transactionData.suggestion}`);
      if (source === 'whatsapp-evolution') {
        let reply = "";
        const suggestion = transactionData.suggestion;

        if (isBrazil) {
          reply = suggestion 
            ? `🤔 *Fiquei em dúvida...* Você quis dizer: "_${suggestion}_"?`
            : `🤔 *Hum... não tenho certeza.* Poderia repetir de uma forma mais simples?`;
        } else {
          reply = suggestion
            ? `🤔 *I'm in doubt...* Did you mean: "_${suggestion}_"?`
            : `🤔 *Hmm... I'm not sure.* Could you please rephrase that for me?`;
        }
        await sendMessage(instance, sender, reply);
      }
      return;
    }

    if (transactionData.intent === 'REMOVE') {
      console.log(`[Background] 🗑️ Removing last transaction for ${sender}...`);
      const amountToRemove = transactionData.amount;
      
      const lastTransactions = await userRef.collection('transactions')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

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

    // Default: RECORD (or fallback)
    console.log(`[Background] 💾 Saving to usuarios/${sender}/transactions...`);
    const docData = {
      ...transactionData,
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
        const category = transactionData.category || (isBrazil ? 'Geral' : 'General');

        if (isBrazil) {
          replyText = isIncome 
            ? `💰 *Saldo adicionado!* +R$${formatVal(transactionData.amount)}\n\n`
            : `💸 *Gasto registrado!* -R$${formatVal(transactionData.amount)} (${category})\n\n`;
          
          replyText += `📊 *Resumo:*\n` +
            `• Gasto hoje: R$${formatVal(totalDia)}\n` +
            `• Gasto no mês: R$${formatVal(totalMes)}\n` +
            `• *Saldo Atual: R$${formatVal(currentBalance)}*\n\n` +
            `🔗 ${personalizedLink}`;
        } else {
          replyText = isIncome 
            ? `💰 *Balance added!* +£${formatVal(transactionData.amount)}\n\n`
            : `💸 *Expense logged!* -£${formatVal(transactionData.amount)} (${category})\n\n`;
          
          replyText += `📊 *Summary:*\n` +
              `• Today's spending: £${formatVal(totalDia)}\n` +
              `• This month's spending: £${formatVal(totalMes)}\n` +
              `• *Current Balance: £${formatVal(currentBalance)}*\n\n` +
              `🔗 ${personalizedLink}`;
        }
        
        await sendMessage(instance, sender, replyText);
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
        if (sender === '557391082831' || sender === '73991082831' || sender === '557381193570') {
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
        const instance = userData.instance || 'OfficialMeta'; // Fallback instance
        
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

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment:`);
  console.log(`- FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`- GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  
  // Initial run in 10 seconds to not block startup
  setTimeout(checkProactiveMessages, 10000);
});
