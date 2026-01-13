import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'SuaChaveMestra123';

/**
 * Creates a new instance in Evolution API
 * @param {string} instanceName 
 * @param {string} apiUrl
 * @param {string} apiKey
 */
export async function createInstance(instanceName, apiUrl = EVOLUTION_API_URL, apiKey = EVOLUTION_API_KEY) {
  try {
    const response = await axios.post(`${apiUrl}/instance/create`, {
      instanceName,
      qrcode: true,
      token: apiKey
    }, {
      headers: { 'apikey': apiKey }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error creating instance:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Sets the webhook for a specific instance
 * @param {string} instanceName 
 * @param {string} webhookUrl 
 * @param {string} apiUrl
 * @param {string} apiKey
 */
export async function setWebhook(instanceName, webhookUrl, apiUrl = EVOLUTION_API_URL, apiKey = EVOLUTION_API_KEY) {
  try {
    const response = await axios.post(`${apiUrl}/webhook/set/${instanceName}`, {
      url: webhookUrl,
      enabled: true,
      events: ["MESSAGES_UPSERT"]
    }, {
      headers: { 'apikey': apiKey }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error setting webhook:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Connects/Fetches QR code for an existing instance
 * @param {string} instanceName 
 * @param {string} apiUrl
 * @param {string} apiKey
 */
export async function connectInstance(instanceName, apiUrl = EVOLUTION_API_URL, apiKey = EVOLUTION_API_KEY) {
  try {
    const response = await axios.get(`${apiUrl}/instance/connect/${instanceName}`, {
      headers: { 'apikey': apiKey }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error connecting instance:', error.response?.data || error.message);
    throw error;
  }
}

export async function deleteInstance(instanceName, apiUrl = EVOLUTION_API_URL, apiKey = EVOLUTION_API_KEY) {
  try {
    const response = await axios.delete(`${apiUrl}/instance/delete/${instanceName}`, {
      headers: { 'apikey': apiKey }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error deleting instance:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Logs out an existing instance (keeps it created but unlinked)
 * @param {string} instanceName 
 * @param {string} apiUrl
 * @param {string} apiKey
 */
export async function logoutInstance(instanceName, apiUrl = EVOLUTION_API_URL, apiKey = EVOLUTION_API_KEY) {
  try {
    const response = await axios.post(`${apiUrl}/instance/logout/${instanceName}`, {}, {
      headers: { 'apikey': apiKey }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error logging out instance:', error.response?.data || error.message);
    throw error;
  }
}
/**
 * Sets user presence (composing, recording, etc)
 * @param {string} instanceName 
 * @param {string} number 
 * @param {string} presence "composing" | "recording" | "available" | "unavailable"
 */
export async function sendPresence(instanceName, number, presence, apiUrl = EVOLUTION_API_URL, apiKey = EVOLUTION_API_KEY) {
  // 🆕 Try to use Baileys first
  try {
      if (getConnectionStatus()) {
          await baileysSendPresence(number, presence);
          return { success: true, provider: 'baileys' };
      }
  } catch (e) {
      console.warn('⚠️ [Adapter] Baileys presence check failed:', e.message);
  }

  const cleanDigits = number.replace(/\D/g, '');
  const formattedNumber = cleanDigits.includes('@') ? cleanDigits : `${cleanDigits}@s.whatsapp.net`;
  
  try {
    // Try new route (v1.6+)
    await axios.post(`${apiUrl}/chat/updatePresence/${instanceName}`, {
      number: formattedNumber,
      presence: presence
    }, { headers: { 'apikey': apiKey } });
  } catch (e) {
    // Fallback to old route
    // console.log(`[Evolution] updatePresence failed, trying /presence...`);
    await axios.post(`${apiUrl}/chat/presence/${instanceName}`, {
      number: formattedNumber,
      presence: presence
    }, { headers: { 'apikey': apiKey } }).catch(() => {});
  }
}

import { sendTextMessage as baileysSendText, sendPresence as baileysSendPresence, getConnectionStatus } from './baileys.js';

/**
 * Sends a text message via Evolution API or Baileys
 * @param {string} instanceName 
 * @param {string} number 
 * @param {string} text 
 * @param {string} apiUrl 
 * @param {string} apiKey 
 */
export async function sendMessage(instanceName, number, text, apiUrl = EVOLUTION_API_URL, apiKey = EVOLUTION_API_KEY) {
    console.log(`[SendMessage] DEBUG: Called with number=${number}, text=${text?.substring(0, 20)}...`);
    
    // 🆕 Try to use Baileys first
    try {
        const isConnected = getConnectionStatus();
        console.log(`[SendMessage] DEBUG: Baileys connected? ${isConnected}`);
        
        if (isConnected) {
            console.log(`[Adapter] Using Baileys to send message to ${number}`);
            await baileysSendText(number, text);
            return { success: true, provider: 'baileys' };
        }
    } catch (e) {
        console.warn('⚠️ [Adapter] Baileys check failed:', e);
    }
    
    // 1. Clean the number - try without suffix first, then with @s.whatsapp.net if needed
    const cleanDigits = number.replace(/\D/g, ''); 
    
    // 2. Clean Text: Normalize Unicode (Smart Quotes, etc)
    let cleanText = text
        .replace(/['']/g, "'")   // Smart quotes -> '
        .replace(/[""]/g, '"')   // Smart double quotes -> "
        .replace(/\u00A0/g, ' ') // Non-breaking space -> space
        .replace(/–/g, '-')      // En-dash -> -
        .replace(/—/g, '--')     // Em-dash -> --
        .replace(/1️⃣/g, '1)')
        .replace(/2️⃣/g, '2)')
        .replace(/3️⃣/g, '3)')
        .replace(/4️⃣/g, '4)')
        .replace(/5️⃣/g, '5)')
        .replace(/6️⃣/g, '6)')
        .replace(/7️⃣/g, '7)')
        .replace(/8️⃣/g, '8)')
        .replace(/9️⃣/g, '9)')
        .replace(/0️⃣/g, '0)');

    // 3. CORRECT Payload according to Evolution API docs
    const payload = {
        number: cleanDigits,
        textMessage: {
            text: cleanText
        },
        options: {
            delay: 1200,
            presence: "composing",
            linkPreview: false
        }
    };
    
    try {
        // Try with clean number first
        const response = await axios.post(`${apiUrl}/message/sendText/${instanceName}`, payload, {
            headers: { 'apikey': apiKey }
        });
        return response.data;
    } catch (err) {
        console.log(`[Evolution] Send failed with clean number. Trying with @s.whatsapp.net suffix...`);
        
        // Fallback: try with @s.whatsapp.net suffix
        payload.number = `${cleanDigits}@s.whatsapp.net`;
        
        try {
            const response = await axios.post(`${apiUrl}/message/sendText/${instanceName}`, payload, {
                headers: { 'apikey': apiKey }
            });
            return response.data;
        } catch (finalErr) {
            console.error('❌ Error sending message (both formats failed):', finalErr.response?.data || finalErr.message);
            console.error('Payload used:', JSON.stringify(payload, null, 2));
            throw finalErr;
        }
    }
}
