
import axios from 'axios';

const API_URL = 'https://penny-evolution-api.fly.dev';
const API_KEY = 'n9i8skxugfzy3w97vftz'; // Updated Key from user

async function checkStatus() {
  console.log("🔍 Checking Evolution API Status at", API_URL);

  try {
    // 1. List Instances
    console.log("\n1️⃣  Fetching Instances...");
    const resInstances = await axios.get(`${API_URL}/instance/fetchInstances`, {
        headers: { apikey: API_KEY }
    });
    
    // The structure might vary, usually it returns an array
    const instances = resInstances.data;
    console.log("   Found:", instances.map(i => `${i.name || i.instance.name} [${i.status || i.instance.status}]`).join(", "));

    // 2. For each instance, check Webhook
    for (const i of instances) {
        const name = i.name || i.instance.name;
        console.log(`\n2️⃣  Checking Webhook for '${name}'...`);
        try {
            const resWebhook = await axios.get(`${API_URL}/webhook/find/${name}`, {
                headers: { apikey: API_KEY }
            });
            console.log(`   Webhook Config:`, JSON.stringify(resWebhook.data, null, 2));
        } catch (e) {
            console.log(`   ❌ Could not fetch webhook for ${name}: ${e.message}`);
        }
    }

  } catch (error) {
    console.error("❌ Fatal Error checking status:", error.message);
    if(error.response) console.error("   Response:", error.response.data);
  }
}

checkStatus();
