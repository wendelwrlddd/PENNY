
// --- SMART SEND MESSAGE (Baileys First) ---
async function smartSendMessage(instance, phone, text, socket = null) {
    // console.log(`[SmartSend] Sending to ${phone}...`);
    
    // 1. Baileys (Socket Passado ou Global se tivéssemos)
    // Se o socket veio, usa ele
    if (socket) {
        try {
            await sendBaileysMessage(socket, phone, text);
            return;
        } catch (e) {
            console.error('❌ [SmartSend] Baileys Socket Error:', e.message);
        }
    }

    // 2. Evolution (Fallback - mas sabemos que está down)
    // Mantemos apenas para não quebrar lógica antiga se algo escapar
    try {
       // console.warn('⚠️ [SmartSend] Usando fallback Evolution (pode falhar)...');
       await evoSendText(phone, text);
    } catch (e) {
       console.error('❌ [SmartSend] Evolution Error:', e.message);
    }
}
