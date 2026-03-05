const axios = require('axios');
const axiosRetry = require('axios-retry');
const config = require('../config/config');
const logger = require('../utils/logger');

class FreshserviceService {
  constructor() {
    this.client = axios.create({
      baseURL: `https://${config.freshservice.domain}/api/v2`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': config.freshservice.workspaceId
      },
      auth: {
        username: config.freshservice.apiKey,
        password: 'X'
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
        logger.warn(`Retrying Freshservice API request. Attempt ${retryCount}. Error: ${error.message}`);
      }
    });
  }

  /**
   * Creates a new ticket in Freshservice
   * @param {Object} ticketData 
   * @returns {Promise<Object>}
   */
  async createTicket(ticketData) {
    try {
      const payload = {
        subject: ticketData.subject,
        description: ticketData.description,
        email: ticketData.email,
        phone: ticketData.phone,
        status: 2, // Open
        priority: config.freshservice.defaultPriority,
        source: config.freshservice.defaultSource,
        group_id: config.freshservice.defaultGroupId,
        department_id: config.freshservice.defaultDepartmentId,
        workspace_id: config.freshservice.workspaceId,
        category: config.freshservice.defaultCategory,
        sub_category: ticketData.sub_category || config.freshservice.defaultSubcategory
      };

      logger.info('Creating Freshservice ticket...', { payload });

      const response = await this.client.post('/tickets', payload);
      
      logger.info(`Ticket created successfully: #${response.data.ticket.id}`);
      
      return response.data.ticket;
    } catch (error) {
      this._handleError(error, 'createTicket');
    }
  }

  /**
   * Retrieves a ticket by its ID
   * @param {string} ticketId 
   * @returns {Promise<Object>}
   */
  async getTicket(ticketId) {
    try {
      logger.info(`Fetching ticket #${ticketId} from Freshservice...`);
      const response = await this.client.get(`/tickets/${ticketId}`);
      logger.info(`Ticket #${ticketId} fetched successfully.`);
      return response.data.ticket;
    } catch (error) {
      this._handleError(error, 'getTicket');
    }
  }

  _handleError(error, context) {
    const status = error.response ? error.response.status : 'No Response';
    const data = error.response ? JSON.stringify(error.response.data) : error.message;
    
    logger.error(`Freshservice API Error [${context}]: Status ${status}`, {
      error: data,
      config: error.config ? { url: error.config.url, method: error.config.method } : {}
    });

    if (error.response) {
      if (status === 401 || status === 403) {
        throw new Error('Authentication failure with Freshservice API');
      }
      if (status === 429) {
        throw new Error('Rate limit exceeded on Freshservice API');
      }
    }
    
    throw new Error(`Failed to interact with Freshservice: ${error.message}`);
  }
}

module.exports = new FreshserviceService();
