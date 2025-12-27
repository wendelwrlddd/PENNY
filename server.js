
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

    // 1. Extract Data with Gemini
    console.log('[Background] 🤖 Calling Gemini AI...');
    let transactionData;
    try {
      transactionData = await extractFinancialData(text);
    } catch (aiError) {
      console.error('[Background] ⚠️ Gemini failed, using fallback:', aiError.message);
      // Fallback data so we don't lose the message trace in the DB
      transactionData = {
        amount: 0,
        currency: "R$",
        category: "Erro IA",
        description: `(Auto-Processado) ${text.substring(0, 50)}...`,
        date: new Date().toISOString(),
        type: "expense",
        error: aiError.message
      };
    }
    
    // 2. Save to Firebase
    const docData = {
      ...transactionData,
      createdAt: new Date().toISOString(),
      originalMessage: text,
      userPhone: sender,
      instance: instance,
      source: source
    };

    console.log('[Background] 💾 Saving to Firestore...');
    const docRef = await db.collection('transactions').add(docData);
    console.log(`[Background] ✅ Saved with ID: ${docRef.id}`);
    
    // 3. Log Raw Message (Professional Storage)
    await logRawMessage(instance, sender, text);

    // 4. Send Confirmation on WhatsApp (Evolution API)
    if (source === 'whatsapp-evolution') {
      try {
        // --- Calculate Totals (Today and Month) ---
        // We use Brazil Time (UTC-3) for accurate daily/monthly tracking
        const now = new Date();
        const tz = 'America/Sao_Paulo';
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
        const monthStr = todayStr.substring(0, 7); // YYYY-MM

        const totalsSnapshot = await db.collection('transactions')
          .where('userPhone', '==', sender)
          .get();

        let totalDia = 0;
        let totalMes = 0;

        totalsSnapshot.forEach(doc => {
          const data = doc.data();
          // Logic: Sum everything that IS NOT income
          if (data.type === 'income') return;

          const created = new Date(data.createdAt || data.date);
          const createdTodayStr = created.toLocaleDateString('en-CA', { timeZone: tz });
          const createdMonthStr = createdTodayStr.substring(0, 7);

          if (createdTodayStr === todayStr) totalDia += parseFloat(data.amount || 0);
          if (createdMonthStr === monthStr) totalMes += parseFloat(data.amount || 0);
        });

        const formatBRL = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const dashboardUrl = 'https://penny-finances.vercel.app'; // Corrected URL

        const replyText = `💸 *Opa! Já registrei esse gasto* 😉\n\n` +
          `🍽️ *${transactionData.category || 'Geral'}*: R$ ${formatBRL(transactionData.amount)}\n\n` +
          `📊 *Como você está agora:*\n` +
          `• Gastos hoje: R$ ${formatBRL(totalDia)}\n` +
          `• Gastos no mês: R$ ${formatBRL(totalMes)}\n\n` +
          `📱 Quando quiser ver tudo detalhado, é só abrir seu dashboard 💙\n` +
          `🔗 ${dashboardUrl}`;
        
        console.log(`[Background] 📤 Sending custom reply to ${sender}...`);
        await sendMessage(instance, sender, replyText);
      } catch (replyError) {
        console.error('[Background] ⚠️ Failed to send WhatsApp reply:', replyError.message);
      }
    }

  } catch (error) {
    console.error('[Background] ❌ Error processing message:', error);
  }
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

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment:`);
  console.log(`- FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`- GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
});
