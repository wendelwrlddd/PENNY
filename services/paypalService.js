import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;
const BASE_URL = 'https://api-m.paypal.com'; // MUDADO PARA LIVE
const PLAN_ID_BR = 'P-45G70889433490700NFNJPVQ'; 

async function getAccessToken() {
    if (!CLIENT_ID || !SECRET) return null;
    const auth = Buffer.from(`${CLIENT_ID.trim()}:${SECRET.trim()}`).toString('base64');
    try {
        const response = await axios.post(`${BASE_URL}/v1/oauth2/token`, 
            'grant_type=client_credentials', 
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error("Erro auth PayPal:", error.response?.data || error.message);
        return null;
    }
}

export async function generateSubscriptionLink(userPhone) {
    const token = await getAccessToken();
    if (!token) return "Erro ao conectar com pagamento.";

    try {
        const response = await axios.post(`${BASE_URL}/v1/billing/subscriptions`, 
            {
                plan_id: PLAN_ID_BR,
                custom_id: userPhone, // IMPORTANTE: Enviamos o telefone aqui
                application_context: {
                    brand_name: "Penny Finance",
                    locale: "pt-BR", 
                    user_action: "SUBSCRIBE_NOW",
                    return_url: "https://penny-finance.vercel.app/payment-success", 
                    cancel_url: "https://penny-finance.vercel.app/payment-cancel"
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const approvalLink = response.data.links.find(link => link.rel === 'approve');
        return approvalLink.href;

    } catch (error) {
        console.error("Erro ao criar link:", error.response?.data || error.message);
        return "Desculpe, erro ao gerar link de pagamento.";
    }
}
