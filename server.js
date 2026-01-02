
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

    // --- 3. Fetch full User State for AI Awareness ---
    const userRef = db.collection('usuarios').doc(sender);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};

    // 1. Detect Region (Prioritize feature flag, fallback to prefix)
    let isBrazil = sender.startsWith('55');
    if (userData.features?.ukMode === true) {
        isBrazil = false;
        console.log(`[Security] 🇬🇧 Forcing UK Mode due to feature flag for ${sender}`);
    }

    // --- COMMANDS (Kill Switch & Test Mode) ---
    const upperText = text.toUpperCase();
    if (upperText === '#DESARMAR') {
      console.log(`🚨 [PANIC] Disarm command received from ${sender}. Logging out instance ${instance}...`);
      await sendMessage(instance, sender, isBrazil ? "⚠️ *COMANDO DE DESARME ATIVADO!* Desconectando este número agora para sua segurança..." : "⚠️ *DISARM COMMAND ACTIVATED!* Disconnecting this number now for your security...");
      try {
        await logoutInstance(instance);
        console.log(`✅ [PANIC] Instance ${instance} logged out successfully.`);
      } catch (err) {
        console.error(`❌ [PANIC] Failed to logout instance ${instance}:`, err.message);
        await deleteInstance(instance);
      }
      return;
    }

    if (upperText === '#UKMODE') {
        console.log(`🇬🇧 [Test] Enabling UK Mode for ${sender}`);
        await userRef.set({ features: { ukMode: true } }, { merge: true });
        await sendMessage(instance, sender, "🇬🇧 *UK Mode Enabled!* Send #RESET to start the UK onboarding flow.");
        return;
    }
    
    console.log(`[Background] 🤖 Region detected: ${isBrazil ? 'Brazil (PT-BR/R$)' : 'International (EN-GB/£)'}`);
    
    // Calculate current balance and totals for the AI
    const { totalDia, totalMes, currentBalance } = await calculateUserTotals(userRef, isBrazil);
    
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
      hourlyRate: userData.hourlyRate || null,
      weeklyHours: userData.weeklyHours || null,
      payFrequency: userData.payFrequency || null,
      currentBalance: currentBalance,
      totalToday: totalDia,
      totalMonth: totalMes,
      lastAction: userData.lastAction || 'none',
      onboarding_step: onboarding_step,
      dashboard_link: `https://penny-finance.vercel.app/?user=${sender}`
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

    if (transactionData.intent === 'SET_INCOME_TYPE') {
      const incomeType = transactionData.income_type;
      console.log(`[Background] 💼 Setting income type: ${incomeType}`);
      await userRef.update({ incomeType });
    }

    if (transactionData.intent === 'SET_HOURLY_RATE') {
      const rate = parseFloat(transactionData.hourly_rate);
      console.log(`[Background] 💸 Setting hourly rate: ${rate}`);
      await userRef.update({ hourlyRate: rate });
    }

    if (transactionData.intent === 'SET_WEEKLY_HOURS') {
      const hours = parseFloat(transactionData.weekly_hours);
      console.log(`[Background] 🕒 Setting weekly hours: ${hours}`);
      
      const hourlyRate = userData.hourlyRate || transactionData.hourly_rate || 0;
      const weeklyIncome = hourlyRate * hours;
      const monthlyIncome = weeklyIncome * 4.33;

      await userRef.update({ 
        weeklyHours: hours,
        estimatedWeeklyIncome: weeklyIncome,
        monthlyIncome: monthlyIncome // Use estimate as base for onboarding logic
      });
    }

    if (transactionData.intent === 'SET_PAY_FREQUENCY') {
      const frequency = transactionData.pay_frequency;
      console.log(`[Background] 📅 Setting pay frequency: ${frequency}`);
      await userRef.update({ payFrequency: frequency });
    }

    if (transactionData.intent === 'SET_WEEKLY_HOURS_OVERRIDE') {
        const hours = parseFloat(transactionData.weekly_hours);
        console.log(`[Background] 🕒 Setting weekly hours override: ${hours}`);
        await userRef.update({ currentWeekHoursOverride: hours });
    }

    if (transactionData.intent === 'SET_PAYDAY_TODAY') {
        const now = new Date();
        const nextDate = calculateNextPayDate(now, userData.payFrequency || 'monthly');
        console.log(`[Background] 💰 Payday recorded today. Next estimated: ${nextDate.toISOString()}`);
        await userRef.update({ 
            lastPayDate: now.toISOString(),
            nextEstimatedPayDate: nextDate.toISOString()
        });
    }

    if (transactionData.intent === 'SET_MONTHLY_INCOME') {
      const income = parseFloat(transactionData.monthly_income);
      console.log(`[Background] 💰 Setting monthly income: ${income}`);
      await userRef.update({ monthlyIncome: income, incomeType: 'monthly' });
      
      // Also record as a transaction to update balance
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
          category: isBrazil ? '💰 Sobra Inicial' : '💰 Initial Savings',
          description: isBrazil ? 'Ajuste de Saldo (Sobra)' : 'Initial Balance Adjustment (Surplus)',
          createdAt: new Date().toISOString(),
          intent: 'SET_CURRENT_BALANCE'
        });
      } else {
        // CASE 1: Adjustment expense logic
        let adjustment = transactionData.adjustment_expense;
        
        if (adjustment !== null) {
          // Record adjustment as an expense
          await userRef.collection('transactions').add({
            amount: Math.max(0, adjustment),
            type: 'expense',
            category: isBrazil ? '💸 Ajuste Inicial' : '💸 Initial Adjustment',
            description: isBrazil ? 'Gastos Anteriores (Ajuste)' : 'Previous Expenses (Adjustment)',
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
        expenses.push({ 
          amount: transactionData.amount, 
          category: transactionData.category || 'General',
          item: text.length > 50 ? text.substring(0, 50) + "..." : text
        });
      }

      console.log(`[Background] 💸 Adding ${expenses.length} transaction(s) for ${transactionData.intent}`);
      
      for (const exp of expenses) {
        await userRef.collection('transactions').add({
          amount: parseFloat(exp.amount),
          type: 'expense',
          category: exp.category || 'General',
          description: exp.item || (isBrazil ? 'Gasto registrado' : 'Recorded expense'),
          createdAt: new Date().toISOString(),
          intent: 'ADD_EXPENSE' // Store as normal expense for dashboard compatibility
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

    // --- LOW BALANCE ANXIETY MODE ---
    if (!isBrazil && transactionData.intent === 'ADD_EXPENSE' || transactionData.intent === 'MULTIPLE_EXPENSES') {
        const { currentBalance: newBalance } = await calculateUserTotals(userRef, isBrazil);
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (newBalance < 50 && userData.lastLowBalanceAlertDate !== todayStr) {
            console.log(`[Security] ⚠️ Low balance alert for ${sender}: £${newBalance}`);
            const alertMsg = "⚠️ Your balance is getting low (£" + newBalance.toFixed(2) + "). Might be worth taking it easy today.";
            await sendMessage(instance, sender, alertMsg);
            await userRef.update({ lastLowBalanceAlertDate: todayStr });
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

// --- UK SPECIALIZED REPORTS ---

// Payday Reminders (Daily 09:00)
cron.schedule('0 9 * * *', async () => {
    console.log('🕒 [Cron] Running UK Payday Reminders (09:00)...');
    try {
        const usersSnapshot = await db.collection('usuarios').get();
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            if (!userData.features?.ukMode) continue;
            if (userData.onboarding_step !== 'ACTIVE') continue;

            const nextPayDate = userData.nextEstimatedPayDate ? new Date(userData.nextEstimatedPayDate) : null;
            if (!nextPayDate) continue;

            const nextPayStr = nextPayDate.toISOString().split('T')[0];
            const diffDays = Math.ceil((nextPayDate - now) / (1000 * 60 * 60 * 24));

            if (todayStr === nextPayStr) {
                await sendMessage(userData.instance || 'penny-instance', doc.id, "💰 *Today looks like payday.*");
            } else if (diffDays === 2) {
                await sendMessage(userData.instance || 'penny-instance', doc.id, "📅 *2 days to payday.*");
            }
        }
    } catch (err) {
        console.error('[Cron] Payday Reminder Error:', err.message);
    }
});

// Weekly Reset & Baseline Update (Monday 00:00)
cron.schedule('0 0 * * 1', async () => {
    console.log('🕒 [Cron] Running UK Weekly Reset (00:00)...');
    try {
        const usersSnapshot = await db.collection('usuarios').get();
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            if (!userData.features?.ukMode) continue;

            // Reset flex hours
            const updates = { currentWeekHoursOverride: admin.firestore.FieldValue.delete() };

            // Update average spending (last 4 weeks)
            const { start } = getLastFourWeeksRange();
            const { totalRange } = await calculateRangeTotals(doc.ref, start, new Date().toISOString());
            const avg = totalRange / 4;
            updates.weeklySpendingAverage = avg;

            await doc.ref.update(updates);
            console.log(`[Cron] Reset/Avg updated for ${doc.id}`);
        }
    } catch (err) {
        console.error('[Cron] Monday Reset Error:', err.message);
    }
});

// Weekly Retrospective (Monday 08:00)
cron.schedule('0 8 * * 1', async () => {
    console.log('🕒 [Cron] Running UK Monday Retrospective (08:00)...');
    try {
        const usersSnapshot = await db.collection('usuarios').get();
        const now = new Date();
        const weekNum = getWeekNumber(now);
        const yearWeek = `${now.getFullYear()}-${weekNum}`;

        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const sender = doc.id;
            if (!userData.features?.ukMode) continue;
            if (userData.onboarding_step !== 'ACTIVE') continue;
            if (userData.lastWeeklyReportDate === yearWeek) continue;

            const { start, end } = getPreviousWeekRange();
            const totals = await calculateRangeTotals(doc.ref, start, end);
            
            if (totals.totalRange > 0) {
                const reportMsg = `📅 *Weekly Recap*\n\n` +
                    `Last week you spent £${totals.totalRange.toFixed(2)}.\n` +
                    `Your biggest expense was ${totals.topCategory || 'Others'} (£${totals.topCategoryAmount.toFixed(2)}).`;
                
                await sendMessage(userData.instance || 'penny-instance', sender, reportMsg);
                await doc.ref.update({ lastWeeklyReportDate: yearWeek });
            }
        }
    } catch (err) {
        console.error('[Cron] Monday Report Error:', err.message);
    }
});

// Spending Alert (Friday 17:00)
cron.schedule('0 17 * * 5', async () => {
    console.log('🕒 [Cron] Running UK Friday Heads-up (17:00)...');
    try {
        const usersSnapshot = await db.collection('usuarios').get();
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const sender = doc.id;
            if (!userData.features?.ukMode) continue;
            if (userData.onboarding_step !== 'ACTIVE') continue;

            // Baseline check
            const avg = userData.weeklySpendingAverage || 0;
            const { start, end } = getCurrentWeekToNowRange();
            const { totalRange } = await calculateRangeTotals(doc.ref, start, end);

            // Only alert if > 20% above average (if avg exists) or > limit
            const limit = userData.estimatedWeeklyIncome || (userData.monthlyIncome / 4.33) || null;
            
            let shouldAlert = false;
            if (avg > 0 && totalRange > avg * 1.2) shouldAlert = true;
            else if (limit && totalRange > limit * 0.8) shouldAlert = true;

            if (shouldAlert) {
                const alertMsg = "🚨 *Spending Alert*\n\n" +
                    `You're spending more than usual this week (£${totalRange.toFixed(2)}). Just a heads-up before the weekend.`;
                await sendMessage(userData.instance || 'penny-instance', sender, alertMsg);
            }
        }
    } catch (err) {
        console.error('[Cron] Friday Report Error:', err.message);
    }
});

// Sunday Budget Close (Sunday 20:00)
cron.schedule('0 20 * * 0', async () => {
    console.log('🕒 [Cron] Running UK Sunday Close (20:00)...');
    try {
        const usersSnapshot = await db.collection('usuarios').get();
        const now = new Date();
        const weekNum = getWeekNumber(now);
        const yearWeek = `${now.getFullYear()}-${weekNum}`;

        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const sender = doc.id;
            if (!userData.features?.ukMode) continue;
            if (userData.onboarding_step !== 'ACTIVE') continue;

            const hourlyRate = userData.hourlyRate || 0;
            const effectiveHours = userData.currentWeekHoursOverride || userData.weeklyHours || 0;
            const weeklyIncome = hourlyRate * effectiveHours || (userData.monthlyIncome / 4.33) || 0;

            if (weeklyIncome <= 0) continue;

            const { start, end } = getCurrentWeekToNowRange();
            const { totalRange } = await calculateRangeTotals(doc.ref, start, end);
            const percent = (totalRange / weeklyIncome) * 100;

            let reportMsg = `📊 *Weekly Close*\n\n` +
                `You've used ${percent.toFixed(1)}% of your weekly budget.`;
            
            // Micro Feedback Positivo
            if (percent < 70 && userData.lastPositiveFeedbackWeek !== yearWeek) {
                reportMsg += "\n\n🌟 You stayed well within your budget this week.";
                await doc.ref.update({ lastPositiveFeedbackWeek: yearWeek });
            }

            await sendMessage(userData.instance || 'penny-instance', sender, reportMsg);
        }
    } catch (err) {
        console.error('[Cron] Sunday Report Error:', err.message);
    }
});

// --- HELPERS ---

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getPreviousWeekRange() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - 6); // Previous Monday
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Previous Sunday
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
}

function getCurrentWeekToNowRange() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); // Current Monday
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: now.toISOString() };
}

async function calculateRangeTotals(userRef, start, end) {
    const snapshot = await userRef.collection('transactions')
        .where('createdAt', '>=', start)
        .where('createdAt', '<=', end)
        .get();

    let totalRange = 0;
    const categories = {};

    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.type === 'expense') {
            const amt = parseFloat(data.amount || 0);
            totalRange += amt;
            const cat = data.category || 'Others';
            categories[cat] = (categories[cat] || 0) + amt;
        }
    });

    let topCategory = '';
    let topCategoryAmount = 0;
    for (const [cat, amt] of Object.entries(categories)) {
        if (amt > topCategoryAmount) {
            topCategory = cat;
            topCategoryAmount = amt;
        }
    }

    return { totalRange, topCategory, topCategoryAmount };
}

function getLastFourWeeksRange() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 28);
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: now.toISOString() };
}

function calculateNextPayDate(lastPay, frequency) {
    const date = new Date(lastPay);
    switch (frequency) {
        case 'weekly':
            date.setDate(date.getDate() + 7);
            break;
        case 'biweekly':
            date.setDate(date.getDate() + 14);
            break;
        case 'four_weekly':
            date.setDate(date.getDate() + 28);
            break;
        case 'monthly':
        default:
            date.setMonth(date.getMonth() + 1);
            break;
    }
    return date;
}

// Start Server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment:`);
  console.log(`- FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  
  // Migration for UK users
  await runMigration();

  // Initial run in 10 seconds to not block startup
  setTimeout(checkProactiveMessages, 10000);
});

async function runMigration() {
    console.log('🛠️ [Migration] Checking for users to upgrade to UK Mode...');
    try {
        const usersSnapshot = await db.collection('usuarios').get();
        let upgradeCount = 0;
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const sender = doc.id;
            if (!sender.startsWith('55') && !userData.features?.ukMode) {
                await doc.ref.update({ 'features.ukMode': true });
                upgradeCount++;
            }
        }
        if (upgradeCount > 0) console.log(`✅ [Migration] Upgraded ${upgradeCount} users to UK Mode.`);
    } catch (err) {
        console.error('❌ [Migration] Error:', err.message);
    }
}
