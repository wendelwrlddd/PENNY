import express from 'express';
import QRCode from 'qrcode';
import { getSessionStatus } from '../lib/baileys.js';

const router = express.Router();

router.get('/qr', async (req, res) => {
  const { status, qrCode } = getSessionStatus();
  
  if (status === 'connected') {
     return res.send(`
        <html>
           <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#dcfce7;font-family:sans-serif;">
             <div style="text-align:center">
                <h1 style="color:#166534">✅ Connected!</h1>
                <p>Penny is online.</p>
             </div>
           </body>
         </html>
     `);
  }
  
  if (qrCode) {
    try {
        const url = await QRCode.toDataURL(qrCode);
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
            <title>Penny WhatsApp Linking</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: -apple-system, system-ui, sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 90%; }
                img { max-width: 100%; border-radius: 8px; margin: 1rem 0; }
                h2 { color: #1f2937; margin-bottom: 0.5rem; }
                p { color: #6b7280; margin-bottom: 1rem; }
                .refresh { padding: 0.75rem 1.5rem; background: #25D366; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; text-decoration: none; display: inline-block; }
            </style>
            </head>
            <body>
            <div class="card">
                <h2>📱 Link Penny (Baileys)</h2>
                <p>Open WhatsApp > Linked Devices > Link a Device</p>
                <img src="${url}" alt="QR Code" />
                <br/>
                <a href="javascript:location.reload()" class="refresh">Refresh</a>
            </div>
            </body>
            </html>
        `);
    } catch (e) {
        res.status(500).send('Error generating QR');
    }
  } else {
    res.send(`
        <html>
           <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f0f2f5;font-family:sans-serif;">
             <h2>⏳ Starting WhatsApp... Refresh in 5s</h2>
             <script>setTimeout(() => location.reload(), 5000);</script>
           </body>
         </html>
     `);
  }
});

router.get('/status', (req, res) => res.json(getSessionStatus()));

export default router;
