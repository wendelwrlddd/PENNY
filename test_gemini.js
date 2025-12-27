import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function list() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent("test");
    console.log("SUCCESS WITH 1.5-FLASH");
  } catch (e) {
    console.error("FAIL WITH 1.5-FLASH:", e.message);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const result = await model.generateContent("test");
    console.log("SUCCESS WITH 1.5-PRO");
  } catch (e) {
    console.error("FAIL WITH 1.5-PRO:", e.message);
  }
}

list();
