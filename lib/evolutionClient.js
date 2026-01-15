import axios from 'axios';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

const api = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * Envia uma mensagem de texto simples
 * @param {string} phone Número no formato 55... (com ou sem @s.whatsapp.net)
 * @param {string} text Conteúdo da mensagem
 */
export async function sendTextMessage(phone, text) {
  try {
    const number = phone.includes('@') ? phone.split('@')[0] : phone;
    const response = await api.post(`/message/sendText/${EVOLUTION_INSTANCE}`, {
      number: number,
      options: {
        delay: 1200,
        presence: 'composing',
        linkPreview: false
      },
      textMessage: {
        text: text
      }
    });
    return response.data;
  } catch (error) {
    console.error('[Evolution] Error sending text:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Envia status de 'composing' (digitando...)
 * @param {string} phone 
 */
export async function sendTyping(phone) {
  try {
    const number = phone.includes('@') ? phone.split('@')[0] : phone;
    const response = await api.post(`/chat/sendPresence/${EVOLUTION_INSTANCE}`, {
      number: number,
      presence: 'composing',
      delay: 1200
    });
    return response.data;
  } catch (error) {
    console.error('[Evolution] Error sending presence:', error.response?.data || error.message);
    // Não lançamos erro aqui para não travar o fluxo principal se o presence falhar
  }
}
