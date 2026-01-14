import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode-terminal'; // Import qrcode-terminal

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sock = null;
let qrCode = null;
let isConnected = false;

/**
 * Resolve o JID real para um número de telefone
 */
export async function getRealJid(phone) {
  if (!sock) return null;
  const potentialJid = `${phone}@s.whatsapp.net`;
  try {
    const [result] = await sock.onWhatsApp(potentialJid);
    if (result?.exists) return result.jid;
  } catch (e) {
    console.error('Erro ao verificar onWhatsApp:', e);
  }
  return potentialJid;
}

/**
 * Conecta ao WhatsApp usando Baileys
 */
export async function connectWhatsApp(onMessage, authFolder = './auth_info_baileys') {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    // printQRInTerminal: true, // DEPRECATED - Removed
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    msgRetryCounterCache: {},
    generateHighQualityLinkPreview: true,
    shouldIgnoreJid: jid => jid.endsWith('@broadcast'),
  });

  // Eventos de conexão
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = qr;
      console.log('📱 QR Code recebido! Gerando no terminal...');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const { error } = lastDisconnect || {};
      const statusCode = (error instanceof Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`❌ Conexão fechada. Código: ${statusCode} | Reconectando: ${shouldReconnect}`);
      
      // Stop the "Online" status loop (if it exists)
      if (global.onlineInterval) {
          clearInterval(global.onlineInterval);
          global.onlineInterval = null;
      }

      if (shouldReconnect) {
        setTimeout(() => connectWhatsApp(onMessage, authFolder), 3000);
      } else {
          console.log('🚫 Desconectado permanentemente (Logout ou erro fatal).');
      }
      isConnected = false;
    } else if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp!');
      isConnected = true;
      qrCode = null;
      
      // Clear interval if exists
      if (global.onlineInterval) {
          clearInterval(global.onlineInterval);
          global.onlineInterval = null;
      }
    }
  });

  // Salvar credenciais
  sock.ev.on('creds.update', saveCreds);

  // Receber mensagens
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key.fromMe) continue; // Ignora mensagens enviadas por nós

      const from = msg.key.remoteJid;
      const text = msg.message.conversation || 
                   msg.message.extendedTextMessage?.text || 
                   msg.message.imageMessage?.caption || '';

      if (text && onMessage) {
        // console.log(`📩 Mensagem de ${from}: ${text}`);
        await onMessage(from, text, msg);
      }
    }
  });

  return sock;
}

/**
 * Envia mensagem de texto
 */
export async function sendTextMessage(jid, text) {
  if (!sock || !isConnected) {
    throw new Error('WhatsApp não está conectado');
  }

  console.log(`📤 [Baileys] Enviando para: ${jid}`);

  try {
      await sock.sendMessage(jid, { text });
      console.log(`✅ Mensagem enviada para ${jid}`);
  } catch (err) {
      console.error(`❌ Erro ao enviar mensagem para ${jid}:`, err);
  }
}

/**
 * Define presença (digitando, gravando, etc)
 */
export async function sendPresence(jid, presence = 'composing') {
  if (!sock || !isConnected) return;

  const normalizedJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
  await sock.sendPresenceUpdate(presence, normalizedJid);
}

/**
 * Retorna o QR Code atual
 */
export function getQRCode() {
  return qrCode;
}

/**
 * Verifica se está conectado
 */
export function getConnectionStatus() {
  return isConnected;
}

/**
 * Desconecta do WhatsApp
 */
export async function disconnectWhatsApp() {
  if (sock) {
    await sock.logout();
    sock = null;
    isConnected = false;
    console.log('🔌 Desconectado do WhatsApp');
  }
}
