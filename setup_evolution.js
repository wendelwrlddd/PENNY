import { createInstance, setWebhook, connectInstance } from './lib/evolution.js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const instanceName = process.argv[2] || 'PennyBot';
const webhookUrl = process.argv[3];
const apiURL = process.argv[4] || process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const apiKey = process.argv[5] || process.env.EVOLUTION_API_KEY || 'SuaChaveMestra123';

async function setup() {
  console.log(`🚀 Starting setup for instance: ${instanceName}`);
  console.log(`🌐 API URL: ${apiURL}`);
  
  let instance;
  try {
    instance = await createInstance(instanceName, apiURL, apiKey);
    console.log('✅ Instance created successfully!');
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('ℹ️ Instance already exists. Fetching connection data...');
      instance = await connectInstance(instanceName, apiURL, apiKey);
    } else {
      console.error('❌ Setup failed during creation.');
      return;
    }
  }

  if (instance.qrcode?.base64) {
    console.log('📷 QR Code Base64 found!');
    const base64Data = instance.qrcode.base64.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync('qrcode.png', base64Data, 'base64');
    console.log('💾 QR Code saved to qrcode.png');
  } else {
    console.log('ℹ️ Instance already connected or QR code not available.');
  }

  if (webhookUrl) {
    console.log(`🔗 Updating webhook to: ${webhookUrl}`);
    await setWebhook(instanceName, webhookUrl, apiURL, apiKey);
    console.log('✅ Webhook updated!');
  }
}

setup();
