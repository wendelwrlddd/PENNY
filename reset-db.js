import { db } from './lib/firebase.js';

async function reset() {
  console.log('🧹 Clearing data...');

  const collections = ['usuarios', 'wa_sessions', 'wa_links'];
  
  for (const col of collections) {
      const snap = await db.collection(col).get();
      if (snap.empty) continue;
      
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`✅ Cleared ${col}`);
  }

  // 🌱 Reseed Subscription
  console.log('🌱 Seeding subscription...');
  const phone = '5573991082831'; 
  await db.collection('subscriptions').doc(phone).set({
    phone: phone,
    status: 'active',
    plan: 'premium',
    createdAt: new Date().toISOString()
  });
  console.log(`✅ Subscription recreated for ${phone}`);

  process.exit(0);
}

// Wait for init
setTimeout(reset, 2000);
