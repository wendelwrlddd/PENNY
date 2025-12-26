
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Read credentials directly
const serviceAccount = JSON.parse(readFileSync('c:\\Users\\monte\\Downloads\\penny-wendell-firebase-adminsdk-fbsvc-36573af991.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'penny-wendell'
  });
}

const db = admin.firestore();

async function addTestTransaction() {
  console.log('🔥 Writing test transaction to Firestore...');
  try {
    const docRef = await db.collection('transactions').add({
      amount: 999,
      currency: '£',
      category: 'TEST',
      description: '✅ TESTE DE CONFIANÇA - SISTEMA OK',
      date: new Date().toISOString(),
      type: 'income',
      createdAt: new Date().toISOString(),
      originalMessage: 'Manual Test'
    });
    console.log('✅ Document written with ID: ', docRef.id);
  } catch (e) {
    console.error('Error adding document: ', e);
  }
}

addTestTransaction();
