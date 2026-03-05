const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Validates the X-Hub-Signature-256 header sent by Meta
 */
const validateSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = config.whatsapp.appSecret;

  if (!signature) {
    logger.warn('Webhook received without signature header.');
    return res.sendStatus(401);
  }

  if (!appSecret) {
    logger.warn('WHATSAPP_APP_SECRET is not configured. Skipping signature validation.');
    return next();
  }

  const elements = signature.split('=');
  const signatureHash = elements[1];
  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signatureHash !== expectedHash) {
    logger.warn('Webhook received with invalid signature hash.');
    return res.sendStatus(401);
  }

  next();
};

module.exports = { validateSignature };
