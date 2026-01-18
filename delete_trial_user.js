
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Configuração do Service Account (Usando o que já existe no projeto)
const serviceAccountPath = './serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found!');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
// O usuário pediu especificamente este número
const TARGET_PHONE = '5573991082831'; 

async function resetUser() {
    console.log(`🗑️ Resetting user: ${TARGET_PHONE}...`);

    const userRef = db.collection('usuarios').doc(TARGET_PHONE);
    
    // Deixar limpo ou apenas apagar? O user disse "apague tudo".
    // Melhor apagar o documento inteiro para garantir Reset total.
    
    // 1. Apagar transações (subcoleção)
    const txSnapshot = await userRef.collection('transactions').get();
    const batch = db.batch();
    
    if (!txSnapshot.empty) {
        console.log(`Found ${txSnapshot.size} transactions to delete.`);
        txSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }

    // 2. Apagar documento do usuário
    batch.delete(userRef);

    // 3. Commit
    await batch.commit();
    console.log('✅ User data DELETED successfully.');
    process.exit(0);
}

resetUser().catch(e => {
    console.error(e);
    process.exit(1);
});
