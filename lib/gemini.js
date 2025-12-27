// Google Gemini AI Configuration
import { GoogleGenerativeAI } from '@google/generative-ai';

console.log('🤖 Gemini module loading...');

// Initialize Gemini AI
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);
console.log('✅ Gemini AI client initialized');

/**
 * Process financial text and extract structured transaction data
 * @param {string} messageText - The message text from WhatsApp
 * @returns {Promise<Object>} - Structured transaction object
 */
export async function extractFinancialData(messageText) {
  try {
    console.log('🤖 [Gemini] Starting extraction for:', messageText);
    
    // Use the latest standard model name
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('🤖 [Gemini] Model loaded: gemini-1.5-flash');

    const now = new Date();
    const currentDateTime = now.toLocaleDateString('pt-BR');
    const systemPrompt = `Você é um contador financeiro pessoal. Extraia os dados do texto. 
    Hoje é dia ${currentDateTime}. Use esta data se o usuário não mencionar outra.
    Retorne APENAS um JSON:
    {
      "amount": número,
      "currency": "R$",
      "category": "string em português",
      "description": "descrição curta em português",
      "date": "ISO string da data",
      "type": "expense" ou "income"
    }
    Se não for financeiro, retorne amount: 0.`;

    const prompt = `${systemPrompt}\n\nTexto do usuário: "${messageText}"`;
    
    console.log('🤖 [Gemini] Sending request to API...');
    const result = await model.generateContent(prompt);
    
    console.log('🤖 [Gemini] Response received');
    const response = await result.response;
    const text = response.text();
    
    console.log('🤖 [Gemini] Raw response:', text);

    // Extract JSON from response (remove markdown code blocks if present)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ [Gemini] No JSON found in response');
      throw new Error('No JSON found in Gemini response');
    }

    console.log('🤖 [Gemini] JSON extracted:', jsonMatch[0]);
    const transactionData = JSON.parse(jsonMatch[0]);
    
    console.log('✅ [Gemini] Successfully parsed transaction data');
    return transactionData;
  } catch (error) {
    console.error('❌ [Gemini] Error:', error.message);
    console.error('❌ [Gemini] Stack:', error.stack);
    throw error;
  }
}
