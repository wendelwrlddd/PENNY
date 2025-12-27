
import { GoogleGenerativeAI } from '@google/generative-ai';

// Usando a chave que o usuário forneceu
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Tenta instanciar só pra checar a lib
    console.log('Checking available models...');
    // A lib não tem um método direto 'listModels' na raiz, mas podemos tentar fazer uma chamada simples ou usar a API REST se falhar.
    // Na verdade, a SDK v0.1+ não expõe listModels no client principal facilmente.
    // Vamos tentar um fetch direto na API REST para listar modelos.
    
    // Fallback: usar fetch direto
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.models) {
      console.log('✅ Models found:');
      data.models.forEach(m => console.log(`- ${m.name}`));
    } else {
      console.log('❌ No models found or error:', data);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

listModels();
