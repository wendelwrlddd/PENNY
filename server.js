
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { extractFinancialData } from './lib/gemini.js';
import { db } from './lib/firebase.js';

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
async function processMessageBackground(message, business_phone_number_id) {
  if (message.type === 'text') {
    const messageText = message.text.body;
    const sender = message.from;

    try {
      console.log(`[Background] 💬 Processing message from ${sender}: ${messageText}`);

      // 1. Extract Data with Gemini
      console.log('[Background] 🤖 Extracting data with Gemini...');
      const transactionData = await extractFinancialData(messageText);
      console.log('[Background] ✅ Gemini output:', JSON.stringify(transactionData, null, 2));

      // 2. Save to Firebase
      const docData = {
        ...transactionData,
        createdAt: new Date().toISOString(),
        originalMessage: messageText,
        sender: sender,
        source: 'whatsapp'
      };

      console.log('[Background] 💾 Saving to Firestore...');
      const docRef = await db.collection('transactions').add(docData);
      console.log(`[Background] ✅ Saved with ID: ${docRef.id}`);
    } catch (error) {
      console.error('[Background] ❌ Error processing message:', error);
    }
  } else {
    console.log('[Background] ℹ️ Non-text message received (ignoring):', message.type);
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

    // Check if this is a WhatsApp status update (ignore them)
    if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
      console.log('ℹ️ Status update received');
      return;
    }

    // Check for messages
    if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      const business_phone_number_id = body.entry[0].changes[0].value.metadata?.phone_number_id;

      // Chama o processamento em background (SEM AWAIT)
      processMessageBackground(message, business_phone_number_id);
    } else {
      console.log('ℹ️ Webhook received but no message found');
    }

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
