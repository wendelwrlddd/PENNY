import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';

async function startDiagnostic() {
    console.log('🔍 Iniciando Diagnóstico Local do Baileys...');
    const authDir = './auth_diagnostic';
    
    if (!fs.existsSync(authDir)){
        fs.mkdirSync(authDir);
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    console.log('📡 Buscando versão do WhatsApp...');
    let version;
    try {
        const latest = await fetchLatestBaileysVersion();
        version = latest.version;
        console.log(`✅ Versão encontrada: ${version.join('.')}`);
    } catch (e) {
        console.log('❌ Erro ao buscar versão, usando fallback...');
        version = [2, 3000, 1015901307];
    }

    console.log('🚀 Conectando socket (Aguarde o QR Code aparecer)...');
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'error' }),
        printQRInTerminal: true, // Aqui vai aparecer o QR no seu terminal
        auth: state,
        browser: ['Diagnostic Test', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('✨ QR CODE GERADO COM SUCESSO! Veja acima.');
        }

        if (connection === 'open') {
            console.log('🎉 CONECTADO COM SUCESSO!');
            process.exit(0);
        }

        if (connection === 'close') {
            console.log('🔴 Conexão fechada:', lastDisconnect?.error?.message || 'Erro desconhecido');
            // Não vamos dar restart automático no teste
            process.exit(1);
        }
    });
}

startDiagnostic().catch(err => {
    console.error('💥 Erro fatal no diagnóstico:', err);
});
