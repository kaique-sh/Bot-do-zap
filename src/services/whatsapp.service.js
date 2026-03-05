const axios = require('axios');
const axiosRetry = require('axios-retry');
const config = require('../config/config');
const logger = require('../utils/logger');

class WhatsappService {
  constructor() {
    this.client = axios.create({
      baseURL: `${config.whatsapp.apiUrl}/${config.whatsapp.version}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.whatsapp.accessToken}`
      }
    });

    // Configure automatic retries
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               (error.response && error.response.status === 429);
      },
      onRetry: (retryCount, error, requestConfig) => {
        logger.warn(`Retrying WhatsApp API request. Attempt ${retryCount}. Error: ${error.message}`);
      }
    });
  }

  /**
   * Sends a text message to a WhatsApp user
   * @param {string} to 
   * @param {string} text 
   * @returns {Promise<Object>}
   */
  async sendTextMessage(to, text) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text }
      };

      logger.info(`Sending message to ${to}...`, { payload });

      const response = await this.client.post(`/${config.whatsapp.phoneNumberId}/messages`, payload);
      
      logger.info(`Message sent successfully to ${to}. Message ID: ${response.data.messages[0].id}`);
      
      return response.data;
    } catch (error) {
      this._handleError(error, 'sendTextMessage');
    }
  }

  /**
   * Sends an interactive button menu
   * @param {string} to 
   * @param {string} bodyText 
   * @param {Array} buttons 
   * @returns {Promise<Object>}
   */
  async sendInteractiveButtons(to, bodyText, buttons) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title
              }
            }))
          }
        }
      };

      logger.info(`Sending interactive buttons to ${to}...`, { payload });

      const response = await this.client.post(`/${config.whatsapp.phoneNumberId}/messages`, payload);
      
      logger.info(`Interactive buttons sent successfully to ${to}. Message ID: ${response.data.messages[0].id}`);
      
      return response.data;
    } catch (error) {
      this._handleError(error, 'sendInteractiveButtons');
    }
  }

  _handleError(error, context) {
    const status = error.response ? error.response.status : 'No Response';
    const data = error.response ? JSON.stringify(error.response.data) : error.message;
    
    logger.error(`WhatsApp API Error [${context}]: Status ${status}`, {
      error: data,
      config: error.config ? { url: error.config.url, method: error.config.method } : {}
    });

    if (error.response) {
      if (status === 401 || status === 403) {
        throw new Error('Authentication failure with WhatsApp API');
      }
    }
    
    throw new Error(`Failed to interact with WhatsApp: ${error.message}`);
  }
}

module.exports = new WhatsappService();
