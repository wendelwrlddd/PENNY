import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';

let sock;
let qrCode = null;
let status = 'disconnected';

export async function startBaileys(handleMessage) {
  const authDir = process.env.BAILEYS_AUTH_DIR || './auth_info_baileys';
  
  if (!fs.existsSync(authDir)){
      fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`Starting Baileys v${version.join('.')}...`);

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }), 
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    printQRInTerminal: true,
    browser: ['Penny Finance', 'Chrome', '10.0.0'],
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      qrCode = qr;
      status = 'scancode';
      console.log('QRCode generated');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', shouldReconnect, lastDisconnect?.error);
      status = 'disconnected';
      
      if (shouldReconnect) {
        setTimeout(() => startBaileys(handleMessage), 2000);
      } else {
        console.log('Logged out. Please re-scan.');
        fs.rmSync(authDir, { recursive: true, force: true });
        startBaileys(handleMessage);
      }
    } else if (connection === 'open') {
      console.log('Opened connection');
      status = 'connected';
      qrCode = null;
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async m => {
    try {
      if (m.type !== 'notify') return;
      
      for (const msg of m.messages) {
        if (!msg.message) continue;
        if (msg.key.fromMe) continue; // Ignore self
        
        // Pass to handler
        await handleMessage(msg, sock); 
      }
    } catch (err) {
      console.error('Error handling messages.upsert', err);
    }
  });
}

export const getSessionStatus = () => ({ status, qrCode });

export async function sendMessage(jid, text, options = {}) {
    if (!sock) throw new Error('Socket not initialized');
    await sock.readMessages([jid]); // Optional: mark read
    return sock.sendMessage(jid, { text }, options);
}

export async function sendPresence(jid, type) {
    if (!sock) return;
    return sock.sendPresenceUpdate(type, jid);
}
