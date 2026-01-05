// Firebase Admin SDK Configuration (Backend)
import admin from 'firebase-admin';

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
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not set. Firestore features will be disabled.');
      return;
    }

    console.log('🔥 Initializing Firebase Admin SDK...');
    let serviceAccount = JSON.parse(serviceAccountJson);
    
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
      projectId: process.env.FIREBASE_PROJECT_ID || 'Penny-Wendell'
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
