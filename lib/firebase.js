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
    
    // CORREÇÃO CRÍTICA: Corrigir formato da chave privada
    if (serviceAccount.private_key) {
      console.log('🔧 Private Key Check (Before Normalization):');
      console.log('   - Length:', serviceAccount.private_key.length);
      console.log('   - Has newline bytes:', serviceAccount.private_key.includes('\n'));
      
      const rawKey = serviceAccount.private_key;
      
      // 1. Se tiver \n literais (dupla barra), substituir por quebra de linha real
      // 2. Se tiver aspas no começo/fim (erro comum de copy/paste), remover
      let validKey = rawKey
        .replace(/\\n/g, '\n')
        .replace(/^"|"$/g, '');

      // 3. Garantir que tem cabeçalho e rodapé corretos se estiverem faltando/estranhos
      if (!validKey.includes('-----BEGIN PRIVATE KEY-----')) {
        // Se vier pura sem headers (raro, mas possível de erro de copy paste)
        const cleanContent = validKey.replace(/\s/g, '');
        validKey = `-----BEGIN PRIVATE KEY-----\n${cleanContent}\n-----END PRIVATE KEY-----\n`;
      }
      
      serviceAccount.private_key = validKey;

      console.log('🔧 Private Key Check (After Normalization):');
      console.log('   - Has newline bytes:', serviceAccount.private_key.includes('\n'));
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
