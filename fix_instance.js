import axios from 'axios';

const API_URL = 'https://penny-evolution-api.fly.dev';
const API_KEY = 'PENNY_SECURE_KEY_2024';
const INSTANCE = 'wendel';

async function fix() {
  console.log(`🔧 Fixing instance: ${INSTANCE}...`);

  try {
    console.log('1. Trying LOGOUT...');
    await axios.delete(`${API_URL}/instance/logout/${INSTANCE}`, {
      headers: { 'apikey': API_KEY }
    });
    console.log('✅ Logout OK');
  } catch (e) {
    console.log('⚠️ Logout failed (maybe already logged out?):', e.response?.data || e.message);
  }

  try {
    console.log('2. Trying DELETE...');
    const res = await axios.delete(`${API_URL}/instance/delete/${INSTANCE}`, {
      headers: { 'apikey': API_KEY }
    });
    console.log('✅ Delete OK:', res.data);
  } catch (e) {
    console.log('❌ Delete failed:', e.response?.data || e.message);
  }
}

fix();
