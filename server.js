
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { extractFinancialData } from './lib/gemini.js';
import { db } from './lib/firebase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.status(200).send('Penny Finance API is OK');
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

// Handle Incoming Messages
app.post('/webhook', async (req, res) => {
  console.log('📦 Webhook POST received');
  
  try {
    const body = req.body;

    // Check if this is a WhatsApp status update (ignore them)
    if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
      return res.sendStatus(200);
    }

    // Check for messages
    if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      const business_phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;

      if (message.type === 'text') {
        const messageText = message.text.body;
        const sender = message.from;

        console.log(`💬 Processing message from ${sender}: ${messageText}`);

        // 1. Extract Data with Gemini
        const transactionData = await extractFinancialData(messageText);

        // 2. Save to Firebase
        const docData = {
          ...transactionData,
          createdAt: new Date().toISOString(),
          originalMessage: messageText,
          sender: sender,
          source: 'whatsapp'
        };

        const docRef = await db.collection('transactions').add(docData);
        console.log(`✅ Saved to Firestore with ID: ${docRef.id}`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.sendStatus(500);
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment:`);
  console.log(`- FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`- GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
});
