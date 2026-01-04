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
  try {
    const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    const response = await axios.post(`${apiUrl}/chat/presence/${instanceName}`, {
      number: jid,
      presence: presence
    }, {
      headers: { 'apikey': apiKey }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error sending presence:', error.response?.data || error.message);
    // Non-critical: Don't throw to avoid breaking the main flow
    return null;
  }
}

/**
 * Sends a text message via Evolution API
 * @param {string} instanceName 
 * @param {string} number 
 * @param {string} text 
 * @param {string} apiUrl 
 * @param {string} apiKey 
 */
export async function sendMessage(instanceName, number, text, apiUrl = EVOLUTION_API_URL, apiKey = EVOLUTION_API_KEY) {
  try {
    // A Evolution API espera o número no formato com @s.whatsapp.net ou apenas o número
    // Vamos garantir que enviamos para o JID correto
    const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    
    const response = await axios.post(`${apiUrl}/message/sendText/${instanceName}`, {
      number: jid,
      options: {
        delay: 1200,
        presence: "composing",
        linkPreview: true
      },
      textMessage: {
        text: text
      }
    }, {
      headers: { 'apikey': apiKey }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error sending message:', error.response?.data || error.message);
    throw error;
  }
}
