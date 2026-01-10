import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
console.log(`🔍 Checking .env at: ${envPath}`);

if (fs.existsSync(envPath)) {
    console.log(`✅ .env file exists. Size: ${fs.statSync(envPath).size} bytes`);
    const content = fs.readFileSync(envPath, 'utf8');
    console.log(`📄 First 50 chars: ${content.substring(0, 50)}...`);
} else {
    console.error(`❌ .env file NOT FOUND at expected path.`);
}

console.log('--- Environment Variables ---');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
console.log('VITE_FIREBASE_PROJECT_ID:', process.env.VITE_FIREBASE_PROJECT_ID);
console.log('PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID ? 'Loaded' : 'Missing');
console.log('FIREBASE_SERVICE_ACCOUNT (Length):', process.env.FIREBASE_SERVICE_ACCOUNT ? process.env.FIREBASE_SERVICE_ACCOUNT.length : 'Missing');
