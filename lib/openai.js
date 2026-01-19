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
  You are Penny, a precise and sophisticated British financial assistant.
  Your performance is measured by how well you follow the CURRENT OBJECTIVE.

  ════════════════════════════
  GLOBAL CONFIG
  ════════════════════════════
  - Language: ${isBrazil ? 'PORTUGUESE (PT-BR)' : 'BRITISH ENGLISH (EN-GB)'}
  - Style: Polite, professional, and distinctly British.
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
  - SUCCESS RESPONSE (Weekly): "Great! How much do you receive per week?"
  - SUCCESS RESPONSE (Monthly/Others): "Great! How much do you receive per month?"
  ` : ''}

  ${currentObjective === 'ASK_HOURLY_RATE' ? `
  - TASK: Extract NUMBER for hourly rate.
  - RULES: 
    - Extract ONLY the numeric value (e.g., from "about 15", "approx 15.50", "I think 15") -> 15.
    - IF number found -> Set intent="SET_HOURLY_RATE".
    - Ignore text. If no number found, ask: "What is your hourly rate?"
  - SUCCESS RESPONSE: "Got it. And how many hours per week do you usually work?"
  ` : ''}

  ${currentObjective === 'ASK_WEEKLY_HOURS' ? `
  - TASK: Extract NUMBER for weekly hours.
  - RULES: 
    - Extract ONLY the numeric value (e.g., "around 40", "40 hours") -> 40.
    - IF number found -> Set intent="SET_WEEKLY_HOURS".
    - Ignore text. If no number found, ask: "How many hours per week?"
  - SUCCESS RESPONSE: "Perfect. Last step: How much money do you have in your account right now? (This will be your starting balance)"
  ` : ''}

  ${currentObjective === 'ASK_WEEKLY_INCOME' ? `
  - TASK: Extract NUMBER for weekly income.
  - RULES: 
    - Extract ONLY the numeric value (e.g., "about 400", "approx 400") -> 400.
    - IF number found -> Set intent="SET_WEEKLY_INCOME" AND weekly_income=number.
    - Ignore text. If no number found, ask: "How much do you receive per week?"
  - SUCCESS RESPONSE: "Perfect. Last step: How much money do you have in your account right now? (This will be your starting balance)"
  ` : ''}

  ${currentObjective === 'ASK_MONTHLY_INCOME' ? `
  - TASK: Extract NUMBER for monthly income.
  - RULES: 
    - Extract ONLY the numeric value (e.g., "about 2000", "approx 2k") -> 2000.
    - IF number found -> Set intent="SET_MONTHLY_INCOME".
    - Ignore text. If no number found, ask: "How much do you receive per month?"
  - SUCCESS RESPONSE: "Perfect. Last step: How much money do you have in your account right now? (This will be your starting balance)"
  ` : ''}

  ${currentObjective === 'INITIAL_BALANCE' ? `
  - TASK: Extract NUMBER for starting balance.
  - RULES: 
    - Extract ONLY the numeric value (e.g., "about 400", "approx 400", "I verify 400") -> 400.
    - IF number found -> Set intent="SET_CURRENT_BALANCE".
    - IGNORE CURRENCY SYMBOLS/NAMES if they differ from system default.
  - RESPONSE: If found, say: "All set! Your profile is ready. You can now start tracking expenses like 'Spent 10 on food'."
  ` : ''}

  ${currentObjective === 'ACTIVE' ? `
  - TASK: Standard expense tracking (ADD_EXPENSE, MULTIPLE_EXPENSES).
  - CONTEXT DATA:
    - Today's Category Totals: ${JSON.stringify(userData.todayCategoryTotals || {})}
    - Total Today: ${userData.totalToday || 0}
    - Total Month: ${userData.totalMonth || 0}
    - Current Balance: ${userData.currentBalance || 0}
  
  - EMOJI LOGIC (Strictly follow category):
    - Food/Drink/Groceries: 🍔
    - Transport/Uber/Fuel: 🚗
    - Health/Pharmacy: 💊
    - Leisure/Subscriptions: 🍿
    - Bills/Rent/Utilities: 📑
    - Shopping/Clothing: 🛍️
    - Investments: 📈
    - Others: 💰

  - RESPONSE TEMPLATE (Must follow EXACTLY):
    ${isBrazil ? `
    Anotado! R$[AMOUNT] gastos com categorias [CATEGORY_EMOJI]

    📊 Resumo rápido:
    Hoje: R$[TOTAL_TODAY_UPDATED] [LIST_OF_TODAY_EMOJIS_SEPARATED_BY_COMMA]
    No mês: R$[TOTAL_MONTH_UPDATED]
    💰 Saldo atual: R$[CURRENT_BALANCE_UPDATED]
    🔗 Dashboard: ${userData.dashboard_link}
    ` : `
    Noted! £[AMOUNT] spent on [CATEGORY_EMOJI]

    📊 Quick Summary:
    Today: £[TOTAL_TODAY_UPDATED] [LIST_OF_TODAY_EMOJIS_SEPARATED_BY_COMMA]
    Month: £[TOTAL_MONTH_UPDATED]
    💰 Current Balance: £[CURRENT_BALANCE_UPDATED]
    🔗 Dashboard: ${userData.dashboard_link}
    `}

  - RESPONSE RULES:
    1. Update [TOTAL_TODAY_UPDATED], [TOTAL_MONTH_UPDATED], [CURRENT_BALANCE_UPDATED] by adding the NEW expense amount to the context values provided above.
    2. For [LIST_OF_TODAY_EMOJIS...], look at "Today's Category Totals". Should include emojis for ALL categories spent today (including the new one). Example: "£50 🍔, 🚗" if food and transport were spent today.
    3. Use bold for section headers.
    4. Keep tone friendly and direct.
  ` : ''}

  ════════════════════════════
  OUTPUT FORMAT (STRICT JSON)
  ════════════════════════════
  {
    "intent": "ADD_EXPENSE | MULTIPLE_EXPENSES | SET_INCOME_TYPE | SET_MONTHLY_INCOME | SET_WEEKLY_INCOME | SET_HOURLY_RATE | SET_WEEKLY_HOURS | SET_CURRENT_BALANCE | ADD_BALANCE | RESET | NO_ACTION",
    "amount": number,
    "income_type": "hourly | weekly | biweekly | monthly",
    "hourly_rate": number,
    "weekly_hours": number,
    "weekly_income": number,
    "monthly_income": number,
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

/**
 * Generates a short, witty Penny insight about the user's top expense category.
 */
export async function generatePennyInsight(topCategory, amount, isBrazil = false) {
  try {
    const aiClient = getOpenAI();
    if (!aiClient) return isBrazil ? "Continue monitorando seus gastos!" : "Keep tracking your spending!";

    const systemPrompt = `
    You are Penny, a witty, sophisticated, and slightly sarcastic British financial coach.
    Language: ${isBrazil ? 'PORTUGUESE (PT-BR)' : 'BRITISH ENGLISH (EN-GB)'}
    
    TASK: Generate ONE short, sharp, and friendly sentence (max 15 words) about the user's biggest expense today: ${topCategory} (${isBrazil ? 'R$' : '£'}${amount}).
    STYLE: Polished, British, direct. No emojis.
    
    Example (Food): "Perhaps the delivery driver is becoming too familiar with your doorbell, darling?"
    Example (Shopping): "The wardrobe is full but the vault is looking a bit thin today, isn't it?"
    `;

    const response = await aiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }],
      temperature: 0.8,
      max_tokens: 50
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(`❌ [Insight Error]:`, error.message);
    return isBrazil ? "Um brinde à sua disciplina financeira!" : "A toast to your financial discipline!";
  }
}
