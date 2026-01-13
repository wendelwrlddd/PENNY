import { sendTextMessage, getRealJid } from './baileys.js';

/**
 * Gerencia o fluxo de verificação de identidade LID <-> Telefone Real
 * @param {object} db - Instância do Firestore
 * @param {string} lid - JID do remetente (LID)
 * @param {string} text - Mensagem recebida
 * @returns {Promise<string|null>} Retorna o telefone real se verificado, ou null se estiver em processo de verificação
 */
export async function handleIdentityVerification(db, lid, text) {
  // 1. Verificar se já existe link verificado
  const linkRef = db.collection('wa_links').doc(lid);
  const linkSnap = await linkRef.get();

  if (linkSnap.exists && linkSnap.data().verified) {
    return linkSnap.data().phone; // ✅ Identidade confirmada
  }

  // Se não verificado, entra na máquina de estados
  const sessionRef = db.collection('wa_sessions').doc(lid);
  const sessionSnap = await sessionRef.get();
  const session = sessionSnap.data() || {};
  const now = Date.now();

  // Helper para responder no chat atual (LID)
  const reply = async (msg) => await sendTextMessage(lid, msg);

  // --- STATE 0: START ---
  if (!session.state) {
    await sessionRef.set({ state: 'awaiting_phone', attempts: 0, createdAt: now });
    await reply(
      "🔒 *Security Verification*\n\n" +
      "To protect your account, we need to confirm your identity.\n" +
      "Please type the *phone number* (with Country Code) linked to your subscription (Stripe/PayPal).\n\n" +
      "Example: 447446196108"
    );
    return null;
  }

  // --- STATE 1: AWAITING PHONE ---
  if (session.state === 'awaiting_phone') {
    // Clean input (digits only)
    const phoneInput = text.replace(/\D/g, '');

    if (phoneInput.length < 10) {
      await reply("❌ Invalid number. Please enter the full number with Country Code (e.g., 447446196108).");
      return null;
    }

    // Verify subscription
    const subQuery = await db.collection('subscriptions').where('phone', '==', phoneInput).limit(1).get();
    
    // Fallback: Check in 'usuarios' (legacy compatibility)
    const userQuery = subQuery.empty ? await db.collection('usuarios').doc(phoneInput).get() : null;
    
    const hasSubscription = !subQuery.empty || (userQuery && userQuery.exists);

    if (!hasSubscription) {
      await reply("❌ We couldn't find an active subscription for this number. Please check if you typed it correctly.");
      return null;
    }

    // Generate Code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 5 * 60000; // 5 minutes

    // Save session
    await sessionRef.update({
      state: 'awaiting_code',
      phone: phoneInput,
      verification_code: code,
      code_expires_at: expiresAt,
      last_updated: now
    });

    // 📤 SEND CODE TO SECURE CHANNEL (@s.whatsapp.net)
    try {
      const secureJid = await getRealJid(phoneInput);
      console.log(`🔐 Sending verification code to ${secureJid}`);
      await sendTextMessage(secureJid, `🔐 Your Penny verification code is: *${code}*\n\nDo not share this code.`);
      
      await reply(
        "✅ Subscription found!\n\n" +
        `We've sent a 6-digit code to the WhatsApp account of this number (${phoneInput}).\n` +
        "Enter the code here to unlock access."
      );
    } catch (err) {
      console.error('Error sending code:', err);
      await reply("❌ Error sending verification code. Please try again later.");
      await sessionRef.delete(); // Reset
    }
    return null;
  }

  // --- STATE 2: AWAITING CODE ---
  if (session.state === 'awaiting_code') {
    if (now > session.code_expires_at) {
      await reply("⏰ Code expired. Please send the phone number again.");
      await sessionRef.update({ state: 'awaiting_phone', verification_code: null });
      return null;
    }

    const inputCode = text.trim().replace(/\D/g, ''); // Clean spaces and non-digits

    if (inputCode === session.verification_code) {
      // ✅ SUCCESS!
      
      // 1. Create Permanent Link
      await linkRef.set({
        lid: lid,
        phone: session.phone,
        verified: true,
        verified_at: new Date().toISOString()
      });

      // 2. Clear Session
      await sessionRef.delete();

      await reply("🎉 *Verification Complete!*\n\nYour identity has been confirmed. You can now use the bot normally.");
      
      // Return null to end current interaction flow
      return null; 
    } else {
      // Increment attempts
      const attempts = (session.attempts || 0) + 1;
      if (attempts >= 3) {
        await reply("🚫 Too many incorrect attempts. Flow restarted.");
        await sessionRef.delete();
      } else {
        await sessionRef.update({ attempts });
        await reply(`❌ Incorrect code. Attempt ${attempts}/3.`);
      }
      return null;
    }
  }

  // Invalid State - Reset
  await sessionRef.delete();
  await reply("An error occurred. Please send 'Hi' again.");
  return null;
}
