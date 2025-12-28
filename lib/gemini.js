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
 * @param {boolean} isBrazil - Whether the user is from Brazil
 * @returns {Promise<Object>} - Structured transaction object
 */
export async function extractFinancialData(messageText, isBrazil = false) {
  try {
    console.log(`🤖 [Gemini] Starting extraction for (${isBrazil ? 'PT-BR' : 'EN-GB'}):`, messageText);
    
    // --- Stabilized model names (Standard) ---
    const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'];
    let lastError = null;
    let text = "";

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (const modelName of modelsToTry) {
      let retryCount = 0;
      const maxRetries = 1;

      while (retryCount <= maxRetries) {
        try {
          console.log(`🤖 [Gemini] Trying model: ${modelName} (Attempt ${retryCount + 1})...`);
          const model = genAI.getGenerativeModel({ model: modelName });
          
          const now = new Date();
          const currentDateTime = now.toLocaleDateString(isBrazil ? 'pt-BR' : 'en-GB');
          const currency = isBrazil ? "R$" : "£";

          const prompt = `System: You are a strict financial data extractor for the app "Penny".
                          Goal: Extract user intention and mapping to structured data.
                          
                          INTENTS:
                          - SYNC: HIGHEST PRIORITY. Use if user mentions "update balance", "my balance is", "tenho só", "saldo atual", "resta", "atualize meu saldo".
                          - RECORD: For NEW specific expenses/income (e.g. "spent 50").
                          - PROFILE_UPDATE: Profile info (e.g. "I earn 2000").
                          
                          RULES:
                          1. If message is "atualize meu saldo para 181", set intent="SYNC" and amount=181.
                          2. Extract numerical value from "tenho só 100", "my balance is 50", etc.
                          3. amount: extract number.
                          
                          FEW-SHOT:
                          User: "atualize meu saldo para 181"
                          JSON: {"intent": "SYNC", "amount": 181}

                          User: "tenho so 181"
                          JSON: {"intent": "SYNC", "amount": 181}

                          User: "my current balance is 500"
                          JSON: {"intent": "SYNC", "amount": 500}

                          Today's date: ${currentDateTime}
                          User Message: "${messageText}"
                          Respond ONLY with JSON.`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          text = response.text();
          
          if (text && text.includes('{')) {
            console.log(`✅ [Gemini] Success with model: ${modelName}`);
            retryCount = maxRetries + 1;
            break; 
          }
        } catch (err) {
          console.error(`⚠️ [Gemini] Model ${modelName} attempt ${retryCount + 1} failed:`, err.message);
          lastError = err;
          
          if (err.message.includes('429')) {
            console.log('⏳ Rate limit (429) hit, waiting 3s...');
            await sleep(3000);
            retryCount++;
          } else {
            console.log('⚠️ Other error, moving to next model...');
            break; // Other error, try next model
          }
        }
      }
      
      if (text) break; // If we got a response from any model, break modelsToTry loop
    }

    if (!text) {
      throw lastError || new Error("Todos os modelos do Gemini falharam ou retornaram resposta vazia.");
    }
    
    // Clean potential markdown or extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Resposta inválida do Gemini (sem JSON): ${text.substring(0, 100)}`);
    }

    const transactionData = JSON.parse(jsonMatch[0]);
    
    // Final validation of required fields
    if (!transactionData.amount && transactionData.amount !== 0) {
        transactionData.amount = 0;
        transactionData.category = transactionData.category || "Não identificado";
    }

    console.log('✅ [Gemini] Data extracted successfully');
    return transactionData;
  } catch (error) {
    console.error('❌ [Gemini] Error:', error.message);
    console.error('❌ [Gemini] Stack:', error.stack);
    throw error;
  }
}
