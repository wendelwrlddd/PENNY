import { db } from './lib/firebase.js';

async function seed() {
  console.log('🌱 Seeding subscription...');
  
  // Garantir formato E.164 (55 + DDD + Numero)
  const phone = '5573991082831'; 
  
  await db.collection('subscriptions').doc(phone).set({
    phone: phone,
    status: 'active',
    plan: 'premium',
    provider: 'manual_seed',
    createdAt: new Date().toISOString()
  });
  
  console.log(`✅ Subscription added for ${phone}`);
  
  // Também garantir que o usuário existe na coleção usuarios para evitar erros legados se houver checks
  // (Opcional, mas bom para garantir)
  await db.collection('usuarios').doc(phone).set({
      onboarding_step: 'INCOME_TYPE', // Resetar estado para testar onboarding
      features: { ukMode: false }
  }, { merge: true });
  
  console.log('✅ User document ensured.');
  process.exit(0);
}

// Aguardar inicialização do Firebase (assíncrona no lib/firebase.js agora com fallback)
setTimeout(seed, 2000);
