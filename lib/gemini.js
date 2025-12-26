// Google Gemini AI Configuration
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Process financial text and extract structured transaction data
 * @param {string} messageText - The message text from WhatsApp
 * @returns {Promise<Object>} - Structured transaction object
 */
export async function extractFinancialData(messageText) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const systemPrompt = `You are a financial accountant. Extract data from the text. Return ONLY a JSON with: amount (number), currency (symbol like £), category (string), description (string), date (ISO string), type (expense or income). Market: UK.`;

    const prompt = `${systemPrompt}\n\nText: "${messageText}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (remove markdown code blocks if present)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }

    const transactionData = JSON.parse(jsonMatch[0]);
    return transactionData;
  } catch (error) {
    console.error('Error extracting financial data:', error);
    throw error;
  }
}
