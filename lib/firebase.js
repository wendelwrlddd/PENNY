import 'dotenv/config';
// Firebase Admin SDK Configuration (Backend)
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

console.log('🔥 Firebase module loading...');

let db = null;

const initializeFirebase = () => {
  if (admin.apps.length) {
    db = admin.firestore();
    return;
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJson) {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not set. Firestore features will be disabled. Env keys present:', Object.keys(process.env).filter(k => k.startsWith('FIREBASE')));
      return;
    }
    console.log(`🔑 Service Account JSON found. Length: ${serviceAccountJson.length}`);

    console.log('🔥 Initializing Firebase Admin SDK...');
    let serviceAccount;
    
    // Try to parse ENV var as JSON, if fails check if it's a file path
    try {
        if (serviceAccountJson && serviceAccountJson.trim().startsWith('{')) {
             serviceAccount = JSON.parse(serviceAccountJson);
        } else {
             // Assume it's a file path or not set
             throw new Error('Not a JSON string');
        }
    } catch (e) {
        // Fallback: Check if file exists
        const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
        
        if (fs.existsSync(keyPath)) {
            console.log(`🔑 Loading Service Account from file: ${keyPath}`);
            const fileContent = fs.readFileSync(keyPath, 'utf8');
            serviceAccount = JSON.parse(fileContent);
        } else {
             console.error('❌ Service Account JSON invalid and file not found.');
             return;
        }
    }

    if (typeof serviceAccount === 'string') {
        serviceAccount = JSON.parse(serviceAccount);
    }
    
    if (serviceAccount.private_key) {
      const cleanBody = serviceAccount.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s/g, '');
      
      serviceAccount.private_key = `-----BEGIN PRIVATE KEY-----\n${cleanBody}\n-----END PRIVATE KEY-----\n`;
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'penny-wendell'
    });

    db = admin.firestore();
    console.log('✅ Firebase Admin and Firestore initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
  }
};

initializeFirebase();

export { db };
console.log('✅ Firestore instance exported');
