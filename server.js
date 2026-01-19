import 'dotenv/config';

import express from 'express';
import paypal from '@paypal/checkout-server-sdk';
import cors from 'cors';
import cron from 'node-cron';
import admin from 'firebase-admin';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import authMiddleware from './authMiddleware.js';
import { startBaileys, sendBaileysMessage } from './lib/baileys.js';
import { extractFinancialData, generatePennyInsight } from './lib/openai.js';
import { formatCurrency, getCurrencySymbol } from './lib/currency.js'; // Helper de moeda


import { db } from './lib/firebase.js';
// Evolution imports removed
// Evolution removed
import { generateSubscriptionLink } from './services/paypalService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';


// Wrappers for compatibility
// --- FUNÇÕES DE ENVIO REFATORADAS (Provider Agnostic) ---

// --- FUNÇÕES DE ENVIO REFATORADAS (Baileys Only) ---

async function sendMessage(instance, phone, text, socket = null) {
  // 1. Tenta via Baileys (Socket Explícito ou Global via lib)
  // Nota: sendBaileysMessage já lida com socket=null buscando o globalSock
  try {
      await sendBaileysMessage(socket, phone, text);
  } catch (e) {
      console.error(`❌ [SendMessage] Failed to send to ${phone}:`, e.message);
      // Sem fallback. Se falhar, falhou.
      // Retornar erro para debug se necessário
      throw e;
  }
}

async function sendPresence(instance, phone, type, socket = null) {
  if (socket) {
      if (type === 'composing') {
          return socket.sendPresenceUpdate('composing', phone).catch(() => {});
      } else {
          return socket.sendPresenceUpdate('paused', phone).catch(() => {});
      }
  }
}


import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dotenv.config(); // Removed - loaded at top

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://penny-finance.vercel.app', 'https://penny-finance-backend.fly.dev', 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5500'],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 8080;

// --- REAL-TIME PRESENCE ---
io.on('connection', (socket) => {
  const role = socket.handshake.query.role;
  
  if (role === 'quiz_user') {
    socket.join('quiz_users');
    broadcastQuizCount();
    console.log(`[Socket] Quiz User Connected. ID: ${socket.id}`);
  }

  socket.on('disconnect', () => {
    if (role === 'quiz_user') {
      // Small delay to ensure room update
      setTimeout(() => broadcastQuizCount(), 1000); 
    }
  });
});

function broadcastQuizCount() {
  const count = io.sockets.adapter.rooms.get('quiz_users')?.size || 0;
  io.emit('update_online', count);
  console.log(`[Socket] Online Quiz Users: ${count}`);
}

// Update this list with authorized phone numbers (only digits)
const ALLOWED_NUMBERS = [
  '557391082831', // User Primary Number
  '447446196108', // New Authorized Number
];

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
// --- NINJA DEBUG LOGGER ---
app.use((req, res, next) => {
  console.log(`[NINJA DEBUG] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

// Evolution Webhook Removed (Legacy)

// Facebook Webhook Verification (Caso ainda usem Meta API futuramente)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === 'penny123') {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// --- SERVE REACT STATIC FILES ---
app.use(express.static(path.join(__dirname, 'client/dist')));
app.use('/original-quiz', express.static(path.join(__dirname, 'quiz')));

// --- HELPER FUNCTIONS ---


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
  if (!token) return res.status(400).json({ error: 'Token obrigatório' });

  try {
    const usersRef = db.collection('usuarios');
    const snapshot = await usersRef.where('accessToken', '==', token).get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const phoneNumber = userDoc.id;

    // Gerar JWT
    const jwtToken = jwt.sign({ uid: phoneNumber }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'None',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ success: true, user: { phoneNumber, ...userData } });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// --- ANALYTICS ROUTES ---

// 1. Track Step (POST)
app.post('/api/analytics/track', async (req, res) => {
  const { step } = req.body;
  if (!step) {
    return res.status(400).send({ error: 'Step is required' });
  }

  // Use the admin instance previously imported
  const analyticsRef = db.collection('analytics').doc('quiz_funnel');
  
  // Create hourly key (e.g., "2026-01-09T18")
  const hourKey = new Date().toISOString().slice(0, 13);
  const hourlyRef = db.collection('analytics_hourly').doc(hourKey);

  try {
    const batch = db.batch();

    // 1. Update Global Aggregate
    batch.set(analyticsRef, {
      [step]: admin.firestore.FieldValue.increment(1),
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Update Hourly History
    batch.set(hourlyRef, {
      hour: hourKey,
      [step]: admin.firestore.FieldValue.increment(1),
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();

    res.status(200).send({ success: true });
  } catch (error) {
    console.error('Analytics Write Error:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// 2. Get Stats (GET)
app.get('/api/analytics/stats', async (req, res) => {
  try {
    const analyticsRef = db.collection('analytics').doc('quiz_funnel');
    const doc = await analyticsRef.get();
    if (!doc.exists) {
      return res.json({});
    }
    res.json(doc.data());
  } catch (error) {
    console.error('Analytics Read Error:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// 3. Get Hourly History (GET)
app.get('/api/analytics/hourly', async (req, res) => {
  try {
    const snapshot = await db.collection('analytics_hourly')
      .orderBy('hour', 'desc')
      .limit(24)
      .get();

    const history = [];
    snapshot.forEach(doc => {
      history.push(doc.data());
    });

    // Return chronological order (oldest to newest)
    res.json(history.reverse());
  } catch (error) {
    console.error('Analytics History Error:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// --- PAYPAL CONFIGURATION ---

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_SECRET;

let environment;
if (process.env.PAYPAL_MODE === 'live') {
    environment = new paypal.core.LiveEnvironment(clientId, clientSecret);
    console.log("💳 PayPal: Ambiente LIVE (Produção) ativado!");
} else {
    environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
    console.log("🧪 PayPal: Ambiente SANDBOX (Teste) ativado.");
}
let client = new paypal.core.PayPalHttpClient(environment);

// --- PAYPAL ROUTES ---

app.post('/api/create-order', async (req, res) => {
    const { whatsappNumber } = req.body; 

    // Validação básica
    if (!whatsappNumber) {
        return res.status(400).json({ error: "WhatsApp é obrigatório" });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: { currency_code: 'GBP', value: '9.99' },
            description: "Penny Premium Subscription",
            // O SEGRED0 ESTÁ AQUI: Enviamos o Zap dentro do pedido
            custom_id: whatsappNumber 
        }]
    });

    try {
        const order = await client.execute(request);
        res.json({ id: order.result.id });
    } catch (e) {
        console.error("Erro ao criar pedido:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA DE CAPTURA (O seu "Webhook" que libera o Firebase) ---
app.post('/api/capture-order', async (req, res) => {
    const { orderID } = req.body;
    console.log(`[DEBUG] Tentando capturar pedido: ${orderID}`);

    if (!db) {
        console.error("❌ ERRO CRÍTICO: DB não inicializado (db is null)");
        return res.status(500).json({ error: "Database not initialized" });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    try {
        const capture = await client.execute(request);
        
        // LOGAR O RESULTADO DO PAYPAL PARA VER SE O WHATSAPP VEIO
        console.log('[DEBUG] Resposta do PayPal:', JSON.stringify(capture.result, null, 2));

        if (capture.result.status === 'COMPLETED') {
            
            // Tenta pegar o WhatsApp em dois lugares (para garantir)
            // 1. No purchase_units (onde mandamos)
            // 2. No payer info (caso o usuário tenha preenchido no PayPal)
            const captureUnit = capture.result.purchase_units[0].payments.captures[0];
            const whatsappDoUsuario = captureUnit.custom_id || capture.result.payer.email_address; // Fallback para email se der ruim

            console.log(`[DEBUG] WhatsApp recuperado: ${whatsappDoUsuario}`);

            if (!whatsappDoUsuario) {
                throw new Error("O campo custom_id (WhatsApp) veio vazio do PayPal!");
            }

            try {
                // TENTATIVA DE SALVAR NO FIREBASE
                console.log('[DEBUG] Tentando salvar no Firestore...');
                
                await db.collection('usuarios').doc(whatsappDoUsuario).set({
                    status: 'active',
                    plan: 'premium',
                    createdAt: new Date().toISOString(),
                    lastPaymentID: capture.result.id,
                    phone: whatsappDoUsuario,
                    updatedAt: new Date().toISOString()
                }, { merge: true });

                console.log('[DEBUG] Sucesso ao salvar no Firestore!');
                
                return res.json({ status: 'COMPLETED', user: whatsappDoUsuario });

            } catch (firebaseError) {
                // AQUI ESTÁ O SEU ERRO ATUAL
                console.error('❌ ERRO CRÍTICO NO FIREBASE:', firebaseError);
                // Mesmo que o Firebase falhe, o pagamento foi feito. 
                // Retornamos sucesso para o front não dar erro, mas logamos o problema.
                return res.json({ status: 'COMPLETED', user: whatsappDoUsuario, warning: 'Payment done but db failed', error: firebaseError.message });
            }
        }
        
        res.json({ status: capture.result.status });
        
    } catch (e) {
        console.error("❌ ERRO GERAL NA ROTA:", e);
        // O erro 500 original vinha daqui
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});




// --- STRIPE ROUTES ---
// --- STRIPE ROUTES ---
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} else {
    console.warn("⚠️ Stripe skipped: STRIPE_SECRET_KEY not found.");
}

app.post('/api/create-payment-intent', async (req, res) => {
  const { whatsappNumber } = req.body;
  if (!stripe) return res.status(503).json({ error: "Stripe not configured" });

  // Permite criar intent sem whats inicialmente se quiser, mas mantemos lógica
  // Se o frontend mandar, usamos.
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 999, // 9.99 GBP (em centavos)
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: {
        whatsapp: whatsappNumber || "Pending",
        product: "Penny Premium"
      },
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    console.error("Stripe Intent Error:", e);
    res.status(500).send({ error: e.message });
  }
});

app.post('/api/verify-payment', async (req, res) => {
    const { paymentIntentId } = req.body;
    
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status === 'succeeded') {
            // Pick whatsapp from body (passed from front) or metadata (passed during intent creation)
            const whatsapp = req.body.whatsapp || paymentIntent.metadata.whatsapp;
            
            console.log(`[STRIPE] Pagamento confirmado para: ${whatsapp}`);

            if (whatsapp && whatsapp !== "Pending" && db) {
                await db.collection('usuarios').doc(whatsapp).set({
                    status: 'active',
                    plan: 'premium',
                    createdAt: new Date().toISOString(),
                    lastPaymentID: paymentIntent.id,
                    provider: 'stripe',
                    phone: whatsapp,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                console.log('[STRIPE] Banco de dados atualizado.');
            }
            
            res.send({ success: true, user: whatsapp });
        } else {
            res.status(400).send({ error: "Payment not successful" });
        }
    } catch (e) {
        console.error("Stripe Verify Error:", e);
        res.status(500).send({ error: e.message });
    }
});

/**
 * 🔗 Gerar Link do PayPal via Web Funnel
 * Payload: { phoneNumber: "55..." }
 */
app.post('/api/pay/generate-link', async (req, res) => {
  let { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  // Sanitização: Manter apenas números
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  // Validação mínima (ex: código do país + no mínimo 8 dígitos)
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Invalid phone number. Make sure to include the country code.' });
  }

  try {
    console.log(`[API] 🔗 Gerando link do PayPal para: ${cleanPhone}`);
    const link = await generateSubscriptionLink(cleanPhone);

    if (link.startsWith('http')) {
      res.json({ url: link });
    } else {
      res.status(500).json({ error: link });
    }
  } catch (error) {
    console.error('❌ Generate Link Error:', error.message);
    res.status(500).json({ error: 'Internal error generating payment link.' });
  }
});

/**
 * 🎁 FREE TRIAL REGISTRATION
 * Rota: POST /api/trial/register
 */
app.post('/api/trial/register', async (req, res) => {
    const { phoneNumber, email } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required.' });
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');

    // Basic Validation
    if (cleanPhone.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number.' });
    }

    try {
        const userRef = db.collection('usuarios').doc(cleanPhone);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
            const userData = userSnap.data();
            // Allow re-register only if not active/premium to prevent abuse? 
            // For now, let's say: if already exists, return what it is.
            if (userData.plan === 'active' || userData.plan === 'premium') {
                return res.json({ success: true, message: 'User already active', alreadyExists: true });
            }
             // If expired trial, deny? Or allow? Policy says "2 days only".
             if (userData.trialEndDate && new Date() > new Date(userData.trialEndDate)) {
                 return res.json({ success: false, error: 'Trial expired' });
             }
        }

        // Create Trial User
        const now = new Date();
        const endDate = new Date(now.getTime() + (48 * 60 * 60 * 1000)); // +48 hours

        await userRef.set({
            phone: cleanPhone,
            email: email || '',
            plan: 'trial',
            status: 'active',
            trialStartDate: now.toISOString(),
            trialEndDate: endDate.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        }, { merge: true });

        console.log(`🎁 [TRIAL] User ${cleanPhone} registered for 2 days trial.`);
        return res.json({ success: true, redirect: `https://wa.me/${process.env.BOT_NUMBER || '557388177328'}?text=Oi` });

    } catch (error) {
        console.error('❌ Trial Register Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Rota /api/me (Validação)
 */
app.get('/api/me', authMiddleware, async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Database service unavailable' });
  }
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

/**
 * 💳 Webhook do PayPal - Confirmação de Assinatura
 * Rota: POST /webhooks/paypal
 */
app.post('/webhooks/paypal', async (req, res) => {
  const event = req.body;

  console.log('========================================');
  console.log('📦 PayPal Webhook Received:', event.event_type);
  
  try {
    // 1. Verificar se a assinatura foi ativada
    if (event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const subscription = event.resource;
      const userPhone = subscription.custom_id; // Recuperamos o telefone que enviamos no link

      if (!userPhone) {
        console.error('❌ PayPal Error: custom_id (phone) missing in payload');
        return res.status(400).send('Custom ID required');
      }

      console.log(`✅ Subscription ACTIVATED for: ${userPhone}`);

      // 2. Atualizar o Firestore para liberar o Premium
      const userRef = db.collection('usuarios').doc(userPhone);
      await userRef.set({
        plan: 'premium',
        subscriptionStatus: 'active',
        paypalSubscriptionId: subscription.id,
        premiumSince: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log(`🚀 User ${userPhone} is now PREMIUM!`);
    }

    // Retorna 200 OK para o PayPal não tentar reenviar
    res.status(200).send('Event processed');

  } catch (error) {
    console.error('❌ PayPal Webhook Error:', error.message);
    res.status(500).send('Internal Server Error');
  }
  console.log('========================================');
});

// Helper function to process message in background
// --- SMART SEND MESSAGE (Merged with sendMessage, kept for compatibility if needed) ---
async function smartSendMessage(instance, phone, text, socket = null) {
    return sendMessage(instance, phone, text, socket);
}

// Helper function to process message in background
async function processMessageBackground(text, sender, instance, source, dbUserId = null, socket = null) {
  let replied = false; 
  let isBrazil = sender.startsWith('55'); // Default guess from JID, might be wrong for LID
  let effectiveUserId = dbUserId || sender; // Use Verified Phone if available

  // If verified phone (dbUserId) exists, recalculate isBrazil based on it
  if (dbUserId) {
      isBrazil = dbUserId.startsWith('55');
  }

  try {
    // 1. Feedback Visual Imediato (Digitando...)
    // 1. Feedback Visual Imediato (Digitando...)
    if (source === 'whatsapp-evolution' || source === 'whatsapp-baileys') {
      sendPresence(instance, sender, "composing", socket).catch(() => {});
    }

    console.log(`[Background] 💬 Processing from ${sender} (DB: ${effectiveUserId}) via ${source}: ${text}`);

    // --- WHITELIST CHECK REMOVED (As requested: Open to all) ---
    // const cleanSender = sender.replace(/\D/g, '');
    // const isAllowed = ALLOWED_NUMBERS.some(num => cleanSender.includes(num));

    // if (!isAllowed) {
    //    console.log(`[Security] ⛔ Blocked unauthorized number: ${sender}`);
    //    return; 
    // }
    
    console.log(`[Security] 🔓 Access granted to: ${sender} (Open Mode)`);

    // --- TRIAL CHECK ---
    const userRefCheck = db.collection('usuarios').doc(effectiveUserId);
    const userSnapCheck = await userRefCheck.get();
    const userData = userSnapCheck.data() || {};

    if (userData.plan === 'trial') {
        const now = new Date();
        const trialEnd = userData.trialEndDate ? new Date(userData.trialEndDate) : null;
        
        if (trialEnd && now > trialEnd) {
             console.log(`⏳ [TRIAL EXPIRED] User ${effectiveUserId} trial ended.`);
             
             // Expire message
             const expiredMsg = isBrazil 
                ? "⏳ *Seu período de teste acabou!*\n\nMas temos uma boa notícia! Você foi selecionado para nosso Plano Anual com **80% de desconto**.\nIsso dá apenas 3 centavos por dia. 🚀\n\nClique abaixo para garantir:"
                : "⏳ *Your 2-day free trial has ended.*\n\nBut good news! You've been selected for an exclusive Annual Plan with **80% OFF**.\nThat's just **3 pence a day** to keep using Penny! 🚀\n\nClick here to claim this offer:";
             
             // Send upsell message
             await sendMessage(instance, sender, expiredMsg, socket);
             
             // Send link
             // const link = await generateSubscriptionLink(effectiveUserId); 
             // Using direct checkout link as requested for "checkout" experience
             const link = `https://penny-finance.vercel.app/checkout?phone=${effectiveUserId}`;
             await sendMessage(instance, sender, `👉 ${link}`, socket);

             return; // STOP PROCESSING
        }
    }
    // -------------------

    // --- SECURITY VERIFICATION FLOW (LID -> Phone) ---
    if (sender.includes('@lid')) {
        const sessionRef = db.collection('wa_sessions').doc(sender);
        const sessionSnap = await sessionRef.get();

        if (!sessionSnap.exists) {
            // No session found for this LID. Check verification progress.
            const linkRef = db.collection('wa_links').doc(sender);
            const linkSnap = await linkRef.get();
            const linkData = linkSnap.data();

            if (!linkData) {
                // Step 1: Request Phone Number
                const msg = `🔒 *Security Verification*\n\nTo protect your account, we need to confirm your identity.\nPlease type the phone number (with Country Code) linked to your subscription (Stripe/PayPal).\n\nExample: 5573991082831`;
                await sendMessage(instance, sender, msg, socket);
                await linkRef.set({ status: 'AWAITING_PHONE', createdAt: new Date().toISOString() });
                return;
            }

            if (linkData.status === 'AWAITING_PHONE') {
                const phone = text.replace(/\D/g, '');
                if (phone.length < 10) {
                    await sendMessage(instance, sender, `❌ *Invalid number.* Please enter the full number with Country Code (e.g., 447446196108).`, socket);
                    return;
                }

                // Check Subscription
                const targetPhone = phone + '@s.whatsapp.net';
                const targetUserRef = db.collection('usuarios').doc(targetPhone);
                const targetUserSnap = await targetUserRef.get();
                
                if (!targetUserSnap.exists || targetUserSnap.data().status !== 'active') {
                    await sendMessage(instance, sender, `❌ *Account not found.* Please ensure you are using the number registered for Trial or Premium.`, socket);
                    return;
                }
                
                const targetData = targetUserSnap.data();

                // --- NEW: Uniqueness Check ---
                const linkedSnap = await db.collection('wa_sessions').where('phone', '==', targetPhone).get();
                if (!linkedSnap.empty) {
                    await sendMessage(instance, sender, `❌ *Account already in use.*\n\nThis account is already linked to another WhatsApp session.`, socket);
                    return;
                }
                // -----------------------------

                // Found! Send Code
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                await linkRef.update({ 
                    status: 'AWAITING_CODE', 
                    targetPhone: targetPhone,
                    code: code,
                    updatedAt: new Date().toISOString()
                });

                // Send to Real Phone
                const codeMsg = `🔐 Your Penny verification code is: *${code}*\n\nDo not share this code.`;
                await sendMessage(instance, targetPhone, codeMsg, socket);

                // Notify LID (The anonymous user)
                let successTitle = "✅ *Subscription found!*";
                if (targetData.plan === 'trial') {
                    successTitle = "✅ *Free Trial Active!*";
                }
                
                const lidMsg = `${successTitle}\n\n🔐 Your Penny verification code is: *${code}*\n\n*Please enter the 6-digit code here to unlock your access.*`;
                await sendMessage(instance, sender, lidMsg, socket);
                return;
            }

            if (linkData.status === 'AWAITING_CODE') {
                if (text.trim() === linkData.code) {
                    await sessionRef.set({
                        phone: linkData.targetPhone,
                        lid: sender,
                        createdAt: new Date().toISOString()
                    });
                    await linkRef.delete();
                    
                    // Force UK Mode for this user setup
                    const userRefInitial = db.collection('usuarios').doc(linkData.targetPhone);
                    await userRefInitial.set({ features: { ukMode: true } }, { merge: true });
                    
                    // Proceeding to Onboarding (Hi)
                    effectiveUserId = linkData.targetPhone;
                    isBrazil = false; // Force English
                    
                    console.log(`✅ [Security] LID ${sender} linked to ${effectiveUserId} (Forced UK Mode)`);

                    // Force 'Hi' to trigger the AI onboarding message
                    text = 'Hi';
                } else {
                    await sendMessage(instance, sender, `❌ *Invalid code.* Please enter the 6-digit code sent to your phone.`, socket);
                    return;
                }
            }
        } else {
            // Session exists, link LID to real account
            const sessionData = sessionSnap.data();
            effectiveUserId = sessionData.phone;
            isBrazil = effectiveUserId.startsWith('55');
        }
    }

    // Lógica de Timeout (Safety Net)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("PROCESS_TIMEOUT")), 15000);
    });

    const executionPromise = (async () => {
        const userRef = db.collection('usuarios').doc(effectiveUserId);
        const userSnap = await userRef.get();
        const userData = userSnap.data() || {};
        
        if (userData.features?.ukMode === true) isBrazil = false;

        // --- COMMANDS ---
        const upperText = text.toUpperCase();
        if (upperText === '#DESARMAR') {
          console.log(`🚨 [PANIC] Disarm command received from ${sender}. Logging out instance ${instance}...`);
          await smartSendMessage(instance, sender, isBrazil ? "⚠️ *COMANDO DE DESARME ATIVADO!* Desconectando este número agora para sua segurança..." : "⚠️ *DISARM COMMAND ACTIVATED!* Disconnecting this number now for your security...", socket);
          replied = true;
          try {
            // await logoutInstance(instance); // Assuming logoutInstance is defined elsewhere or removed
          } catch (err) {
            // await deleteInstance(instance); // Assuming deleteInstance is defined elsewhere or removed
          }
          return;
        }

        if (upperText === '#UKMODE') {
          // Atualiza preferência
          userData.features = { ...(userData.features || {}), ukMode: true };
          await userRef.set(userData, { merge: true });
          
          await sendMessage(instance, sender, "🇬🇧 *UK MODE ACTIVATED!* \nFrom now on, I will speak English and use Pounds (£). \n\n_To switch back, type #BRMODE_", socket);
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

        if (upperText === '!RESETE199') {
            const batch = db.batch();

            // 1. Apagar Transações
            const txs = await userRef.collection('transactions').get();
            txs.docs.forEach(doc => batch.delete(doc.ref));

            // 2. Apagar Links de Verificação (wa_links)
            const linksSnap = await db.collection('wa_links').where('phone', '==', effectiveUserId).get();
            linksSnap.docs.forEach(doc => batch.delete(doc.ref));

            // 3. Apagar Sessões Ativas (wa_sessions)
            const sessionsSnap = await db.collection('wa_sessions').where('phone', '==', effectiveUserId).get();
            sessionsSnap.docs.forEach(doc => batch.delete(doc.ref));
            // Tenta apagar pelo ID também se for o numero
            const specificSession = db.collection('wa_sessions').doc(effectiveUserId);
            batch.delete(specificSession);

            // 4. Resetar Perfil (Mantendo Premium)
             const seedData = {
                phone: effectiveUserId,
                status: 'active',
                plan: 'premium',
                subscriptionStatus: 'active',
                // premiumSince: new Date().toISOString(), // Keep original if possible, or just reset
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                onboarding_complete: false,
                features: { ukMode: true } // FORCE ENGLISH (UK)
            };
            
            // Usando set SEM merge apaga tudo que não estiver em seedData
            // Isso resolve o erro do FieldValue.delete() e garante limpeza total
            batch.set(userRef, seedData);

            await batch.commit();

            const reply = "🔄 *HARD RESET COMPLETE!* (UK Mode)\n\nData cleared. Premium restored.\nSend 'Hi' to start fresh.";
            await sendMessage(instance, sender, reply);
            replied = true;
            return;
        }

        if (upperText === '#PREMIUM') {
            const link = await generateSubscriptionLink(effectiveUserId);
            const msg = isBrazil
                ? `🚀 *Penny Premium*\n\nClique no link abaixo para assinar o Penny Premium por £9.99/mês e liberar recursos exclusivos:\n\n${link}`
                : `🚀 *Penny Premium*\n\nClick the link below to subscribe to Penny Premium for £9.99/month and unlock exclusive features:\n\n${link}`;
            
            await sendMessage(instance, sender, msg);
            replied = true;
            return;
        }

        if (upperText === '#STOPREPORT') {
            await userRef.update({ dailyReportEnabled: false });
            await sendMessage(instance, sender, isBrazil ? "✅ Relatório diário desativado. Para reativar, envie #STARTREPORT" : "✅ Daily report disabled. To reactivate, send #STARTREPORT", socket);
            replied = true;
            return;
        }

        if (upperText === '#STARTREPORT') {
            await userRef.update({ dailyReportEnabled: true });
            await sendMessage(instance, sender, isBrazil ? "✅ Relatório diário ativado!" : "✅ Daily report activated!", socket);
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
                } else if (data.incomeType === 'weekly') {
                    if (!data.monthlyIncome && !data.weeklyIncome) return "ASK_WEEKLY_INCOME";
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
          weeklyIncome: userData.weeklyIncome || null,
          hourlyRate: userData.hourlyRate || null,
          weeklyHours: userData.weeklyHours || null,
          payFrequency: userData.payFrequency || null,
          currentBalance: totals.currentBalance,
          totalToday: totals.totalDia,
          todayCategoryTotals: totals.todayCategoryTotals,
          totalMonth: totals.totalMes,
          totalWeek: totals.totalSemana,
          healthRatioMonth: totals.healthRatioMonth,
          healthRatioWeek: totals.healthRatioWeek,
          lastAction: userData.lastAction || 'none',
          onboardingStep: currentStep, 
          dashboard_link: `https://penny-finance.vercel.app/?token=${await generateUserToken(effectiveUserId)}`
        };

        // --- AI CALL ---
        const transactionData = await extractFinancialData(text, aiState, isBrazil, currentStep);

        
        if (replied) return;

        if (!transactionData || transactionData.intent === 'NO_ACTION') {
          if (transactionData?.response_message && (source === 'whatsapp-evolution' || source === 'whatsapp-baileys')) {
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
        if (transactionData.intent === 'SET_WEEKLY_INCOME') {
            const weekly = parseFloat(transactionData.weekly_income || transactionData.amount);
            const monthly = weekly * 52 / 12;
            await userRef.update({ weeklyIncome: weekly, monthlyIncome: monthly, incomeType: 'weekly' });
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

            // --- REMINDER RESET ---
            await userRef.update({
              lastExpenseAt: new Date().toISOString(),
              reminder6hSent: false
            });
            console.log(`⏰ [Reminder] Reset for user ${effectiveUserId}`);
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
                await smartSendMessage(instance, sender, "⚠️ Your balance is getting low (£" + newBalance.toFixed(2) + ").", socket);
                await userRef.update({ lastLowBalanceAlertDate: todayStr });
            }
        }

        // --- FINAL RESPONSE ---
        // --- FINAL RESPONSE ---
        if ((source === 'whatsapp-evolution' || source === 'whatsapp-baileys') && transactionData.response_message) {
          try {
             await smartSendMessage(instance, sender, transactionData.response_message, socket);
          } catch (sendErr) {
             console.error(`[Background] ⚠️ Failed to send response: ${sendErr.message}`);
             // Don't throw, just log. This prevents the server from crashing.
          }
        }
        replied = true;
        return transactionData.response_message; // Return AI response
    })();

    // Wait for execution or timeout
    await Promise.race([executionPromise, timeoutPromise]);

  } catch (error) {
    if (replied) return; // Se já respondeu (ex: comando), ignora erro

    console.error(`ERROR processing message from ${sender}:`, error.message);
    
    // Tratamento de Timeout
    if (error.message === "PROCESS_TIMEOUT") {
        await smartSendMessage(instance, sender, isBrazil 
            ? "⏱️ *Opa, demorei muito!* \nMinha conexão ou cérebro está um pouco lento agora. Tente novamente em alguns instantes." 
            : "⏱️ *Oops, took too long!* \nMy connection or brain is a bit slow right now. Please try again in a moment.", socket
        );
    } 
    // Erros genéricos
    else {
        // Opcional: só responder erro genérico se não for timeout
        await smartSendMessage(instance, sender, isBrazil 
            ? "😵 *Tive um erro interno.* \nNão consegui processar sua mensagem. Tente novamente." 
            : "😵 *Internal Error.* \nI couldn't process your message. Please try again.", socket
        );
    }
  } finally {
    if (source === 'whatsapp-evolution') {
      try {
        await sendPresence(instance, sender, "available");
      } catch (e) {}
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

  let todayCategoryTotals = {};

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

      if (createdTodayStr === todayStr) {
        const cat = data.category || 'Other';
        if (cat !== 'Adjustment') { // Don't count balance corrections as daily spend
            totalDia += amt;
            todayCategoryTotals[cat] = (todayCategoryTotals[cat] || 0) + amt;
        }
      }
      if (createdMonthStr === monthStr && data.category !== 'Adjustment') totalMes += amt;
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
    todayCategoryTotals,
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
// --- DEPRECATED WEBHOOKS REMOVED ---

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
  console.log('🕒 [Proactive] Running 15min check (Reminders + Nudges + Reports)...');
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Find users active in last 48h to avoid spamming very old users
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60000).toISOString();
    const usersSnapshot = await db.collection('usuarios')
      .where('lastInteraction', '>', fortyEightHoursAgo)
      .get();

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const isBrazil = userId.startsWith('55');
      const instance = userData.instance || 'penny-instance';

      if (!userData.onboarding_complete) continue;

      // --- 1. DAILY INSIGHT REPORT (21:30) ---
      const tz = isBrazil ? 'America/Sao_Paulo' : 'Europe/London';
      const userTime = now.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      const userDateStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
      const reportEnabled = userData.dailyReportEnabled !== false;

      if (reportEnabled && userTime === "21:30" && userData.lastDailyReportSentAt !== userDateStr) {
        console.log(`📊 [Report] Generating 21:30 insights for ${userId}...`);
        
        const totals = await calculateUserTotals(doc.ref, isBrazil, userData);
        const { todayCategoryTotals, totalDia, currentBalance } = totals;

        // Skip fixed categories for insight
        const fixedCats = ['Bills', 'Rent', 'Investment', 'Adjustment', 'Contas', 'Aluguel', 'Investimento', 'Ajuste', 'Onboarding'];
        let topCat = '';
        let topAmount = 0;
        
        const sortedCats = Object.entries(todayCategoryTotals)
          .sort(([, a], [, b]) => b - a);

        for (const [cat, amt] of sortedCats) {
          if (!fixedCats.includes(cat)) {
            topCat = cat;
            topAmount = amt;
            break;
          }
        }

        let reportMsg = isBrazil ? `📊 *Resumo de Hoje*\n` : `📊 *Today's Summary*\n`;
        if (totalDia > 0) {
          // Top 3 listing
          sortedCats.slice(0, 3).forEach(([cat, amt]) => {
            reportMsg += `• ${cat}: ${isBrazil ? 'R$' : '£'}${amt.toFixed(2)}\n`;
          });

          // AI Insight
          const insight = await generatePennyInsight(topCat || 'Spending', topAmount || totalDia, isBrazil);
          reportMsg += `\n💡 *Penny diz:*\n"${insight}"\n`;
        } else {
          reportMsg += isBrazil 
            ? "\n🌟 Zero gastos hoje! Penny está orgulhosa de sua disciplina financeira, darling."
            : "\n🌟 Zero expenses today! Penny is proud of your financial discipline, darling.";
        }

        reportMsg += `\n🔗 [Dashboard](https://penny-finance.vercel.app/?token=${await generateUserToken(userId)})\n`;
        reportMsg += `\n_(#STOPREPORT p/ cancelar)_`;

        await sendMessage(instance, userId, reportMsg);
        await doc.ref.update({ lastDailyReportSentAt: userDateStr });
        continue;
      }
      
      // --- 2. 6-HOUR INACTIVITY REMINDER ---
      const lastExpenseAt = userData.lastExpenseAt ? new Date(userData.lastExpenseAt) : null;
      const reminder6hSent = userData.reminder6hSent || false;
      const hourDiff = lastExpenseAt ? (now.getTime() - lastExpenseAt.getTime()) / (1000 * 60 * 60) : 0;

      // Plan check: Premium or Active Trial
      const hasActivePlan = userData.plan === 'premium' || (userData.plan === 'trial' && new Date(userData.trialEndDate) > now);

      if (hasActivePlan && lastExpenseAt && hourDiff >= 6 && !reminder6hSent) {
        console.log(`⏰ [Reminder] 6h Inactivity detected for ${userId}. Sending reminder...`);
        
        const brMsgs = [
          "Que tal anotarmos os gastos das últimas 6 horas? 💰🙂",
          "Já se passaram 6 horas desde o último registro. Quer anotar algum gasto? 💸",
          "Lembrete rápido: registrou algum gasto nas últimas horas? 👀",
          "Se quiser, posso te ajudar a anotar os gastos recentes 🙂"
        ];
        const ukMsgs = [
          "How about we log your expenses from the last 6 hours? 💰🙂",
          "It's been 6 hours since your last entry. Anything to record? 💸",
          "Quick nudge: did you have any expenses in the last few hours? 👀",
          "If you'd like, I can help you log your recent spending 🙂"
        ];

        const msgs = isBrazil ? brMsgs : ukMsgs;
        const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];

        await sendMessage(instance, userId, randomMsg);
        await doc.ref.update({ reminder6hSent: true });
        continue; // Nudge is enough for this cycle
      }

      // 2. Existing Proactive Nudge (if no tx in 24h)
      const lastPrompt = userData.lastProactivePrompt ? new Date(userData.lastProactivePrompt) : new Date(0);
      const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000);

      if (lastPrompt < thirtyMinsAgo) {
        const dayTxs = await doc.ref.collection('transactions')
          .where('createdAt', '>=', new Date(now.getTime() - 24 * 60 * 60000).toISOString())
          .limit(1)
          .get();

        if (dayTxs.empty) {
          const nudgeMsg = isBrazil
            ? "Oi! Passando para ver se você teve algum gasto hoje que esqueceu de anotar. 📝"
            : "Hi! Just checking if you had any expenses today that you forgot to track. 📝";
          
          console.log(`🕒 [Proactive] Sending 24h nudge to ${userId}`);
          await sendMessage(instance, userId, nudgeMsg);
          await doc.ref.update({ lastProactivePrompt: now.toISOString() });
        }
      }
    }
  } catch (error) {
    console.error('❌ [Proactive] Error:', error.message);
  }
}

// Start the loop every 15 minutes for better granularity
setInterval(checkProactiveMessages, 15 * 60000);

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
// Serve static files from the 'client/dist' directory
app.use(express.static(path.join(__dirname, 'client/dist'))); 

// Servir a pasta original do Quiz em uma URL separada
app.use('/original-quiz', express.static(path.join(__dirname, 'quiz')));

// Fallback para servir o index.html (Catch-all middleware)
app.use((req, res, next) => {
  // Ignorar rotas de API, Auth, Evolution e arquivos estáticos
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/evolution') || req.path.startsWith('/baileys') || req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Penny Finance Server running on port ${PORT}`);
  
  // Start Baileys Connection
  console.log('🔄 Initializing Baileys Direct Connection...');
  startBaileys(async (text, remoteJid, sock, msg) => {
      // Callback quando chega mensagem
      // dbUserId=null (deixa o processMessageBackground tentar resolver pelo Sender)
      // instance='baileys_default'
      await processMessageBackground(text, remoteJid, 'baileys_default', 'whatsapp-baileys', null, sock);
  }).catch(err => console.error('❌ Failed to start Baileys:', err));

  console.log(`Environment:`);
  console.log(`- FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? `✅ Set (${process.env.OPENAI_API_KEY.substring(0, 10)}...)` : '❌ Missing'}`);
  console.log(`- EVOLUTION_API_URL: ${process.env.EVOLUTION_API_URL ? '✅ Set' : '❌ Missing'}`);
  
  // Migration for UK users
  runMigration();

  // Initial run in 10 seconds to not block startup
  setTimeout(checkProactiveMessages, 10000);
});

async function runMigration() {
    if (!db) {
        console.warn('⚠️ [Migration] Skip: Firestore (db) not initialized.');
        return;
    }
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

// --- SAFETY NET (ALWAYS ONLINE) ---
// Prevent process from crashing on unhandled errors
process.on('uncaughtException', (err) => {
    console.error('?? [CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('?? [CRITICAL] Unhandled Rejection:', reason);
});
