const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');

class WhatsappService {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    this.initialize();
  }

  initialize() {
    // Generate QR Code in terminal
    this.client.on('qr', (qr) => {
      logger.info('QR RECEIVED. Please scan with WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      logger.info('WhatsApp Client is ready!');
      console.log('✅ Bot conectado com sucesso via QR Code!');
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp Client AUTHENTICATED');
    });

    this.client.on('auth_failure', (msg) => {
      logger.error('WhatsApp AUTHENTICATION FAILURE:', msg);
    });

    this.client.on('disconnected', (reason) => {
      logger.warn('WhatsApp Client was DISCONNECTED:', reason);
    });

    this.client.initialize().catch(err => {
      logger.error('FALHA AO INICIALIZAR WHATSAPP CLIENT:', err);
      console.error('❌ Erro crítico: Não foi possível iniciar o WhatsApp. Verifique se as dependências do Chromium estão instaladas.');
    });
  }

  /**
   * Sends a text message to a WhatsApp user
   * @param {string} to - Number in format 5511999999999
   * @param {string} text 
   * @returns {Promise<Object>}
   */
  async sendTextMessage(to, text) {
    try {
      // Use o ID (to) diretamente, sem concatenar @c.us
      logger.info(`Sending message to ${to}...`);
      const response = await this.client.sendMessage(to, text);
      logger.info(`Message sent successfully. ID: ${response.id.id}`);
      return response;
    } catch (error) {
      logger.error('Error sending WhatsApp message:', error);
      throw new Error(`Failed to send WhatsApp message: ${error.message}`);
    }
  }

  /**
   * For QR Code method, we use plain text menus because interactive buttons 
   * are only available for Official Cloud API.
   * @param {string} to 
   * @param {string} bodyText 
   * @param {Array} buttons 
   */
  async sendInteractiveButtons(to, bodyText, buttons) {
    try {
      let menuText = bodyText + '\n\n';
      
      buttons.forEach((btn, index) => {
        // Since we can't use real buttons, we use text triggers
        menuText += `👉 Digite *${btn.id === 'CONFIRM_YES' ? 'SIM' : 'CANCELAR'}* para ${btn.title.toLowerCase()}\n`;
      });

      return await this.sendTextMessage(to, menuText);
    } catch (error) {
      logger.error('Error sending "buttons" (text menu):', error);
      throw error;
    }
  }

  /**
   * Listen to messages from outside (for controller)
   */
  onMessage(callback) {
    this.client.on('message', async (msg) => {
      // Process only private chats (exclude groups)
      const chat = await msg.getChat();
      if (!chat.isGroup) {
        callback(msg);
      }
    });
  }
}

module.exports = new WhatsappService();
