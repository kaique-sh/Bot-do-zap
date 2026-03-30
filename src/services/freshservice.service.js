const axios = require('axios');
const axiosRetry = require('axios-retry');
const config = require('../config/config');
const logger = require('../utils/logger');

class FreshserviceService {
  constructor() {
    const apiKey = config.freshservice.apiKey;
    const authHeader = 'Basic ' + Buffer.from(apiKey + ':X').toString('base64');
    
    // Log de segurança para conferência (mostra apenas as pontas da chave)
    if (apiKey) {
      const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
      logger.info(`Freshservice Service inicializado com a chave: ${maskedKey}`);
    } else {
      logger.error('ERRO: FRESHSERVICE_API_KEY não encontrada nas variáveis de ambiente!');
    }

    this.client = axios.create({
      baseURL: `https://${config.freshservice.domain}/api/v2`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'X-Workspace-Id': String(config.freshservice.workspaceId)
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
        sub_category: config.freshservice.defaultSubcategory,
        custom_fields: {
          origem: "WhatsApp Bot",
          numero_whatsapp: ticketData.phone,
          data_solicitacao: new Date().toISOString().split('.')[0] + 'Z'
        }
      };

      logger.info('Creating Freshservice ticket with custom payload...', { payload });

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

  /**
   * Retrieves all conversations for a ticket
   * @param {string} ticketId 
   * @returns {Promise<Array>}
   */
  async getTicketConversations(ticketId) {
    try {
      logger.info(`Fetching conversations for ticket #${ticketId}...`);
      const response = await this.client.get(`/tickets/${ticketId}/conversations`);
      logger.info(`Found ${response.data.conversations.length} conversations for ticket #${ticketId}.`);
      return response.data.conversations;
    } catch (error) {
      this._handleError(error, 'getTicketConversations');
    }
  }

  _handleError(error, context) {
    const status = error.response ? error.response.status : 'No Response';
    const data = error.response ? error.response.data : error.message;
    const responseData = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    
    // Log detalhado para depuração
    const requestHeaders = error.config ? error.config.headers : {};
    const authHeader = requestHeaders.Authorization || requestHeaders.authorization;
    
    logger.error(`🚨 ERRO CRÍTICO NA API FRESHSERVICE [${context}]`, {
      status: status,
      url: error.config ? error.config.url : 'N/A',
      method: error.config ? error.config.method : 'N/A',
      payload_enviado: error.config && error.config.data ? JSON.parse(error.config.data) : 'N/A',
      resposta_api: responseData,
      headers_request: {
        ...requestHeaders,
        Authorization: authHeader ? 'OCULTADO (Contém API Key)' : 'NÃO ENCONTRADO'
      }
    });

    if (error.response) {
      if (status === 401) {
        throw new Error('Falha de Autenticação: A API Key do Freshservice parece inválida ou expirada.');
      }
      if (status === 403) {
        throw new Error('Acesso Negado: O usuário da API Key não tem permissão para criar tickets ou o Workspace ID está incorreto.');
      }
      if (status === 400) {
        throw new Error(`Erro de Validação: A API do Freshservice rejeitou os dados. Resposta: ${responseData}`);
      }
      if (status === 429) {
        throw new Error('Limite de requisições excedido na API do Freshservice.');
      }
    }
    
    throw new Error(`Erro ao interagir com Freshservice: ${error.message}`);
  }
}

module.exports = new FreshserviceService();
