import { deleteInstance, createInstance, setWebhook } from './lib/evolution.js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const instanceName = process.argv[2] || 'PennyBot';
const webhookUrl = process.argv[3] || 'https://penny-finance-backend.fly.dev/webhook';
const apiURL = process.argv[4] || 'https://penny-evolution-api.fly.dev';
const apiKey = process.argv[5] || 'SuaChaveMestra123';

async function reset() {
  console.log(`♻️ Resetting instance: ${instanceName}`);
  
  try {
    await deleteInstance(instanceName, apiURL, apiKey);
    console.log('✅ Previous instance deleted.');
  } catch (e) {
    console.log('ℹ️ No previous instance to delete or error during deletion.');
  }

  console.log('🚀 Creating fresh instance...');
  const instance = await createInstance(instanceName, apiURL, apiKey);
  console.log('✅ Instance created successfully!');

  if (instance.qrcode?.base64) {
    const base64Data = instance.qrcode.base64.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync('qrcode.png', base64Data, 'base64');
    console.log('💾 QR Code saved to qrcode.png');
  }

  if (webhookUrl) {
    console.log(`🔗 Setting webhook to: ${webhookUrl}`);
    await setWebhook(instanceName, webhookUrl, apiURL, apiKey);
    console.log('✅ Webhook configured!');
  }
}

reset();
