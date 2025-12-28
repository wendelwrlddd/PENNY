
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = 'AIzaSyDKei2kfupyG69w6crs-I5s2HxMOuDtBng';
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    console.log('Checking models for key:', apiKey.substring(0, 10) + '...');
    const result = await genAI.listModels();
    console.log('Available Models:');
    result.models.forEach(m => {
      console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods})`);
    });
  } catch (error) {
    console.error('❌ Error listing models:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

listModels();
