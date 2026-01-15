
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeInMemoryStore,
    fetchLatestBaileysVersion,
    delay
} = require('@whiskeysockets/baileys');

import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

// Store
const store = makeInMemoryStore ? makeInMemoryStore({ 
    logger: pino({ level: 'silent' }) 
}) : null;

if (!store) console.warn('⚠️ makeInMemoryStore failed to load.');

// Salvar store periodicamente para não perder dados se reiniciar
setInterval(() => {
    if (store) {
        store.writeToFile('./baileys_store.json');
    }
}, 10_000);

// Carregar store se existir
try {
    if (fs.existsSync('./baileys_store.json')) {
        store.readFromFile('./baileys_store.json'); 
    }
} catch(e) {
    console.log('⚠️ Could not read store.json', e);
}

let sock;

export async function startBaileys(onMessageCallback) {
    // 1. Auth State Persistente (Crucial no Fly.io)
    // O diretório /app/auth_info_baileys DEVE ser um volume montado no Fly.io
    const authPath = process.env.NODE_ENV === 'production' 
        ? '/app/auth_info_baileys' 
        : './auth_info_baileys'; // Local dev

    if (process.env.RESET_SESSION === 'true') {
        console.warn(`⚠️ RESET_SESSION=true detectado! Limpando ${authPath}...`);
        try {
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
                console.log('✅ Credenciais apagadas.');
            }
        } catch(e) { console.error('Falha ao limpar:', e); }
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`🚀 Starting Baileys (v${version.join('.')}) using auth: ${authPath}`);

    // 2. Criar Socket (Singleton-ish logic handled by caller rebooting)
    sock = makeWASocket({
        version,
        logger: pino({ level: 'error' }), // Logs limpos
        printQRInTerminal: true, // Mostra QR no terminal nativamente!
        auth: state,
        generateHighQualityLinkPreview: true,
        // Ignora status (stories) e grupos se quiser focar
        shouldIgnoreJid: jid => jid.includes('broadcast') || jid.includes('@newsletter'),
    });

    // 3. Bind Store (Anti-Zumbi & LID Resolver)
    if (store) {
        store.bind(sock.ev);
    }

    // 4. Lidar com Eventos de Conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('👀 QR CODE RECEBIDO - ESCANEIE ABAIXO');
            // qrcode-terminal pode ser redundante se printQRInTerminal: true, 
            // mas garante compatibilidade em alguns terminais
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`❌ Conexão fechada erro:`, lastDisconnect?.error, `, reconectando: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                setTimeout(() => startBaileys(onMessageCallback), 3000); // Backoff simples
            } else {
                console.log('🔒 Logged out. Delete auth folder to restart.');
            }
        } else if (connection === 'open') {
            console.log('✅ CONEXÃO ESTABELECIDA COM SUCESSO! 🟢');
        }
    });

    // 5. Salvar credenciais quando atualizarem
    sock.ev.on('creds.update', saveCreds);

    // 6. Processar Mensagens (Upsert)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                // A. Filtros Básicos
                if (!msg.message) continue;
                if (msg.key.fromMe) continue; // Ignora msg própria
                if (msg.key.remoteJid === 'status@broadcast') continue;

                // B. Resolve JID Real (Anti-LID) -> IMPORTANTE
                // Baileys as vezes manda LID no msg.key.remoteJid, mas a gente quer o NUMBER@s.whatsapp.net
                // O store ajuda a mapear, mas a melhor fonte é o msg.key.participant em grupos ou usar o proprio remoteJid se for privado.
                // Mas, vamos confiar no Baileys basic handling primeiro.
                
                const remoteJid = msg.key.remoteJid;
                
                // Extrair texto
                const text = msg.message.conversation || 
                           msg.message.extendedTextMessage?.text || 
                           msg.message.imageMessage?.caption || "";

                if (!text) continue;

                console.log(`💬 [Baileys] Recebido de ${remoteJid}: ${text}`);

                // C. Callback para o cérebro (server.js)
                // Passamos o socket junto para o callback poder responder
                await onMessageCallback(text, remoteJid, sock, msg);

            } catch (err) {
                console.error('❌ Erro processing message:', err);
            }
        }
    });
}

// Helper para enviar (chamado pelo server.js)
export async function sendBaileysMessage(socket, jid, text) {
    const s = socket || sock; // Fallback to global socket
    
    if (!s) {
        console.warn('⚠️ Socket não iniciado (global or param), abortando envio.');
        throw new Error('Baileys socket not initialized');
    }
    
    try {
        // Human Delay (Anti-Ban Soft)
        const delayMs = Math.random() * 500 + 200; 
        await delay(delayMs);

        // Send Presence (Composing aka "Digitando...")
        // Suprimir erro de presença para não travar o envio principal
        await s.sendPresenceUpdate('composing', jid).catch(() => {});
        await delay(1500); 

        await s.sendMessage(jid, { text });
        console.log(`✅ [Baileys] Mensagem enviada para ${jid}`);
    } catch (e) {
        console.error(`❌ [Baileys] Erro no sendMessage para ${jid}:`, e.message);
        throw e;
    } finally {
        // Garantir que pare de digitar
        try {
            await s.sendPresenceUpdate('paused', jid).catch(() => {});
        } catch (e) {}
    }
}
