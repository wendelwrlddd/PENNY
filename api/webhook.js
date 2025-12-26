// Vercel Serverless Function - WhatsApp Webhook Handler
// Enhanced with comprehensive logging and error handling

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
      
      console.log('📦 Raw webhook body:', JSON.stringify(body, null, 2));
      
      // Validar estrutura do webhook
      if (!body || !body.entry) {
        console.log('⚠️ Invalid webhook structure - missing entry');
        return res.status(200).send('Invalid structure');
      }

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messageObj = value?.messages?.[0];

      console.log('🔍 Parsed structure:', {
        hasEntry: !!entry,
        hasChanges: !!changes,
        hasValue: !!value,
        hasMessages: !!messageObj
      });

      // Verificar se é mensagem de texto
      if (!messageObj) {
        console.log('⚠️ No message object found');
        return res.status(200).send('No message');
      }

      if (messageObj.type !== 'text') {
        console.log('⚠️ Not a text message, type:', messageObj.type);
        return res.status(200).send('Not text');
      }

      const textoDoUsuario = messageObj.text?.body;
      const telefoneUsuario = messageObj.from;

      if (!textoDoUsuario) {
        console.log('⚠️ No text body found');
        return res.status(200).send('No text body');
      }

      console.log('📱 Message from:', telefoneUsuario);
      console.log('💬 Text:', textoDoUsuario);

      // Verificar variáveis de ambiente ANTES de importar
      console.log('🔐 Checking environment variables...');
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;
      const hasFirebaseAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
      const hasFirebaseProject = !!process.env.FIREBASE_PROJECT_ID;

      console.log('Environment check:', {
        GEMINI_API_KEY: hasGeminiKey ? '✅ Present' : '❌ Missing',
        FIREBASE_SERVICE_ACCOUNT: hasFirebaseAccount ? '✅ Present' : '❌ Missing',
        FIREBASE_PROJECT_ID: hasFirebaseProject ? '✅ Present' : '❌ Missing'
      });

      if (!hasGeminiKey || !hasFirebaseAccount) {
        throw new Error('Missing required environment variables');
      }

      // Import dinâmico
      console.log('📥 Importing modules...');
      const { extractFinancialData } = await import('../lib/gemini.js');
      const { db } = await import('../lib/firebase.js');
      console.log('✅ Modules imported successfully');

      // 1. Chama o Gemini
      console.log('🤖 Calling Gemini AI...');
      console.log('Input text:', textoDoUsuario);
      
      const dadosFinanceiros = await extractFinancialData(textoDoUsuario);
      
      console.log('✅ Gemini response received:', JSON.stringify(dadosFinanceiros, null, 2));

      // Validar resposta do Gemini
      if (!dadosFinanceiros || typeof dadosFinanceiros !== 'object') {
        throw new Error('Invalid Gemini response format');
      }

      // 2. Salva no Firebase
      console.log('💾 Attempting to save to Firestore...');
      console.log('Collection: transactions');
      
      const dataToSave = {
        ...dadosFinanceiros,
        userPhone: telefoneUsuario,
        originalMessage: textoDoUsuario,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      };

      console.log('Data to save:', JSON.stringify(dataToSave, null, 2));

      const docRef = await db.collection('transactions').add(dataToSave);

      console.log('✅ Successfully saved to Firestore!');
      console.log('Document ID:', docRef.id);
      console.log('========================================');

      return res.status(200).json({ 
        success: true,
        transactionId: docRef.id,
        data: dadosFinanceiros,
        message: 'Transaction saved successfully'
      });

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
