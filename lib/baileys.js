import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';

let sock;
let qrCode = null;
let status = 'disconnected';

export async function startBaileys(handleMessage) {
  const authDir = '/app/auth_info_baileys';
  
  // 1. Garantir que o diretório existe
  if (!fs.existsSync(authDir)){
      fs.mkdirSync(authDir, { recursive: true });
  }

  // 2. Fechar socket anterior se existir para evitar vazamento de memória e múltiplos processos
  if (sock) {
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ev.removeAllListeners('messages.upsert');
      sock.end(new Error('Starting new session'));
    } catch (e) {
      console.error('[Baileys] Erro ao fechar socket anterior:', e.message);
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  
  // 3. Buscar versão mais recente (vital para evitar 401/405)
  let version;
  try {
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
  } catch (e) {
    console.error('[Baileys] Erro ao buscar versão, usando fallback estável');
    version = [2, 3000, 1015901307]; 
  }

  console.log(`[Baileys] Iniciando v${version.join('.')}...`);

  sock = makeWASocket({
    version,
    logger: pino({ level: 'error' }),
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "error" })),
    },
    printQRInTerminal: false,
    browser: ['Penny Finance', 'Chrome', '10.0.0'],
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      qrCode = qr;
      status = 'qr';
      console.log('[Baileys] Novo QR Code gerado');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`[Baileys] Conexão fechada. Reason: ${statusCode}. Reconnecting: ${shouldReconnect}`);
      status = 'disconnected';
      
      if (shouldReconnect) {
        // Delay para evitar loop frenético
        setTimeout(() => startBaileys(handleMessage), 5000);
      } else {
        console.log('[Baileys] Desconectado permanentemente (Logout). Limpando sessão...');
        qrCode = null;
        // Não apagamos o diretório automaticamente para evitar EBUSY
        // Reiniciamos limpo no próximo ciclo se o usuário quiser
      }
    } else if (connection === 'open') {
      console.log('[Baileys] Conexão estabelecida com sucesso!');
      status = 'connected';
      qrCode = null;
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async m => {
    try {
      if (m.type !== 'notify') return;
      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue;
        await handleMessage(msg, sock); 
      }
    } catch (err) {
      console.error('[Baileys] Erro no processamento de mensagem:', err);
    }
  });
}

export const getSessionStatus = () => ({ status, qrCode });

export async function sendMessage(jid, text, options = {}) {
    if (!sock) throw new Error('Socket não inicializado');
    // Removido o readMessages incorreto que causava erro
    return sock.sendMessage(jid, { text }, options);
}

export async function sendPresence(jid, type) {
    if (!sock) return;
    try {
        await sock.sendPresenceUpdate(type, jid);
    } catch (e) {}
}
