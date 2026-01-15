import axios from 'axios';

const URL = 'https://penny-finance-backend.fly.dev/webhook/whatsapp';

async function testWebhook() {
  console.log(`📡 Testing Webhook Connectivity: ${URL}`);
  const start = Date.now();

  try {
    const response = await axios.post(URL, {}, {
      timeout: 5000, // 5s timeout check
      validateStatus: () => true // Accept any status code (we want to see what it returns)
    });

    const duration = Date.now() - start;
    console.log(`\n✅ RESPONSE RECEIVED in ${duration}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Body:', response.data);

    if (response.status === 200 || response.status === 201) {
        console.log('\n🎉 CONCLUSION: Webhook is PUBLIC and ACCESSIBLE!');
    } else {
        console.log('\n⚠️ CONCLUSION: Webhook is reachable but returned an error status.');
    }

  } catch (error) {
    const duration = Date.now() - start;
    console.log(`\n❌ ERROR in ${duration}ms`);
    if (error.code === 'ECONNABORTED') {
        console.log('Reason: TIMEOUT (Server took too long)');
    } else {
        console.log('Reason:', error.message);
    }
  }
}

testWebhook();
