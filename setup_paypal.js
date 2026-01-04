import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// COLOQUE SUAS CHAVES NO .ENV
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;
const BASE_URL = 'https://api-m.paypal.com'; // LIVE

async function createPlan() {
    if (!CLIENT_ID || !SECRET) {
        console.error("❌ ERRO: PAYPAL_CLIENT_ID ou PAYPAL_SECRET não encontrados no .env");
        return;
    }

    console.log("1. Autenticando...");
    
    // 1. Autenticar
    const auth = Buffer.from(`${CLIENT_ID.trim()}:${SECRET.trim()}`).toString('base64');
    const tokenParams = new URLSearchParams();
    tokenParams.append('grant_type', 'client_credentials');

    try {
        const authRes = await axios.post(`${BASE_URL}/v1/oauth2/token`, tokenParams, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const token = authRes.data.access_token;

        console.log("✅ Autenticado! Criando produto...");

        // 2. Criar o Produto (O "Serviço Penny")
        const productRes = await axios.post(`${BASE_URL}/v1/catalogs/products`, {
            name: "Penny Finance Premium",
            description: "Assinatura do Assistente Financeiro Penny",
            type: "SERVICE",
            category: "SOFTWARE",
        }, { headers: { 'Authorization': `Bearer ${token}` } });
        
        const productId = productRes.data.id;
        console.log(`2. Produto criado! ID: ${productId}`);

        // 3. Criar o Plano de Cobrança (R$ 59,90 por mês)
        const planRes = await axios.post(`${BASE_URL}/v1/billing/plans`, {
            product_id: productId,
            name: "Plano Mensal (Brasil) - R$ 59,90",
            description: "Cobrança mensal de R$ 59,90",
            billing_cycles: [
                {
                    frequency: { interval_unit: "MONTH", interval_count: 1 }, // Todo mês
                    tenure_type: "REGULAR",
                    sequence: 1,
                    total_cycles: 0, // 0 = Infinito (até cancelar)
                    pricing_scheme: {
                        fixed_price: { value: "59.90", currency_code: "BRL" } // VALOR E MOEDA EM REAIS
                    }
                }
            ],
            payment_preferences: {
                auto_bill_outstanding: true,
                setup_fee: { value: "0", currency_code: "BRL" },
                setup_fee_failure_action: "CONTINUE",
                payment_failure_threshold: 3
            }
        }, { headers: { 'Authorization': `Bearer ${token}` } });

        console.log("\n============================================");
        console.log("✅ SUCESSO! GUARDE ESTE ID DO PLANO:");
        console.log(planRes.data.id);
        console.log("============================================");
    } catch (error) {
        if (error.response) {
            console.error("❌ Erro na API do PayPal:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("❌ Erro:", error.message);
        }
    }
}

createPlan();
