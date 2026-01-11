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

/**
 * Sends a text message via Evolution API
 * @param {string} instanceName 
 * @param {string} number 
 * @param {string} text 
 * @param {string} apiUrl 
 * @param {string} apiKey 
 */
export async function sendMessage(instanceName, number, text, apiUrl = EVOLUTION_API_URL, apiKey = EVOLUTION_API_KEY) {
    // 1. Use the EXACT JID provided if it contains '@', otherwise add suffix
    const finalJid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    
    // 2. Clean Text: Remove complex emojis that might break older APIs (optional but safe)
    // Replacing specific keycap emojis with simple text
    let cleanText = text
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

    // 3. Payload V2 (Simplified) - Removed linkPreview
    const payloadV2 = {
        number: finalJid,
        text: cleanText,
        delay: 1200,
        linkPreview: false // Disabled to avoid 400 Bad Request
    };

    // 4. Payload V1 (Nested) - Removed linkPreview
    const payloadV1 = {
        number: finalJid,
        options: { delay: 1200, presence: "composing", linkPreview: false },
        textMessage: { text: cleanText }
    };
    
    try {
        // Try V2 first
        const response = await axios.post(`${apiUrl}/message/sendText/${instanceName}`, payloadV2, {
            headers: { 'apikey': apiKey }
        });
        return response.data;
    } catch (errV2) {
        console.log(`[Evolution] V2 send failed (${errV2.response?.status || errV2.message}). Trying V1 fallback...`);
        
        try {
            // Fallback to V1
            const response = await axios.post(`${apiUrl}/message/sendText/${instanceName}`, payloadV1, {
                headers: { 'apikey': apiKey }
            });
            return response.data;
        } catch (errV1) {
             console.log(`[Evolution] V1 send failed. Trying V3 (Legacy Plain) fallback...`);
             // Fallback to V3
              const payloadV3 = {
                number: finalJid,
                options: { delay: 1200, presence: "composing", linkPreview: false },
                text: cleanText
            };
             try {
                const response = await axios.post(`${apiUrl}/message/sendText/${instanceName}`, payloadV3, {
                    headers: { 'apikey': apiKey }
                });
                return response.data;
             } catch(finalErr) {
                 console.error('❌ Error sending message (All versions failed):', finalErr.response?.data || finalErr.message);
                 console.error('Data being sent (V2):', JSON.stringify(payloadV2, null, 2));
                 throw finalErr;
             }
        }
    }
}
