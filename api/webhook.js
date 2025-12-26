// Vercel Serverless Function - WhatsApp Webhook Handler
import { extractFinancialData } from '../lib/gemini.js';
import { db } from '../lib/firebase.js';

export default async function handler(req, res) {
  // --- PARTE A: O Teste de Segurança do Facebook ---
  // Quando você clica em "Verificar" no site do Facebook, ele manda um GET
  if (req.method === 'GET') {
    // Ele manda uma senha e espera que a gente devolva um código
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Facebook verification attempt:', { mode, token });

    // Nossa senha secreta é "penny123"
    if (mode === 'subscribe' && token === 'penny123') {
      // Se a senha bater, devolvemos o challenge (o sinal de ok)
      console.log('✅ Verification successful!');
      return res.status(200).send(challenge);
    }
    
    console.log('❌ Verification failed - wrong token');
    return res.status(403).send('Senha errada!');
  }

  // --- PARTE B: Receber Mensagens Reais (O que importa) ---
  // Quando o usuário manda mensagem, o Facebook manda um POST
  if (req.method === 'POST') {
    try {
      const body = req.body;
      
      console.log('Received webhook POST:', JSON.stringify(body, null, 2));
      
      // Navegando no JSON complexo do WhatsApp para achar o texto
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messageObj = value?.messages?.[0];

      // Se não for mensagem de texto, ignora
      if (!messageObj || messageObj.type !== 'text') {
        console.log('Not a text message, ignoring');
        return res.status(200).send('Ignorado');
      }

      const textoDoUsuario = messageObj.text.body;
      const telefoneUsuario = messageObj.from;

      console.log('📱 Message from:', telefoneUsuario);
      console.log('💬 Text:', textoDoUsuario);

      // 1. Chama o Gemini
      console.log('🤖 Sending to Gemini AI...');
      const dadosFinanceiros = await extractFinancialData(textoDoUsuario);
      console.log('✅ Gemini response:', dadosFinanceiros);

      // 2. Salva no Firebase
      console.log('💾 Saving to Firestore...');
      const docRef = await db.collection('transactions').add({
        ...dadosFinanceiros,
        userPhone: telefoneUsuario,
        originalMessage: textoDoUsuario,
        createdAt: new Date().toISOString()
      });

      console.log('✅ Saved with ID:', docRef.id);

      return res.status(200).json({ 
        success: true,
        transactionId: docRef.id,
        data: dadosFinanceiros
      });

    } catch (error) {
      console.error('❌ Error processing message:', error);
      return res.status(500).json({ error: 'Erro no servidor' });
    }
  }

  // Se não for nem GET nem POST
  return res.status(405).send('Método não permitido');
}
