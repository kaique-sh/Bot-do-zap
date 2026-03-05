const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const { validateSignature } = require('../middlewares/signature.middleware');

// Health Check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// WhatsApp Webhook (Meta Verification)
router.get('/webhook', whatsappController.verifyWebhook.bind(whatsappController));

// WhatsApp Webhook (Message Receipt)
router.post('/webhook', whatsappController.handleIncoming.bind(whatsappController));

module.exports = router;
