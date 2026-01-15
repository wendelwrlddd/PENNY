import express from 'express';
import {
  connectInstance,
  getQrCode,
  getStatus
} from '../lib/evolutionClient.js';

const router = express.Router();

/**
 * GET /api/whatsapp/qr
 * Generate and return QR code for WhatsApp connection
 */
router.get('/qr', async (req, res) => {
  try {
    // Trigger QR generation and get data
    const data = await connectInstance();
    
    // v1.8 returns base64 directly
    if (data?.base64) {
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
            <h2>📱 Link Penny to WhatsApp</h2>
            <p>Open WhatsApp > Linked Devices > Link a Device</p>
            <img src="${data.base64}" alt="QR Code" />
            <br/>
            <a href="javascript:location.reload()" class="refresh">Refresh QR Code</a>
          </div>
        </body>
        </html>
      `);
    } else {
      res.json(data);
    }
  } catch (error) {


    console.error('Error generating QR:', error.message);
    res.status(500).json({ 
      error: 'Failed to generate QR code',
      message: error.response?.data || error.message 
    });
  }
});

/**
 * GET /api/whatsapp/status
 * Get current WhatsApp connection status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting status:', error.message);
    res.status(500).json({ 
      error: 'Failed to get status',
      message: error.response?.data || error.message 
    });
  }
});

export default router;
