
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

// Update this list with authorized phone numbers (only digits)
const ALLOWED_NUMBERS = [
  '557391082831', // User Primary Number
];

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

    // --- WHITELIST CHECK ---
    // Ensure sender contains only digits for comparison
    const cleanSender = sender.replace(/\D/g, '');
    const isAllowed = ALLOWED_NUMBERS.some(num => cleanSender.includes(num));

    if (!isAllowed) {
       console.log(`[Security] ⛔ Blocked unauthorized number: ${sender}`);
       // Optional: Send a rejection message? 
       // For now, silent block to avoid spam/costs.
       return; 
    }

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

    // --- 3. Fetch full User State for AI Awareness ---
    const userRef = db.collection('usuarios').doc(sender);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};
    
    // Calculate current balance and totals for the AI
    const { totalIncome, totalExpenses, currentBalance } = await calculateUserTotals(userRef, isBrazil);
    
    // Determine onboarding step
    let onboarding_step = "ACTIVE";
    if (!userData.monthlyIncome) {
      // If we are in the middle of onboarding, AI might have told us last time
      onboarding_step = userData.onboarding_step || "null";
    } else if (userData.monthlyIncome && !userData.hasSyncedBalance) {
      onboarding_step = "ASK_BALANCE";
    }

    const aiState = {
      monthlyIncome: userData.monthlyIncome || null,
      currentBalance: currentBalance,
      lastAction: userData.lastAction || 'none',
      onboarding_step: onboarding_step
    };

    let transactionData = null;
    try {
      transactionData = await extractFinancialData(text, aiState, isBrazil);
    } catch (aiError) {
      console.error('[Background] ⚠️ OpenAI failed:', aiError.message);
      if (source === 'whatsapp-evolution') {
        const errorMsg = isBrazil 
          ? `❌ *Ops!* Tive um problema técnico ao processar sua mensagem. Tente novamente em instantes.`
          : `❌ *Oops!* I had a technical problem processing your message. Please try again in a moment.`;
        await sendMessage(instance, sender, errorMsg);
      }
      return;
    }

    if (!transactionData || transactionData.intent === 'NO_ACTION') {
      console.log(`[Background] ℹ️ AI decided NO_ACTION for: ${text}`);
      if (transactionData?.response_message && source === 'whatsapp-evolution') {
        await sendMessage(instance, sender, transactionData.response_message);
      }
      return;
    }
    
    // --- EXECUTE AI DECISION ---
    console.log(`[Background] 🧠 Intent: ${transactionData.intent}`);

    // Update user state
    const updateData = { 
      lastInteraction: new Date().toISOString(),
      lastAction: transactionData.intent,
      updatedAt: new Date().toISOString()
    };

    if (transactionData.next_question) {
      updateData.onboarding_step = transactionData.next_question;
    } else if (transactionData.intent === 'SET_CURRENT_BALANCE') {
      updateData.onboarding_step = "ACTIVE";
      updateData.hasSyncedBalance = true;
    }

    await userRef.set(updateData, { merge: true });

    if (transactionData.intent === 'SET_MONTHLY_INCOME') {
      const income = parseFloat(transactionData.monthly_income);
      console.log(`[Background] 💰 Setting income: ${income}`);
      await userRef.update({ monthlyIncome: income });
      
      // Record income transaction
      await userRef.collection('transactions').add({
        amount: income,
        type: 'income',
        category: 'General',
        description: isBrazil ? 'Renda Mensal' : 'Monthly Income',
        createdAt: new Date().toISOString(),
        intent: 'SET_MONTHLY_INCOME'
      });
    }

    if (transactionData.intent === 'SET_PAYDAY') {
      const day = parseInt(transactionData.payday);
      console.log(`[Background] 📅 Setting payday: ${day}`);
      await userRef.update({ payDay: day });
    }

    if (transactionData.intent === 'SET_CURRENT_BALANCE') {
      console.log(`[Background] 🔄 Setting current balance...`);
      
      if (transactionData.balance_change) {
        // CASE 2: Surplus logic - Informational income to adjust balance
        console.log(`[Background] 📈 Surplus detected: ${transactionData.balance_change}`);
        await userRef.collection('transactions').add({
          amount: parseFloat(transactionData.balance_change),
          type: 'income',
          category: 'Surplus',
          description: isBrazil ? 'Ajuste de Saldo (Sobra)' : 'Balance Sync (Surplus)',
          createdAt: new Date().toISOString(),
          intent: 'SET_CURRENT_BALANCE'
        });
      } else {
        // CASE 1: Adjustment expense logic
        let adjustment = transactionData.adjustment_expense;
        
        // If AI didn't calculate it for some reason, calculate it here if income exists
        if (adjustment === null && aiState.monthlyIncome) {
           const informedBalance = parseFloat(text.replace(/\D/g, '')) || 0; // Backup extraction
           adjustment = aiState.monthlyIncome - informedBalance;
        }

        if (adjustment !== null) {
          // Record adjustment as an expense
          await userRef.collection('transactions').add({
            amount: Math.max(0, adjustment),
            type: 'expense',
            category: 'General',
            description: isBrazil ? 'Ajuste de Saldo' : 'Balance Sync',
            createdAt: new Date().toISOString(),
            intent: 'SET_CURRENT_BALANCE'
          });
        }
      }
    }

    if (transactionData.intent === 'ADD_BALANCE') {
      const amount = parseFloat(transactionData.balance_change || 0);
      console.log(`[Background] 💰 Adding balance: ${amount}`);
      await userRef.collection('transactions').add({
        amount: amount,
        type: 'income',
        category: 'General',
        description: text,
        createdAt: new Date().toISOString(),
        intent: 'ADD_BALANCE'
      });
    }

    if (transactionData.intent === 'REMOVE_EXPENSE' || transactionData.remove_expense) {
      console.log(`[Background] 🗑️ Removing last expense for ${sender}...`);
      const lastTxSnap = await userRef.collection('transactions')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      
      if (!lastTxSnap.empty) {
        await lastTxSnap.docs[0].ref.delete();
        console.log(`[Background] ✅ Deleted transaction: ${lastTxSnap.docs[0].id}`);
      }
    }

    if (transactionData.intent === 'ADD_EXPENSE' || transactionData.intent === 'MULTIPLE_EXPENSES') {
      const expenses = transactionData.expenses || [];
      // Support the single amount/category if expenses array is empty
      if (expenses.length === 0 && transactionData.amount) {
        expenses.push({ amount: transactionData.amount, category: transactionData.category || 'General' });
      }

      console.log(`[Background] 💸 Adding ${expenses.length} expenses...`);
      
      for (const exp of expenses) {
        await userRef.collection('transactions').add({
          amount: parseFloat(exp.amount),
          category: exp.category || 'General',
          description: text,
          type: 'expense',
          createdAt: new Date().toISOString(),
          intent: transactionData.intent
        });
      }
    }

    if (transactionData.intent === 'CORRECTION') {
      console.log(`[Background] ✏️ Handling CORRECTION...`);
      // Simpler correction for now: just record what the AI extracted if it's there
      if (transactionData.monthly_income) await userRef.update({ monthlyIncome: transactionData.monthly_income });
      if (transactionData.payday) await userRef.update({ payDay: transactionData.payday });
    }

    if (transactionData.intent === 'RESET') {
      console.log(`[Background] 🗑️ Resetting profile for ${sender}...`);
      await userRef.update({
        monthlyIncome: admin.firestore.FieldValue.delete(),
        payDay: admin.firestore.FieldValue.delete(),
        lastProactivePrompt: admin.firestore.FieldValue.delete(),
        lastAction: admin.firestore.FieldValue.delete(),
        onboarding_step: admin.firestore.FieldValue.delete(),
        hasSyncedBalance: admin.firestore.FieldValue.delete()
      });
      
      const txs = await userRef.collection('transactions').get();
      const batch = db.batch();
      txs.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      if (!transactionData.response_message && source === 'whatsapp-evolution') {
        const reply = isBrazil 
          ? `🗑️ *Perfil resetado!* Apaguei seus dados e histórico. Você é um novo usuário agora! 😉`
          : `🗑️ *Profile reset!* I've cleared your data and history. You're a new user now! 😉`;
        await sendMessage(instance, sender, reply);
      }
    }

    // --- RESPOND ---
    if (source === 'whatsapp-evolution' && transactionData.response_message) {
      // Re-calculate totals for the final message if needed, or use AI message
      // The user wants to use the response_message from AI.
      await sendMessage(instance, sender, transactionData.response_message);
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
        // 🔒 Filtro de Segurança: Apenas números autorizados
        const isAllowed = ALLOWED_NUMBERS.some(num => sender.includes(num));
        
        if (isAllowed) {
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
