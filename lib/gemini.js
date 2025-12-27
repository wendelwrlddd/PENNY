// Google Gemini AI Configuration
import { GoogleGenerativeAI } from '@google/generative-ai';

console.log('🤖 Gemini module loading...');

// Initialize Gemini AI
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in environment variables');
} else {
  console.log(`✅ GEMINI_API_KEY found (Length: ${apiKey.length}, Starts with: ${apiKey.substring(0, 5)}...)`);
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
    
    // --- Model Rotation starting with user recommendation ---
    const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    let lastError = null;
    let text = "";

    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 [Gemini] Trying model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const now = new Date();
        const currentDateTime = now.toLocaleDateString('pt-BR');
        
        // Simplified prompt as suggested by user
        const prompt = `Extraia o valor, categoria, descrição e tipo (expense/income) desta mensagem: "${messageText}". 
                        Hoje é ${currentDateTime}.
                        Responda APENAS em JSON: {"amount": number, "currency": "R$", "category": string, "description": string, "date": string, "type": string}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        text = response.text();
        
        if (text) {
          console.log(`✅ [Gemini] Success with model: ${modelName}`);
          break; // Exit loop if successful
        }
      } catch (err) {
        console.error(`⚠️ [Gemini] Model ${modelName} failed:`, err.message);
        lastError = err;
        continue; // Try next model
      }
    }

    if (!text) {
      throw lastError || new Error("All models failed");
    }
    
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
