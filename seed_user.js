import 'dotenv/config';
import { db } from './lib/firebase.js';

async function seedUser() {
    console.log('🌱 Seeding user 5573991082831...');
    
    const phone = '5573991082831@s.whatsapp.net';
    const userRef = db.collection('usuarios').doc(phone);
    
    const userData = {
        phone: phone,
        status: 'active',
        plan: 'premium',
        subscriptionStatus: 'active',
        onboarding_complete: false,
        features: { ukMode: false },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await userRef.set(userData);
        console.log('✅ User seeded successfully!');
        
        // Cleanup any existing verification links for this user to ensure fresh start
        const linksSnap = await db.collection('wa_links').where('targetPhone', '==', phone).get();
        const batch = db.batch();
        linksSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log('🧹 Cleanup of old verification links done.');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding user:', error);
        process.exit(1);
    }
}

seedUser();
