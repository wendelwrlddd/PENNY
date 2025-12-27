
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in environment');
  process.exit(1);
}

console.log('🔑 API Key found:', apiKey.substring(0, 5) + '...');

async function testGemini() {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Trying the exact string used in production
  const modelName = 'gemini-1.5-flash';
  
  console.log(`🤖 Testing model: ${modelName}`);
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const result = await model.generateContent('Hello, are you working?');
    const response = await result.response;
    console.log('✅ Success! Response:', response.text());
  } catch (error) {
    console.error('❌ Error testing model:', error.message);
    if (error.status === 404) {
      console.error('⚠️ 404 Not Found - This usually means the model name is wrong or not available.');
    }
  }
}

testGemini();
