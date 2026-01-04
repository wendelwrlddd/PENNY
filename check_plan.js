import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;
const BASE_URL = 'https://api-m.sandbox.paypal.com';
const PLAN_ID = 'P-85E26688D1302003ENFNHMYQ';

async function checkPlan() {
    const auth = Buffer.from(`${CLIENT_ID.trim()}:${SECRET.trim()}`).toString('base64');
    const tokenRes = await axios.post(`${BASE_URL}/v1/oauth2/token`, 'grant_type=client_credentials', {
        headers: { 'Authorization': `Basic ${auth}` }
    });
    const token = tokenRes.data.access_token;

    try {
        const planRes = await axios.get(`${BASE_URL}/v1/billing/plans/${PLAN_ID}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("PLAN STATUS:", planRes.data.status);
        console.log("PLAN DETAILS:", JSON.stringify(planRes.data, null, 2));
    } catch (e) {
        console.error("ERRO AO BUSCAR PLANO:", e.response?.data || e.message);
    }
}

checkPlan();
