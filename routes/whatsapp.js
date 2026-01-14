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
    // Trigger QR generation
    await connectInstance();

    // Wait for QR to be generated
    await new Promise(r => setTimeout(r, 3000));

    // Fetch QR code
    const qr = await getQrCode();
    res.json(qr);
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
