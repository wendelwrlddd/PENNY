// Vercel Serverless Function - WhatsApp Webhook Handler
// Enhanced with comprehensive logging and professional storage structure

export default async function handler(req, res) {
  console.log('========================================');
  console.log('🔔 Webhook called:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('========================================');

  // --- PARTE A: O Teste de Segurança do Facebook ---
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('📋 Facebook verification attempt:', { mode, token, challenge });

    if (mode === 'subscribe' && token === 'penny123') {
      console.log('✅ Verification successful!');
      return res.status(200).send(challenge);
    }
    
    console.log('❌ Verification failed - wrong token');
    return res.status(403).send('Senha errada!');
  }

  // --- PARTE B: Receber Mensagens Reais ---
  if (req.method === 'POST') {
    try {
      const body = req.body;
      const { db } = await import('../lib/firebase.js');
      
      console.log('📦 Raw webhook body:', JSON.stringify(body, null, 2));

      // CASE 1: Meta Official API (WhatsApp Business)
      if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        console.log('🔗 Meta API Event Detected');
        const value = body.entry[0].changes[0].value;
        const messageObj = value.messages[0];
        const instance = 'OfficialMeta'; // Label for Meta instance

        if (messageObj.type !== 'text') {
          console.log('⚠️ Not a text message, type:', messageObj.type);
          return res.status(200).send('Not text');
        }

        const textoDoUsuario = messageObj.text?.body;
        const telefoneUsuario = messageObj.from;

        // 1. Save Raw Message
        await logRawMessage(db, instance, telefoneUsuario, textoDoUsuario);

        // 2. Process Transaction
        return await processMessage(textoDoUsuario, telefoneUsuario, res, (dadosFinanceiros) => {
          return {
            ...dadosFinanceiros,
            userPhone: telefoneUsuario,
            originalMessage: textoDoUsuario,
            source: 'whatsapp-meta',
            instance: instance
          };
        });
      }

      // CASE 2: Evolution API (messages.upsert)
      const evoEvent = body.event || body.type;
      if (evoEvent && (evoEvent === "messages.upsert" || evoEvent === "MESSAGES_UPSERT")) {
        console.log('🔄 Evolution API Event Detected:', evoEvent);
        
        // Evolution v1 can send data inside an array or directly
        const data = Array.isArray(body.data) ? body.data[0] : body.data;
        
        if (!data) {
          console.log('⚠️ Evolution webhook received but "data" is missing or empty');
          return res.status(200).send('No data');
        }

        const message = data.message;
        const key = data.key;
        const instance = body.instance || body.sender || 'UnknownInstance';
        
        // Handle various message types in Baileys/Evolution structure
        const textoDoUsuario = 
          message?.conversation || 
          message?.extendedTextMessage?.text || 
          message?.imageMessage?.caption || 
          message?.videoMessage?.caption ||
          "";

        const telefoneUsuario = key?.remoteJid?.split('@')[0]; // Get only the number

        if (!textoDoUsuario) {
          console.log('⚠️ No text found in Evolution API message structure');
          console.log('Structure:', JSON.stringify(message, null, 2));
          return res.status(200).send('No text');
        }

        console.log(`📱 Message from ${telefoneUsuario} via ${instance}: ${textoDoUsuario}`);

        // 1. Save Raw Message
        await logRawMessage(db, instance, telefoneUsuario, textoDoUsuario);

        // 2. Process Transaction
        return await processMessage(textoDoUsuario, telefoneUsuario, res, (dadosFinanceiros) => {
          return {
            ...dadosFinanceiros,
            userPhone: telefoneUsuario,
            originalMessage: textoDoUsuario,
            instance: instance,
            source: 'whatsapp-evolution'
          };
        });
      }

      console.log('⚠️ Unrecognized webhook event');
      return res.status(200).send('Unrecognized event');

    } catch (error) {
      console.error('========================================');
      console.error('❌ ERROR OCCURRED:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('========================================');
      
      return res.status(500).json({ 
        error: 'Erro no servidor', 
        message: error.message,
        name: error.name,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Se não for nem GET nem POST
  console.log('⚠️ Method not allowed:', req.method);
  return res.status(405).send('Método não permitido');
}

/**
 * Logs the raw message to Firestore in a professional SaaS structure
 * Instances/{instanceId}/messages/
 */
async function logRawMessage(db, instance, sender, text) {
  try {
    console.log(`💾 Logging raw message for instance: ${instance}`);
    await db.collection('instancias')
      .doc(instance)
      .collection('mensagens')
      .add({
        texto: text,
        de: sender,
        timestamp: new Date().toISOString()
      });
    console.log('✅ Raw message logged.');
  } catch (error) {
    console.error('❌ Error logging raw message:', error);
    // Don't throw, let the main flow continue
  }
}

/**
 * Processes message with Gemini and saves the extracted transaction
 */
async function processMessage(textoDoUsuario, telefoneUsuario, res, dataMapper) {
  try {
    // 1. Check environment
    console.log('🔐 Checking AI environment variables...');
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const hasFirebaseAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!hasGeminiKey || !hasFirebaseAccount) {
      throw new Error('Missing required environment variables (GEMINI_API_KEY or FIREBASE_SERVICE_ACCOUNT)');
    }

    // 2. Import Gemini
    const { extractFinancialData } = await import('../lib/gemini.js');
    const { db } = await import('../lib/firebase.js');

    // 3. Call Gemini
    console.log('🤖 Calling Gemini AI...');
    const dadosFinanceiros = await extractFinancialData(textoDoUsuario);

    // 4. Save to Transactions collection
    console.log('💾 Saving transaction to Firestore...');
    const dataToSave = {
      ...dataMapper(dadosFinanceiros),
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };

    const docRef = await db.collection('transactions').add(dataToSave);

    console.log('✅ Successfully saved to Firestore with ID:', docRef.id);
    return res.status(200).json({ 
      success: true,
      transactionId: docRef.id,
      data: dadosFinanceiros
    });
  } catch (error) {
    console.error('❌ Error processing message:', error.message);
    throw error;
  }
}
