
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import admin from 'firebase-admin';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import authMiddleware from './authMiddleware.js';
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
app.use(cookieParser());
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

/**
 * Passo 1: Atualizar o Modelo de Usuário (Firestore)
 * Garante que o usuário possua um accessToken seguro.
 */
async function generateUserToken(phoneNumber) {
  const userRef = db.collection('usuarios').doc(phoneNumber);
  const userSnap = await userRef.get();
  let userData = userSnap.data();

  if (userData?.accessToken) {
    return userData.accessToken;
  }

  const newToken = uuidv4();
  await userRef.set({ accessToken: newToken }, { merge: true });
  console.log(`[Auth] 🔑 Generated new token for ${phoneNumber}: ${newToken}`);
  return newToken;
}

/**
 * Passo 2: Criar Endpoint de Troca de Token (Login)
 */
app.post('/auth/login', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const usersSnapshot = await db.collection('usuarios')
      .where('accessToken', '==', token)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.warn(`[Auth] ❌ Invalid token attempt: ${token}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const phoneNumber = userDoc.id;

    // Gere um JWT assinado
    const sessionToken = jwt.sign(
      { uid: userDoc.id, phoneNumber: phoneNumber },
      process.env.JWT_SECRET || 'penny-secret-key',
      { expiresIn: '7d' }
    );

    // Defina o cookie penny_session
    res.cookie('penny_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    });

    console.log(`[Auth] ✅ Session created for ${phoneNumber}`);
    res.json({ 
      success: true, 
      user: { 
        phoneNumber: phoneNumber,
        onboarding_complete: userData.onboarding_complete 
      } 
    });
  } catch (error) {
    console.error('[Auth] ❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Rota /api/me (Validação)
 */
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const userRef = db.collection('usuarios').doc(req.user.phoneNumber);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        phoneNumber: req.user.phoneNumber,
        ...userSnap.data()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user data' });
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

    if (upperText === '#RESET') {
        console.log(`🗑️ [Reset] Native reset triggered for ${sender}`);
        await userRef.update({
            monthlyIncome: admin.firestore.FieldValue.delete(),
            hourlyRate: admin.firestore.FieldValue.delete(),
            weeklyHours: admin.firestore.FieldValue.delete(),
            incomeType: admin.firestore.FieldValue.delete(),
            payFrequency: admin.firestore.FieldValue.delete(),
            payDay: admin.firestore.FieldValue.delete(),
            lastPayDate: admin.firestore.FieldValue.delete(),
            nextEstimatedPayDate: admin.firestore.FieldValue.delete(),
            lastProactivePrompt: admin.firestore.FieldValue.delete(),
            lastAction: admin.firestore.FieldValue.delete(),
            onboarding_complete: false,
            hasSyncedBalance: admin.firestore.FieldValue.delete()
        });
        
        const txs = await userRef.collection('transactions').get();
        const batch = db.batch();
        txs.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        const reply = isBrazil 
            ? "🗑️ *Perfil resetado!* Vamos recomeçar do zero. Me mande um 'Oi' para iniciar!"
            : "🗑️ *Profile reset!* I've cleared everything. Send me a 'Hi' to start fresh!";
        await sendMessage(instance, sender, reply);
        return;
    }
    
    console.log(`[Background] 🤖 Region detected: ${isBrazil ? 'Brazil (PT-BR/R$)' : 'International (EN-GB/£)'}`);
    
    // Calculate current balance and totals for the AI
    const totals = await calculateUserTotals(userRef, isBrazil, userData);
    const { totalDia, totalMes, currentBalance } = totals;
    
    // --- DETERMINISTIC STATE MACHINE (v4) ---
    const determineCurrentStep = (data) => {
        if (!data.onboarding_complete) {
            if (!data.incomeType) return "INCOME_TYPE";
            if (data.incomeType === 'hourly') {
                if (!data.hourlyRate) return "ASK_HOURLY_RATE";
                if (!data.weeklyHours) return "ASK_WEEKLY_HOURS";
            } else {
                if (!data.monthlyIncome) return "ASK_MONTHLY_INCOME";
            }
            if (!data.hasSyncedBalance) return "INITIAL_BALANCE";
        }
        return "ACTIVE";
    };

    const currentStep = determineCurrentStep(userData);
    console.log(`[Machine] 🚩 Current Step: ${currentStep}`);

    const aiState = {
      incomeType: userData.incomeType || null,
      monthlyIncome: userData.monthlyIncome || null,
      hourlyRate: userData.hourlyRate || null,
      weeklyHours: userData.weeklyHours || null,
      payFrequency: userData.payFrequency || null,
      currentBalance: currentBalance,
      totalToday: totalDia,
      totalMonth: totalMes,
      totalWeek: totals.totalSemana,
      healthRatioMonth: totals.healthRatioMonth,
      healthRatioWeek: totals.healthRatioWeek,
      lastAction: userData.lastAction || 'none',
      onboardingStep: currentStep, 
      dashboard_link: `https://penny-finance.vercel.app/login?token=${await generateUserToken(sender)}`
    };

    let transactionData = null;
    try {
      // Pass the explicit objective to the AI
      transactionData = await extractFinancialData(text, aiState, isBrazil, currentStep);
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

    // Update user state (General Interaction)
    const updateData = { 
      lastInteraction: new Date().toISOString(),
      lastAction: transactionData.intent,
      updatedAt: new Date().toISOString()
    };

    // No longer trust AI to decide "next_question" - we calculate it next turn
    await userRef.set(updateData, { merge: true });

    if (transactionData.intent === 'SET_INCOME_TYPE') {
      const type = transactionData.income_type;
      console.log(`[Background] 💰 Value extracted: incomeType = ${type}`);
      await userRef.update({ incomeType: type });
    }

    if (transactionData.intent === 'SET_HOURLY_RATE') {
        const rate = parseFloat(transactionData.hourly_rate);
        console.log(`[Background] 💰 Value extracted: hourlyRate = ${rate}`);
        await userRef.update({ hourlyRate: rate });
    }

    if (transactionData.intent === 'SET_WEEKLY_HOURS') {
        const hours = parseFloat(transactionData.weekly_hours);
        console.log(`[Background] 💰 Value extracted: weeklyHours = ${hours}`);
        const rate = userData.hourlyRate || 0;
        const estMonthly = (rate * hours * 4.33);
        await userRef.update({ 
            weeklyHours: hours,
            estimatedMonthlyIncome: estMonthly,
            monthlyIncome: estMonthly
        });
    }

    if (transactionData.intent === 'SET_MONTHLY_INCOME') {
      const income = parseFloat(transactionData.monthly_income);
      console.log(`[Background] 💰 Value extracted: monthlyIncome = ${income}`);
      await userRef.update({ 
          monthlyIncome: income,
          incomeType: 'monthly'
      });
    }

    if (transactionData.intent === 'SET_CURRENT_BALANCE') {
        const reportedBalance = parseFloat(transactionData.amount);
        console.log(`[Background] 🏦 Setting Initial Balance: ${reportedBalance}`);
        
        // 1. Calculate Adjustment
        // We use monthlyIncome as the "theoretical start" and adjust to reach the reportedBalance.
        const currentTotals = await calculateUserTotals(userRef, isBrazil);
        const incomeAsRef = userData.monthlyIncome || userData.estimatedMonthlyIncome || 0;
        
        // Current balance in system is just totalIncome - totalExpenses.
        // Onboarding creates NO income yet, so currentBalance is 0.
        // We want to force it to reportedBalance by creating an adjustment.
        // If they have £200, and they should have had £2598 (income), they spent £2398.
        const diff = incomeAsRef - reportedBalance;
        
        console.log(`[Background] ⚖️ Creating bridge income: ${incomeAsRef}`);
        await userRef.collection('transactions').add({
            amount: incomeAsRef,
            type: 'income',
            category: 'Onboarding',
            description: isBrazil ? 'Renda Inicial' : 'Initial Income',
            createdAt: new Date().toISOString()
        });

        if (diff !== 0) {
            console.log(`[Background] ⚖️ Creating adjustment transaction: ${diff}`);
            await userRef.collection('transactions').add({
                amount: Math.abs(diff),
                type: diff > 0 ? 'expense' : 'income',
                category: 'Adjustment',
                description: isBrazil ? 'Ajuste de Saldo Inicial' : 'Initial Balance Adjustment',
                createdAt: new Date().toISOString()
            });
        }
        
        await userRef.update({ 
            onboarding_step: "ACTIVE",
            onboarding_complete: true,
            hasSyncedBalance: true,
            lastAction: 'ONBOARDING_COMPLETE'
        });
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

    if (transactionData.intent === 'SET_PAY_FREQUENCY') {
      const frequency = transactionData.pay_frequency;
      console.log(`[Background] 📅 Setting pay frequency: ${frequency}`);
      await userRef.update({ payFrequency: frequency });
    }

    if (transactionData.intent === 'SET_PAYDAY') {
      const day = parseInt(transactionData.payday);
      console.log(`[Background] 📅 Setting payday: ${day}`);
      await userRef.update({ payDay: day });
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
        hourlyRate: admin.firestore.FieldValue.delete(),
        weeklyHours: admin.firestore.FieldValue.delete(),
        incomeType: admin.firestore.FieldValue.delete(),
        payFrequency: admin.firestore.FieldValue.delete(),
        payDay: admin.firestore.FieldValue.delete(),
        lastPayDate: admin.firestore.FieldValue.delete(),
        nextEstimatedPayDate: admin.firestore.FieldValue.delete(),
        lastProactivePrompt: admin.firestore.FieldValue.delete(),
        lastAction: admin.firestore.FieldValue.delete(),
        onboarding_step: "INCOME_TYPE",
        onboarding_complete: false,
        hasSyncedBalance: admin.firestore.FieldValue.delete()
      });
      
      const txs = await userRef.collection('transactions').get();
      const batch = db.batch();
      txs.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      if (!transactionData.response_message && source === 'whatsapp-evolution') {
        const reply = isBrazil 
          ? `🗑️ *Perfil resetado!* Vamos recomeçar do zero. Como você recebe sua renda? 1️⃣ Por hora, 2️⃣ Semanal, 3️⃣ Quinzenal, 4️⃣ Mensal / Contrato`
          : `🗑️ *Profile reset!* Let's start from scratch. How do you receive your income? 1️⃣ Hourly, 2️⃣ Weekly, 3️⃣ Fortnightly, 4️⃣ Monthly / Contract`;
        await sendMessage(instance, sender, reply);
      }
    }

    // --- LOW BALANCE ANXIETY MODE ---
    // Only trigger if onboarding is complete and it's an expense
    if (userData.onboarding_complete && !isBrazil && (transactionData.intent === 'ADD_EXPENSE' || transactionData.intent === 'MULTIPLE_EXPENSES')) {
        const { currentBalance: newBalance } = await calculateUserTotals(userRef, isBrazil, userData);
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
async function calculateUserTotals(userRef, isBrazil, userData = {}) {
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

  // --- PACE METRICS (v5) ---
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthProgress = dayOfMonth / daysInMonth;
  
  // Weekly progress
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon, 7=Sun
  const weekProgress = dayOfWeek / 7;

  const monthlyIncome = userData.monthlyIncome || 0;
  const weeklyIncome = userData.estimatedWeeklyIncome || (monthlyIncome / 4.33) || 0;

  // Expected vs Actual (Monthly)
  const expectedMonthlySoFar = monthlyIncome * monthProgress;
  const healthRatioMonth = expectedMonthlySoFar > 0 ? (totalMes / expectedMonthlySoFar) : 0;

  // Expected vs Actual (Weekly) - Using current week totals
  const { totalRange: totalSemana } = await calculateRangeTotals(userRef, getCurrentWeekToNowRange().start, getCurrentWeekToNowRange().end);
  const expectedWeeklySoFar = weeklyIncome * weekProgress;
  const healthRatioWeek = expectedWeeklySoFar > 0 ? (totalSemana / expectedWeeklySoFar) : 0;

  return {
    totalDia,
    totalMes,
    totalSemana,
    totalIncome,
    totalExpenses,
    currentBalance: totalIncome - totalExpenses,
    monthProgress,
    weekProgress,
    healthRatioMonth,
    healthRatioWeek,
    statusMonth: healthRatioMonth <= 0.9 ? 'EXCELLENT' : healthRatioMonth <= 1.05 ? 'NORMAL' : healthRatioMonth <= 1.25 ? 'ATTENTION' : 'RISK',
    statusWeek: healthRatioWeek <= 0.9 ? 'EXCELLENT' : healthRatioWeek <= 1.05 ? 'NORMAL' : healthRatioWeek <= 1.25 ? 'ATTENTION' : 'RISK'
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

      // Only prompt if last prompt was > 30 mins ago AND onboarding is complete
      if (userData.onboarding_complete && lastPrompt < thirtyMinsAgo) {
        const isBrazil = userId.startsWith('55');
        const instance = userData.instance || 'penny-instance';
        
        // Revised proactive logic: only nudges for expenses if they haven't sent any in 24h
        const monthStr = new Date().toISOString().substring(0, 7);
        const dayTxs = await doc.ref.collection('transactions')
          .where('createdAt', '>=', new Date(now.getTime() - 24 * 60 * 60000).toISOString())
          .limit(1)
          .get();

        if (dayTxs.empty) {
          const message = isBrazil
            ? "Oi! Passando para ver se você teve algum gasto hoje que esqueceu de anotar. 📝"
            : "Hi! Just checking if you had any expenses today that you forgot to track. 📝";
          
          console.log(`🕒 [Proactive] Sending nudge to ${userId}`);
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
      if (!userData.onboarding_complete) continue;
      
      const sender = doc.id;
      const isBrazil = sender.startsWith('55');
      const instance = userData.instance || 'penny-instance';

      const totals = await calculateUserTotals(doc.ref, isBrazil, userData);
      const { totalDia, totalMes, currentBalance, healthRatioMonth, healthRatioWeek, statusMonth, statusWeek } = totals;
      const formatVal = (val) => val.toLocaleString(isBrazil ? 'pt-BR' : 'en-GB', { minimumFractionDigits: 2 });
      
      let reportMsg = "";
      const paceMessage = (ratio, isBr) => {
          if (ratio <= 0.9) return isBr ? "Você está gastando abaixo do esperado 👍" : "You’re spending below expectation 👍";
          if (ratio <= 1.05) return isBr ? "Seus gastos estão dentro do planejado." : "You’re on track.";
          if (ratio <= 1.25) return isBr ? "Atenção: Você está gastando mais rápido que o esperado." : "Attention: You’re spending faster than expected.";
          return isBr ? "Risco: Seus gastos estão acima do limite para este momento do mês." : "Risk: You’re overspending for this point in the month.";
      };

      if (isBrazil) {
        reportMsg = `🌙 *Resumo do Dia - Penny*\n\n` +
          `Hoje: *R$${formatVal(totalDia)}*\n` +
          `No Mês: R$${formatVal(totalMes)}\n` +
          `Status: ${paceMessage(healthRatioMonth, true)}\n` +
          `Saldo atual: *R$${formatVal(currentBalance)}*\n\n` +
          `Tenha uma ótima noite! 😴`;
      } else {
        reportMsg = `🌙 *Daily Summary - Penny*\n\n` +
          `Today: *£${formatVal(totalDia)}*\n` +
          `Weekly Total: £${formatVal(totalSemana)}\n` +
          `Pace: ${paceMessage(healthRatioWeek, false)}\n` +
          `Balance: *£${formatVal(currentBalance)}*\n\n` +
          `Have a great night! 😴`;
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

            const totals = await calculateUserTotals(doc.ref, false, userData);
            const { healthRatioWeek, totalSemana } = totals;

            let reportMsg = `📊 *Weekly Close*\n\n`;
            
            if (healthRatioWeek <= 1.0) {
                reportMsg += `Excllent! You stayed within your budget this week (£${totalSemana.toFixed(2)}).`;
            } else {
                const overPercent = ((healthRatioWeek - 1) * 100).toFixed(0);
                reportMsg += `You've spent *${overPercent}% more* than expected for this week (£${totalSemana.toFixed(2)}).`;
            }
            
            // Micro Feedback Positivo
            if (healthRatioWeek < 0.8 && userData.lastPositiveFeedbackWeek !== yearWeek) {
                reportMsg += "\n\n🌟 Great job maintaining a healthy spending pace!";
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
