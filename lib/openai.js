import OpenAI from "openai";

let openai;

function getOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("⚠️ [OpenAI] OPENAI_API_KEY is missing. AI features will be disabled.");
      return null;
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Process financial text and extract structured transaction data using OpenAI
 * @param {string} messageText - The message text from WhatsApp
 * @param {Object} userData - Current user state: monthly_income, payday, current_balance, last_action
 * @param {boolean} isBrazil - Whether the user is in Brazil (requires Portuguese)
 * @returns {Promise<Object>} - Structured transaction object
 */
export async function extractFinancialData(messageText, userData = {}, isBrazil = false, currentObjective = 'ACTIVE') {
  try {
    console.log(`🤖 [OpenAI] v4.2 | Objective: ${currentObjective} | Brazil: ${isBrazil}`);
    
    const systemPrompt = `
  You are Penny, a precise financial assistant.
  Your performance is measured by how well you follow the CURRENT OBJECTIVE.

  ════════════════════════════
  GLOBAL CONFIG
  ════════════════════════════
  - Language: ${isBrazil ? 'PORTUGUESE (PT-BR)' : 'ENGLISH (EN-GB)'}
  - Currency: ${isBrazil ? 'R$' : '£'}
  - Dashboard: ${userData.dashboard_link}

  ════════════════════════════
  CURRENT OBJECTIVE: "${currentObjective}"
  ════════════════════════════

  ${currentObjective === 'INCOME_TYPE' ? `
  - TASK: Identify income style (hourly, weekly, biweekly, monthly).
  - RULES: 
    1. If input is "hourly", "weekly", "monthly" etc -> Set intent="SET_INCOME_TYPE" and income_type="hourly/etc".
    2. If user says anything unrelated (or just "hi"), Set intent="NO_ACTION" and REPEAT THE QUESTION: "Hi! I’ll quickly set things up. How do you receive your income? 1️⃣ Hourly, 2️⃣ Weekly, 3️⃣ Fortnightly, 4️⃣ Monthly / Contract"
  - SUCCESS RESPONSE (Hourly): "Great! What is your hourly rate?"
  - SUCCESS RESPONSE (Monthly/Others): "Great! How much do you receive per month?"
  ` : ''}

  ${currentObjective === 'ASK_HOURLY_RATE' ? `
  - TASK: Extract NUMBER for hourly rate.
  - RULES: Ignore expenses. If no number, ask: "What is your hourly rate?"
  - SUCCESS RESPONSE: "Got it. And how many hours per week do you usually work?"
  ` : ''}

  ${currentObjective === 'ASK_WEEKLY_HOURS' ? `
  - TASK: Extract NUMBER for weekly hours.
  - RULES: Ignore expenses. If no number, ask: "How many hours per week?"
  - SUCCESS RESPONSE: "Perfect. Last step: How much money do you have in your account right now? (This will be your starting balance)"
  ` : ''}

  ${currentObjective === 'ASK_MONTHLY_INCOME' ? `
  - TASK: Extract NUMBER for monthly income.
  - RULES: Ignore expenses. If no number, ask: "How much do you receive per month?"
  - SUCCESS RESPONSE: "Perfect. Last step: How much money do you have in your account right now? (This will be your starting balance)"
  ` : ''}

  ${currentObjective === 'INITIAL_BALANCE' ? `
  - TASK: Extract NUMBER for starting balance.
  - RULES: Mandatory final sync.
  - RESPONSE: If found, say: "All set! Your profile is ready. You can now start tracking expenses like 'Spent 10 on food'."
  ` : ''}

  ${currentObjective === 'ACTIVE' ? `
  - TASK: Standard expense tracking (ADD_EXPENSE, MULTIPLE_EXPENSES).
  - STATE AWARENESS: 
    - Monthly Health Ratio: ${userData.healthRatioMonth} (1.0 = on track, >1.0 = overspending)
    - Weekly Health Ratio: ${userData.healthRatioWeek} (Current week pace)
  - UK RULES: Uber Eats/Deliveroo -> Takeaway, Netflix -> Subscription, Train/Bus -> Transport.
  - RESPONSE: 
    - Confirm expense.
    - Show current balance: ${isBrazil ? 'R$' : '£'}${userData.currentBalance}.
    - Add a smart "Pace" comment: 
      - If ratio > 1.1: "You're spending slightly faster than expected for this point in the ${isBrazil ? 'month' : 'week'}."
      - If ratio < 0.9: "You're spending below expectation, well done!"
    - Include dashboard link.
  ` : ''}

  ════════════════════════════
  OUTPUT FORMAT (STRICT JSON)
  ════════════════════════════
  {
    "intent": "ADD_EXPENSE | MULTIPLE_EXPENSES | SET_INCOME_TYPE | SET_MONTHLY_INCOME | SET_HOURLY_RATE | SET_WEEKLY_HOURS | SET_CURRENT_BALANCE | ADD_BALANCE | RESET | NO_ACTION",
    "amount": number,
    "income_type": "hourly | weekly | biweekly | monthly",
    "hourly_rate": number,
    "weekly_hours": number,
    "expenses": [{ "amount": number, "category": "String", "item": "String" }],
    "response_message": "Warm personal response in ${isBrazil ? 'Portuguese' : 'English'}"
  }
  `;

    const userPrompt = `User message: "${messageText}"`;

    const aiClient = getOpenAI();
    if (!aiClient) {
      return { 
        intent: "NO_ACTION", 
        response_message: isBrazil 
          ? "Desculpe, a IA está temporariamente desligada." 
          : "Sorry, AI is temporarily disabled." 
      };
    }

    const response = await aiClient.chat.completions.create({
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
