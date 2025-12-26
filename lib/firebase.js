// Firebase Admin SDK Configuration (Backend)
import admin from 'firebase-admin';

console.log('🔥 Firebase module loading...');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    console.log('🔥 Initializing Firebase Admin SDK...');
    
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }

    console.log('🔥 Parsing service account JSON...');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // CORREÇÃO CRÍTICA: Corrigir quebra de linha na chave privada
    if (serviceAccount.private_key) {
      console.log('🔧 Fixing private key formatting...');
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    
    console.log('🔥 Service account parsed successfully');
    console.log('🔥 Project ID:', serviceAccount.project_id);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || 'Penny-Wendell'
    });

    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    throw error;
  }
} else {
  console.log('🔥 Firebase Admin already initialized');
}

// Export Firestore instance
export const db = admin.firestore();
console.log('✅ Firestore instance exported');
