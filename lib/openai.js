import OpenAI from "openai";

// Initialize OpenAI with the API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Process financial text and extract structured transaction data using OpenAI
 * @param {string} messageText - The message text from WhatsApp
 * @param {boolean} isBrazil - Whether the user is from Brazil
 * @returns {Promise<Object>} - Structured transaction object
 */
export async function extractFinancialData(messageText, isBrazil = false) {
  try {
    console.log(`🤖 [OpenAI] Starting extraction for (${isBrazil ? 'PT-BR' : 'EN-GB'}):`, messageText);
    
    const now = new Date();
    const currentDateTime = now.toLocaleDateString(isBrazil ? 'pt-BR' : 'en-GB');

    const systemPrompt = `You are a strict financial data extractor for the app "Penny".
Goal: Extract user intention and mapping to structured data.

INTENTS:
- SYNC: Use if user mentions "update balance", "my balance is", "tenho só", "saldo atual", "resta", "atualize meu saldo".
- RECORD: For NEW specific expenses or income.
- PROFILE_UPDATE: For setting monthly income or payday (e.g., "I earn 2000", "my payday is the 5th", "dia 10").
- REMOVE: To remove a wrong entry (e.g. "delete last", "remove 50", "apague o gasto").
- UNCERTAIN: Use if you don't understand the intent.

RULES for RECORD, SYNC, and PROFILE_UPDATE:
1. amount: extract numerical value (for income or spending).
2. payDay: extract integer (1-31) if user mentions when they receive money.
3. profile_status: If the user explicitly refuses to provide information, says they don't have it, or responds with something unrelated to the onboarding question, set the respective field (amount or payDay) to null or "unknown".
4. Contextual Nuance: If the message is JUST a number (e.g., "1500", "5"), it is likely an answer to an onboarding question. Default to PROFILE_UPDATE with the number as "amount" (if > 31) or "payDay" (if <= 31 and requested).
5. type: must be "income" or "expense".
   - "income": For keywords like "adicione", "recebi", "ganhei", "salary", "extra", "sobrou", "income", "wage".
   - "expense": For "gastei", "paguei", "spent", "comprei", "almoço", "uber", "delivery".
6. category: Suggest a short category from this list ONLY: Food, Transport, Shopping, Leisure, General, Bills.

FEW-SHOT EXAMPLES:
User: "1500"
JSON: {"intent": "PROFILE_UPDATE", "amount": 1500, "type": "income"}

User: "5"
JSON: {"intent": "PROFILE_UPDATE", "payDay": 5}

User: "What would your monthly income be? -> I don't want to tell you"
JSON: {"intent": "PROFILE_UPDATE", "amount": null, "type": "income"}

User: "What would your monthly income be? -> I don't have a fixed income"
JSON: {"intent": "PROFILE_UPDATE", "amount": null, "type": "income"}

User: "Please let me know the date you receive your monthly income. -> I don't know"
JSON: {"intent": "PROFILE_UPDATE", "payDay": null}

User: "adicione 649 de saldo"
JSON: {"intent": "RECORD", "amount": 649, "type": "income", "category": "General"}

User: "gastei 50 no mercado"
JSON: {"intent": "RECORD", "amount": 50, "type": "expense", "category": "Food"}

User: "tenho 181 na conta"
JSON: {"intent": "SYNC", "amount": 181, "type": "income"}

User: "apague o ultimo gasto de 25"
JSON: {"intent": "REMOVE", "amount": 25}

Respond ONLY with JSON.`;

    const userPrompt = `Date: ${currentDateTime}
Message: "${messageText}"
JSON:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const content = response.choices[0].message.content;
    const transactionData = JSON.parse(content);

    console.log(`✅ [OpenAI] Success:`, transactionData);

    // Ensure basic structure
    if (transactionData.intent === 'RECORD' || transactionData.intent === 'SYNC') {
        if (!transactionData.amount && transactionData.amount !== 0) {
            transactionData.amount = 0;
        }
        transactionData.type = transactionData.type || 'expense';
        transactionData.category = transactionData.category || (isBrazil ? "Geral" : "General");
    }

    return transactionData;

  } catch (error) {
    console.error(`❌ [OpenAI Error]:`, error.message);
    if (error.status === 429) {
      throw new Error("Rate limit. Tente novamente em instantes.");
    }
    throw error;
  }
}
