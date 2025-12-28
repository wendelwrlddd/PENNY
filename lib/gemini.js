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
    
    // --- Model Rotation for Maximum Stability ---
    const modelsToTry = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-2.0-flash'];
    let lastError = null;
    let text = "";

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (const modelName of modelsToTry) {
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          console.log(`🤖 [Gemini] Trying model: ${modelName} (Attempt ${retryCount + 1})...`);
          const model = genAI.getGenerativeModel({ model: modelName });
          
          const now = new Date();
          const currentDateTime = now.toLocaleDateString(isBrazil ? 'pt-BR' : 'en-GB');
          
          const language = isBrazil ? "Portuguese" : "English";
          const currency = isBrazil ? "R$" : "£";

          const prompt = `Extract financial data or user profile info from this message: "${messageText}". 
                          Today's date: ${currentDateTime}.
                          Locale Language: ${language}.
                          
                          INTENTS:
                          - RECORD: For a new expense or income/balance addition (e.g., "spent 30", "add 50 to balance").
                          - PROFILE_UPDATE: For info about income, if they are salaried, or payday (e.g., "I earn 1800", "I get paid on the 5th", "I am salaried").
                          - REMOVE: To delete a previous mistake (e.g., "remove that 30 expense", "delete last transaction").
                          - SYNC: When user says how much they currently have in their bank account (e.g., "I have 181 left", "current balance is 200").

                          RULES:
                          1. If intent is RECORD:
                             - type="expense" if it's a cost.
                             - type="income" if it's adding money/balance.
                             - Identify category in ${language}.
                             - amount must be a number (float).
                          2. If intent is PROFILE_UPDATE:
                             - Identify monthlyIncome (number), isSalaried (boolean), and payDay (number, 1-31).
                          3. If intent is SYNC:
                             - amount = the current actual money the user has in hand/bank.
                          4. Respond STRICTLY with a valid JSON object.
                          
                          FORMAT:
                          {
                            "intent": "RECORD" | "PROFILE_UPDATE" | "REMOVE" | "SYNC",
                            "amount": number (for RECORD, REMOVE, or SYNC),
                            "currency": "${currency}",
                            "category": string,
                            "description": string,
                            "type": "expense" | "income",
                            "profile": {
                              "monthlyIncome": number,
                              "isSalaried": boolean,
                              "payDay": number
                            }
                          }`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          text = response.text();
          
          if (text && text.includes('{')) {
            console.log(`✅ [Gemini] Success with model: ${modelName}`);
            retryCount = maxRetries + 1; // Success, break while
            break; // Break while
          }
        } catch (err) {
          console.error(`⚠️ [Gemini] Model ${modelName} attempt ${retryCount + 1} failed:`, err.message);
          lastError = err;
          
          if (err.message.includes('429')) {
            console.log('⏳ Rate limit (429) hit, waiting 10s...');
            await sleep(10000);
            retryCount++;
          } else {
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
