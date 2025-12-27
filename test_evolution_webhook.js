import axios from 'axios';

const LOCAL_WEBHOOK_URL = 'http://localhost:8080/api/webhook'; // Adjust if needed

const mockEvolutionPayload = {
  "event": "messages.upsert",
  "instance": "PennyBot",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "ABC123DEF456"
    },
    "message": {
      "conversation": "Almoço hoje 35 reais"
    },
    "messageTimestamp": 1672012800
  }
};

async function testWebhook() {
  console.log('🧪 Testing Evolution API Webhook locally...');
  try {
    const response = await axios.post(LOCAL_WEBHOOK_URL, mockEvolutionPayload);
    console.log('✅ Webhook Response:', response.data);
  } catch (error) {
    console.error('❌ Webhook Test Failed:', error.response?.data || error.message);
  }
}

testWebhook();
