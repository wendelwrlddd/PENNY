
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || 'YOUR_API_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName) {
  try {
    console.log(`\nTesting model: ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hello, return only the word OK.");
    const response = await result.response;
    console.log(`✅ ${modelName} works! Response: ${response.text()}`);
    return true;
  } catch (error) {
    console.error(`❌ ${modelName} failed:`, error.message);
    if (error.response) {
       console.error('Response details:', JSON.stringify(error.response, null, 2));
    }
    return false;
  }
}

async function runTests() {
  console.log("Testing latest aliases...");
  await testModel('gemini-flash-latest');
  await testModel('gemini-pro-latest');
  await testModel('gemini-2.0-flash-lite-preview-02-05');
}

runTests();
