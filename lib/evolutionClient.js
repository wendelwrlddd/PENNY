import axios from 'axios';

const api = axios.create({
  baseURL: process.env.EVOLUTION_API_URL,
  headers: {
    apikey: process.env.EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

/**
 * Fetch all instances from Evolution API
 */
export async function fetchInstances() {
  const { data } = await api.get('/instance/fetchInstances');
  return data;
}

/**
 * Trigger QR code generation for the instance
 */
export async function connectInstance() {
  return api.get(`/instance/connect/${process.env.EVOLUTION_INSTANCE}`);
}

/**
 * Get QR code data
 */
export async function getQrCode() {
  const { data } = await api.get(`/instance/qr/${process.env.EVOLUTION_INSTANCE}`);
  return data;
}

/**
 * Get connection status
 */
export async function getStatus() {
  const { data } = await api.get(`/instance/connectionState/${process.env.EVOLUTION_INSTANCE}`);
  return data;
}

/**
 * Send a text message via WhatsApp
 * @param {string} number - Phone number with country code (e.g., "5511999999999")
 * @param {string} message - Message text to send
 */
export async function sendMessage(number, message) {
  return api.post(`/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
    number,
    textMessage: {
      text: message
    }
  });
}
