import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';

let sock;
let qrCode = null;
let status = 'disconnected';

export async function startBaileys(handleMessage) {
  console.log('DEBUG: startBaileys called');
  const authDir = process.env.BAILEYS_AUTH_DIR || './auth_info_baileys';
  
  if (!fs.existsSync(authDir)){
      console.log('DEBUG: creating authDir', authDir);
      fs.mkdirSync(authDir, { recursive: true });
  }

  console.log('DEBUG: initializing useMultiFileAuthState');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  console.log('DEBUG: auth state loaded');

  let version = [2, 3000, 1015901307]; // Hardcoded fallback
  try {
    console.log('DEBUG: fetching latest baileys version');
    const { version: latestVersion } = await fetchLatestBaileysVersion();
    version = latestVersion;
    console.log('DEBUG: version fetched:', version.join('.'));
  } catch (e) {
    console.log('DEBUG: failed to fetch version, using fallback');
  }

  console.log(`Starting Baileys v${version.join('.')}...`);

  sock = makeWASocket({
    version,
    logger: pino({ level: 'info' }), 
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "info" })),
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
