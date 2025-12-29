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
- PROFILE_UPDATE: Profile info (e.g. "I earn 2000").
- REMOVE: To remove a wrong entry (e.g. "delete last", "remove 50", "apague o gasto").
- UNCERTAIN: Use if you don't understand the intent.

RULES for RECORD and SYNC:
1. amount: extract numerical value.
2. type: must be "income" or "expense".
   - "income": For keywords like "adicione", "recebi", "ganhei", "salary", "extra", "sobrou".
   - "expense": For "gastei", "paguei", "spent", "comprei", "almoço", "uber", "delivery".
3. category: Suggest a short category from this list ONLY: Food, Transport, Shopping, Leisure, General, Bills.

FEW-SHOT EXAMPLES:
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
