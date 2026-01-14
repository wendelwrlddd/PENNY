import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://penny-evolution-api.fly.dev';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'PENNY_SECURE_KEY_2024';
const INSTANCE_NAME = 'penny';

console.log('🔧 Evolution API Setup Helper');
console.log('================================');
console.log(`API URL: ${EVOLUTION_API_URL}`);
console.log(`Instance: ${INSTANCE_NAME}`);
console.log('');

async function setupEvolution() {
    try {
        // 1. Check if instance exists
        console.log('📡 Checking existing instances...');
        try {
            const fetchResponse = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                headers: { 'apikey': EVOLUTION_API_KEY }
            });
            console.log('✅ Instances found:', fetchResponse.data);
        } catch (e) {
            console.log('⚠️ Could not fetch instances:', e.response?.data || e.message);
        }

        // 2. Try to connect (get QR code)
        console.log('\n📱 Attempting to get QR Code...');
        try {
            const connectResponse = await axios.get(`${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`, {
                headers: { 'apikey': EVOLUTION_API_KEY }
            });
            
            if (connectResponse.data.qrcode) {
                console.log('\n✅ QR CODE GERADO!');
                console.log('================================');
                console.log(connectResponse.data.qrcode.code);
                console.log('================================');
                console.log('\n📱 Escaneie o QR Code acima com seu WhatsApp!');
                console.log(`🌐 Ou acesse: ${EVOLUTION_API_URL}/instance/qr/${INSTANCE_NAME}`);
            } else if (connectResponse.data.instance?.state === 'open') {
                console.log('✅ WhatsApp já está conectado!');
            } else {
                console.log('Response:', connectResponse.data);
            }
        } catch (e) {
            console.log('⚠️ Connect failed:', e.response?.data || e.message);
            
            // 3. If connect fails, try to create instance
            console.log('\n🆕 Trying to create new instance...');
            try {
                const createResponse = await axios.post(`${EVOLUTION_API_URL}/instance/create`, {
                    instanceName: INSTANCE_NAME,
                    qrcode: true,
                    integration: 'WHATSAPP-BAILEYS'
                }, {
                    headers: { 'apikey': EVOLUTION_API_KEY }
                });
                
                console.log('✅ Instance created!');
                console.log(createResponse.data);
                
                if (createResponse.data.qrcode) {
                    console.log('\n✅ QR CODE:');
                    console.log('================================');
                    console.log(createResponse.data.qrcode.code);
                    console.log('================================');
                }
            } catch (createErr) {
                console.error('❌ Create failed:', createErr.response?.data || createErr.message);
            }
        }

        // 4. Set webhook
        console.log('\n🔗 Setting up webhook...');
        try {
            const webhookResponse = await axios.post(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
                url: 'https://penny-finance-backend.fly.dev/webhooks/evolution',
                webhook_by_events: false,
                webhook_base64: false,
                events: [
                    'MESSAGES_UPSERT',
                    'MESSAGES_UPDATE',
                    'CONNECTION_UPDATE'
                ]
            }, {
                headers: { 'apikey': EVOLUTION_API_KEY }
            });
            console.log('✅ Webhook configured!');
        } catch (webhookErr) {
            console.log('⚠️ Webhook setup failed:', webhookErr.response?.data || webhookErr.message);
        }

    } catch (error) {
        console.error('❌ Setup error:', error.message);
    }
}

setupEvolution();
