
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
import { sendMessage, logoutInstance, deleteInstance, sendPresence } from './lib/evolution.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Update this list with authorized phone numbers (only digits)
const ALLOWED_NUMBERS = [
  '557391082831', // User Primary Number
];

app.use(cors({
  origin: ['https://penny-finance.vercel.app', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
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
      secure: true, // Deve ser true para SameSite: None
      sameSite: 'None', 
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
  let replied = false; 
  let isBrazil = sender.startsWith('55'); 

  try {
    // 1. Feedback Visual Imediato (Digitando...)
    if (source === 'whatsapp-evolution') {
      sendPresence(instance, sender, "composing").catch(() => {});
    }

    console.log(`[Background] 💬 Processing from ${sender} (${source}): ${text}`);

    // --- WHITELIST CHECK ---
    const cleanSender = sender.replace(/\D/g, '');
    const isAllowed = ALLOWED_NUMBERS.some(num => cleanSender.includes(num));

    if (!isAllowed) {
       console.log(`[Security] ⛔ Blocked unauthorized number: ${sender}`);
       return; 
    }

    // Lógica de Timeout (Safety Net)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("PROCESS_TIMEOUT")), 15000);
    });

    const executionPromise = (async () => {
        const userRef = db.collection('usuarios').doc(sender);
        const userSnap = await userRef.get();
        const userData = userSnap.data() || {};
        
        if (userData.features?.ukMode === true) isBrazil = false;

        // --- COMMANDS ---
        const upperText = text.toUpperCase();
        if (upperText === '#DESARMAR') {
          console.log(`🚨 [PANIC] Disarm command received from ${sender}. Logging out instance ${instance}...`);
          await sendMessage(instance, sender, isBrazil ? "⚠️ *COMANDO DE DESARME ATIVADO!* Desconectando este número agora para sua segurança..." : "⚠️ *DISARM COMMAND ACTIVATED!* Disconnecting this number now for your security...");
          replied = true;
          try {
            await logoutInstance(instance);
          } catch (err) {
            await deleteInstance(instance);
          }
          return;
        }

        if (upperText === '#UKMODE') {
            await userRef.set({ features: { ukMode: true } }, { merge: true });
            await sendMessage(instance, sender, "🇬🇧 *UK Mode Enabled!* Send #RESET to start the UK onboarding flow.");
            replied = true;
            return;
        }

        if (upperText === '#RESET') {
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
            replied = true;
            return;
        }
        
        // --- DATA CALC ---
        const totals = await calculateUserTotals(userRef, isBrazil, userData);
        
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
        const aiState = {
          incomeType: userData.incomeType || null,
          monthlyIncome: userData.monthlyIncome || null,
          hourlyRate: userData.hourlyRate || null,
          weeklyHours: userData.weeklyHours || null,
          payFrequency: userData.payFrequency || null,
          currentBalance: totals.currentBalance,
          totalToday: totals.totalDia,
          totalMonth: totals.totalMes,
          totalWeek: totals.totalSemana,
          healthRatioMonth: totals.healthRatioMonth,
          healthRatioWeek: totals.healthRatioWeek,
          lastAction: userData.lastAction || 'none',
          onboardingStep: currentStep, 
          dashboard_link: `https://penny-finance.vercel.app/?token=${await generateUserToken(sender)}`
        };

        // --- AI CALL ---
        const transactionData = await extractFinancialData(text, aiState, isBrazil, currentStep);
        
        if (replied) return;

        if (!transactionData || transactionData.intent === 'NO_ACTION') {
          if (transactionData?.response_message && source === 'whatsapp-evolution') {
            await sendMessage(instance, sender, transactionData.response_message);
          }
          replied = true;
          return;
        }

        // --- EXECUTE DECISION ---
        await userRef.set({ 
          lastInteraction: new Date().toISOString(),
          lastAction: transactionData.intent,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Intent Logic
        if (transactionData.intent === 'SET_INCOME_TYPE') await userRef.update({ incomeType: transactionData.income_type });
        if (transactionData.intent === 'SET_HOURLY_RATE') await userRef.update({ hourlyRate: parseFloat(transactionData.hourly_rate) });
        if (transactionData.intent === 'SET_WEEKLY_HOURS') {
            const hours = parseFloat(transactionData.weekly_hours);
            const rate = userData.hourlyRate || 0;
            const estMonthly = (rate * hours * 4.33);
            await userRef.update({ weeklyHours: hours, monthlyIncome: estMonthly });
        }
        if (transactionData.intent === 'SET_MONTHLY_INCOME') await userRef.update({ monthlyIncome: parseFloat(transactionData.monthly_income), incomeType: 'monthly' });
        
        if (transactionData.intent === 'SET_CURRENT_BALANCE') {
            const reportedBalance = parseFloat(transactionData.amount);
            const incomeAsRef = userData.monthlyIncome || 0;
            const diff = incomeAsRef - reportedBalance;
            await userRef.collection('transactions').add({ amount: incomeAsRef, type: 'income', category: 'Onboarding', description: isBrazil ? 'Renda Inicial' : 'Initial Income', createdAt: new Date().toISOString() });
            if (diff !== 0) {
                await userRef.collection('transactions').add({ amount: Math.abs(diff), type: diff > 0 ? 'expense' : 'income', category: 'Adjustment', description: isBrazil ? 'Ajuste de Saldo Inicial' : 'Initial Balance Adjustment', createdAt: new Date().toISOString() });
            }
            await userRef.update({ onboarding_complete: true, hasSyncedBalance: true });
        }

        if (transactionData.intent === 'ADD_EXPENSE' || transactionData.intent === 'MULTIPLE_EXPENSES') {
            const expenses = transactionData.expenses || [];
            if (expenses.length === 0 && transactionData.amount) {
              expenses.push({ amount: transactionData.amount, category: transactionData.category || 'General', item: text });
            }
            for (const exp of expenses) {
              await userRef.collection('transactions').add({
                amount: parseFloat(exp.amount),
                type: 'expense',
                category: exp.category || 'General',
                description: exp.item || (isBrazil ? 'Gasto registrado' : 'Recorded expense'),
                createdAt: new Date().toISOString(),
                intent: 'ADD_EXPENSE'
              });
            }
        }
        
        // ... (other intents like REMOVE_EXPENSE, CORRECTION etc could be re-added if needed, but keeping core for now)
        if (transactionData.intent === 'REMOVE_EXPENSE') {
            const lastTxSnap = await userRef.collection('transactions').orderBy('createdAt', 'desc').limit(1).get();
            if (!lastTxSnap.empty) await lastTxSnap.docs[0].ref.delete();
        }

        if (transactionData.intent === 'SET_WEEKLY_HOURS_OVERRIDE') {
            await userRef.update({ currentWeekHoursOverride: parseFloat(transactionData.weekly_hours) });
        }

        if (transactionData.intent === 'SET_PAYDAY_TODAY') {
            const now = new Date();
            const nextDate = calculateNextPayDate(now, userData.payFrequency || 'monthly');
            await userRef.update({ lastPayDate: now.toISOString(), nextEstimatedPayDate: nextDate.toISOString() });
        }

        if (transactionData.intent === 'SET_PAY_FREQUENCY') await userRef.update({ payFrequency: transactionData.pay_frequency });
        if (transactionData.intent === 'SET_PAYDAY') await userRef.update({ payDay: parseInt(transactionData.payday) });
        
        if (transactionData.intent === 'ADD_BALANCE') {
          await userRef.collection('transactions').add({
            amount: parseFloat(transactionData.balance_change || 0),
            type: 'income',
            category: 'General',
            description: text,
            createdAt: new Date().toISOString(),
            intent: 'ADD_BALANCE'
          });
        }

        if (transactionData.intent === 'CORRECTION') {
          if (transactionData.monthly_income) await userRef.update({ monthlyIncome: transactionData.monthly_income });
          if (transactionData.payday) await userRef.update({ payDay: transactionData.payday });
        }

        // --- LOW BALANCE ANXIETY MODE ---
        if (userData.onboarding_complete && !isBrazil && (transactionData.intent === 'ADD_EXPENSE' || transactionData.intent === 'MULTIPLE_EXPENSES')) {
            const { currentBalance: newBalance } = await calculateUserTotals(userRef, isBrazil, userData);
            const todayStr = new Date().toISOString().split('T')[0];
            if (newBalance < 50 && userData.lastLowBalanceAlertDate !== todayStr) {
                await sendMessage(instance, sender, "⚠️ Your balance is getting low (£" + newBalance.toFixed(2) + ").");
                await userRef.update({ lastLowBalanceAlertDate: todayStr });
            }
        }

        // --- FINAL RESPONSE ---
        if (source === 'whatsapp-evolution' && transactionData.response_message) {
          await sendMessage(instance, sender, transactionData.response_message);
        }
        replied = true;
    })();

    await Promise.race([executionPromise, timeoutPromise]);

  } catch (error) {
    if (replied) return;
    replied = true;
    console.error(`[Background] ❌ Process Error: ${error.message}`);
    const errorMsg = isBrazil 
      ? `❌ *Nossos servidores estão com problemas*, espere um momento.`
      : `❌ *Our servers are having trouble*, please wait a moment.`;
    await sendMessage(instance, sender, errorMsg);
  } finally {
    if (source === 'whatsapp-evolution') {
      sendPresence(instance, sender, "available").catch(() => {});
    }
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
app.post('/webhook', async (req, res) => {
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
      const from = message.from;
      
      // 🔒 Whitelist check FIRST (Silent Ignore)
      const isAllowedMeta = ALLOWED_NUMBERS.some(num => from.includes(num));
      if (!isAllowedMeta) {
        console.log(`ℹ️ Meta: Ignorando mensagem de número não autorizado: ${from}`);
        return;
      }

      // --- GATEKEEPER (META) ---
      if (message.type === 'audio' || message.type === 'voice') {
        await sendMessage('OfficialMeta', from, "I haven't got ears yet 👂");
        return;
      }
      if (message.type === 'image' || message.type === 'video' || message.type === 'sticker') {
        await sendMessage('OfficialMeta', from, "I can't see photos yet 📷");
        return;
      }

      if (message.type === 'text') {
        const textBody = message.text.body || "";
        if (textBody.length > 200) {
          await sendMessage('OfficialMeta', from, "Your message is too long, mate. Please keep it short. 📉");
          return;
        }
        processMessageBackground(textBody, from, 'OfficialMeta', 'whatsapp-meta');
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
      const sender = key?.remoteJid?.split('@')[0];

      // 🔒 Whitelist check FIRST (Silent Ignore)
      if (!sender || !ALLOWED_NUMBERS.some(num => sender.includes(num))) {
        console.log(`ℹ️ Evolution: Ignorando mensagem de número não autorizado: ${sender}`);
        return;
      }

      // --- GATEKEEPER (EVOLUTION) ---
      const isAudio = message?.audioMessage || message?.pttMessage;
      const isVisual = message?.imageMessage || message?.videoMessage || message?.stickerMessage;
      const isDoc = message?.documentMessage || message?.documentWithCaptionMessage;
      
      if (isAudio) {
        console.log(`ℹ️ [Gatekeeper] Audio detected from ${sender}`);
        await sendMessage(instance, sender, "I haven't got ears yet 👂");
        return;
      }
      if (isVisual || isDoc) {
        console.log(`ℹ️ [Gatekeeper] Media/Doc detected from ${sender}`);
        await sendMessage(instance, sender, "I can't see photos yet 📷");
        return;
      }

      const text = message?.conversation || message?.extendedTextMessage?.text || message?.imageMessage?.caption || "";
      
      console.log(`ℹ️ Evolution: From=${sender}, Text=${text}`);

      if (text && sender) {
        // --- LENGTH CHECK ---
        if (text.length > 200) {
          console.log(`ℹ️ [Gatekeeper] Message too long (${text.length} chars) from ${sender}`);
          await sendMessage(instance, sender, "Your message is too long, mate. Please keep it short. 📉");
          return;
        }

        // Whitelist was already checked at the top of Case 2
        processMessageBackground(text, sender, instance, 'whatsapp-evolution');
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
