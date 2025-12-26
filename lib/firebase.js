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
    let serviceAccount = JSON.parse(serviceAccountJson);
    
    // Handle double-serialized JSON (common in secret managers)
    if (typeof serviceAccount === 'string') {
        console.log('⚠️ Service account was double-serialized. Parsing again...');
        serviceAccount = JSON.parse(serviceAccount);
    }
    
    // Nuclear Option: Rebuild key from scratch to ensure perfect formatting
    if (serviceAccount.private_key) {
      console.log('🔧 Private Key Check: Rebuilding PEM...');
      
      // 1. Remove all headers and whitespace
      const cleanBody = serviceAccount.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s/g, ''); // Removes all \n, \r, spaces
      
      // 2. Wrap in proper lines (64 chars) - technically optional for some parsers but good for strict PEM
      // const chunked = cleanBody.match(/.{1,64}/g).join('\n');
      
      // 3. Re-add Headers with single clean newlines
      serviceAccount.private_key = `-----BEGIN PRIVATE KEY-----\n${cleanBody}\n-----END PRIVATE KEY-----\n`;
      
      console.log('   - Rebuilt key matches required format.');
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
