import axios from 'axios';

const api = axios.create({
  baseURL: process.env.EVOLUTION_API_URL,
  headers: {
    apikey: process.env.EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// Add detailed logging for errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      console.error('[Evolution API Error]', JSON.stringify(error.response.data));
    } else {
        console.error('[Evolution API Error] No response:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch all instances
 */
export async function fetchInstances() {
  const { data } = await api.get('/instance/fetchInstances');
  return data;
}

/**
 * Initialize/Connect instance and get QR Code
 * v1.8: /instance/connect returns { code, base64, count }
 */
export async function connectInstance() {
  // Ensure instance exists first (idempotent in v1.8 usually)
  try {
    await api.post('/instance/create', { instanceName: process.env.EVOLUTION_INSTANCE });
  } catch (e) {
    // Ignore if already exists or other non-critical error, connect usually handles it
    console.log('Instance creation check:', e.message);
  }

  // Connect and get QR
  const { data } = await api.get(`/instance/connect/${process.env.EVOLUTION_INSTANCE}`);
  return data;
}

/**
 * Get status
 * v1.8: /instance/connectionState/:instance
 */
export async function getStatus() {
  const { data } = await api.get(`/instance/connectionState/${process.env.EVOLUTION_INSTANCE}`);
  return data;
}

/**
 * Send presence status (typing, recording, available)
 * v1.8: /chat/sendPresence/:instance
 */
export async function sendPresence(number, presence = 'composing') {
  return api.post(`/chat/sendPresence/${process.env.EVOLUTION_INSTANCE}`, {
    number,
    presence,
    delay: 1200
  });
}

/**
 * Send text message
 * v1.8: /message/sendText/:instance
 */
export async function sendMessage(number, message) {
  return api.post(`/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
    number,
    options: {
      delay: 1200,
      presence: 'composing',
      linkPreview: false
    },
    textMessage: {
      text: message
    }
  });
}

