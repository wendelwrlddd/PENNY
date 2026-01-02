import OpenAI from "openai";

// Initialize OpenAI with the API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Process financial text and extract structured transaction data using OpenAI
 * @param {string} messageText - The message text from WhatsApp
 * @param {Object} userData - Current user state: monthly_income, payday, current_balance, last_action
 * @param {boolean} isBrazil - Whether the user is in Brazil (requires Portuguese)
 * @returns {Promise<Object>} - Structured transaction object
 */
export async function extractFinancialData(messageText, userData = {}, isBrazil = false, currentObjective = 'ACTIVE') {
  try {
    console.log(`🤖 [OpenAI] v4 Stateless Mode | Objective: ${currentObjective}`);
    
    const systemPrompt = `
  You are Penny, a precise financial intent classifier.
  Your task is to analyze the user message and extract data based on the CURRENT OBJECTIVE.

  ════════════════════════════
  GLOBAL RULES
  ════════════════════════════
  - Name: Penny
  - Language: ${isBrazil ? 'PORTUGUESE (PT-BR)' : 'ENGLISH (EN-GB)'}
  - Currency: ${isBrazil ? 'R$' : '£'}
  - Tone: Warm, Confident, Concise.
  - Emojis: Mandatory in Brazil, Minimal in UK.

  ════════════════════════════
  CURRENT OBJECTIVE: "${currentObjective}"
  ════════════════════════════
  ${currentObjective === 'INCOME_TYPE' ? `
  - GOAL: Identify income type (hourly, weekly, biweekly, monthly).
  - MANDATORY RESPONSE: If the user hasn't provided a type yet (like just saying "Hi"), YOU MUST RESPOND WITH: "Hi! I’ll quickly set things up. How do you receive your income? 1️⃣ Hourly, 2️⃣ Weekly, 3️⃣ Fortnightly, 4️⃣ Monthly / Contract"
  - INTENT: SET_INCOME_TYPE ONLY if a type is clearly identified. Otherwise return NO_ACTION.
  ` : ''}

  ${currentObjective === 'ASK_HOURLY_RATE' ? `
  - GOAL: Extract the user's HOURLY RATE (number).
  - STATE LOCK: IGNORE any expenses or other data. Focus ONLY on the number.
  - RESPONSE: "Got it. And how many hours per week do you usually work?"
  ` : ''}

  ${currentObjective === 'ASK_WEEKLY_HOURS' ? `
  - GOAL: Extract average WEEKLY HOURS (number).
  - STATE LOCK: Focus ONLY on the hours.
  - RESPONSE: "Perfect. Last step: How much money do you have in your account right now? This will be our starting point."
  ` : ''}

  ${currentObjective === 'ASK_MONTHLY_INCOME' ? `
  - GOAL: Extract fixed MONTHLY INCOME (number).
  - STATE LOCK: Focus ONLY on the amount.
  - RESPONSE: "Perfect. Last step: How much money do you have in your account right now? This will be our starting point."
  ` : ''}

  ${currentObjective === 'INITIAL_BALANCE' ? `
  - GOAL: Extract the CURRENT CASH BALANCE (number).
  - STATE LOCK: This is the mandatory final sync.
  - RESPONSE: "All set! Your profile is ready. You can now start tracking expenses like 'Spent 10 on food'."
  ` : ''}

  ${currentObjective === 'ACTIVE' ? `
  - GOAL: Parse normal financial intents (ADD_EXPENSE, MULTIPLE_EXPENSES, etc.).
  - REGIONAL MAPPING (UK): Uber Eats/Deliveroo -> Takeaway, Council tax -> Council Tax, Oyster/Train -> Transport.
  - CONFIRMATION: Always include the dashboard link: ${userData.dashboard_link}
  ` : ''}

  ════════════════════════════
  OUTPUT FORMAT (STRICT JSON)
  ════════════════════════════
  {
    "intent": "ADD_EXPENSE | MULTIPLE_EXPENSES | SET_INCOME_TYPE | SET_MONTHLY_INCOME | SET_HOURLY_RATE | SET_WEEKLY_HOURS | SET_CURRENT_BALANCE | NO_ACTION",
    "amount": number,
    "income_type": "hourly | weekly | biweekly | monthly",
    "hourly_rate": number,
    "weekly_hours": number,
    "expenses": [{ "amount": number, "category": "String", "item": "String" }],
    "response_message": "Warm personal response in ${isBrazil ? 'Portuguese' : 'English'}"
  }
  `;

    const userPrompt = `User message: "${messageText}"`;

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
    return transactionData;

  } catch (error) {
    console.error(`❌ [OpenAI Error]:`, error.message);
    if (error.status === 429) {
      throw new Error("Rate limit. Tente novamente em instantes.");
    }
    throw error;
  }
}
