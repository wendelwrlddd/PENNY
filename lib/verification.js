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

  // --- ESTADO 0: INÍCIO ---
  if (!session.state) {
    await sessionRef.set({ state: 'awaiting_phone', attempts: 0, createdAt: now });
    await reply(
      "🔒 *Verificação de Segurança*\n\n" +
      "Para proteger sua conta, precisamos confirmar sua identidade.\n" +
      "Por favor, digite o *número de telefone* (com DDD) vinculado à sua assinatura (Stripe/PayPal).\n\n" +
      "Exemplo: 5573991082831"
    );
    return null;
  }

  // --- ESTADO 1: AGUARDANDO TELEFONE ---
  if (session.state === 'awaiting_phone') {
    // Limpar input (apenas números)
    const phoneInput = text.replace(/\D/g, '');

    if (phoneInput.length < 10) {
      await reply("❌ Número inválido. Digite o número completo com DDD (ex: 5573991082831).");
      return null;
    }

    // Verificar assinatura (Simulando busca em subscriptions - user disse que já existe)
    // Buscamos em 'subscriptions' OU 'usuarios' caso subscriptions não esteja populada ainda no ambiente dev
    const subQuery = await db.collection('subscriptions').where('phone', '==', phoneInput).limit(1).get();
    
    // Fallback: Verificar também na coleção usuarios se não achar em subscriptions (para compatibilidade legada)
    const userQuery = subQuery.empty ? await db.collection('usuarios').doc(phoneInput).get() : null;
    
    const hasSubscription = !subQuery.empty || (userQuery && userQuery.exists);

    if (!hasSubscription) {
      await reply("❌ Não encontramos uma assinatura ativa para este número. Verifique se digitou corretamente.");
      return null;
    }

    // Gerar Código
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 5 * 60000; // 5 minutos

    // Salvar sessão
    await sessionRef.update({
      state: 'awaiting_code',
      phone: phoneInput,
      verification_code: code,
      code_expires_at: expiresAt,
      last_updated: now
    });

    // 📤 ENVIAR CÓDIGO PARA O CANAL SEGURO (@s.whatsapp.net)
    try {
      const secureJid = await getRealJid(phoneInput);
      console.log(`🔐 Enviando código de verificação para ${secureJid}`);
      await sendTextMessage(secureJid, `🔐 Seu código de verificação Penny é: *${code}*\n\nNão compartilhe este código.`);
      
      await reply(
        "✅ Assinatura encontrada!\n\n" +
        `Enviamos um código de 6 dígitos para o WhatsApp deste número (${phoneInput}).\n` +
        "Digite o código aqui para liberar seu acesso."
      );
    } catch (err) {
      console.error('Erro ao enviar código:', err);
      await reply("❌ Erro ao enviar o código de verificação. Tente novamente mais tarde.");
      await sessionRef.delete(); // Reset
    }
    return null;
  }

  // --- ESTADO 2: AGUARDANDO CÓDIGO ---
  if (session.state === 'awaiting_code') {
    if (now > session.code_expires_at) {
      await reply("⏰ O código expirou. Por favor, envie o número de telefone novamente.");
      await sessionRef.update({ state: 'awaiting_phone', verification_code: null });
      return null;
    }

    const inputCode = text.trim().replace(/\D/g, ''); // Limpa espaços e não-números

    if (inputCode === session.verification_code) {
      // ✅ SUCESSO!
      
      // 1. Criar Link Permanente
      await linkRef.set({
        lid: lid,
        phone: session.phone,
        verified: true,
        verified_at: new Date().toISOString()
      });

      // 2. Limpar Sessão
      await sessionRef.delete();

      await reply("🎉 *Verificação Concluída!*\n\nSua identidade foi confirmada. Você pode usar o bot normalmente agora.");
      
      // Opcional: Retornar o telefone já para processar a mensagem atual? 
      // Não, melhor fazer o usuário mandar "Oi" de novo ou processar como "Oi" automático.
      // Vamos retornar null aqui para finalizar o fluxo de interação atual.
      return null; 
    } else {
      // Incrementa tentativas
      const attempts = (session.attempts || 0) + 1;
      if (attempts >= 3) {
        await reply("🚫 Muitas tentativas incorretas. Fluxo reiniciado.");
        await sessionRef.delete();
      } else {
        await sessionRef.update({ attempts });
        await reply(`❌ Código incorreto. Tentativa ${attempts}/3.`);
      }
      return null;
    }
  }

  // Estado inválido - Reset
  await sessionRef.delete();
  await reply("Ocorreu um erro no estado. Por favor, mande 'Oi' novamente.");
  return null;
}
