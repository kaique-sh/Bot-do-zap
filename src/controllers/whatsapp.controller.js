const config = require('../config/config');
const whatsappService = require('../services/whatsapp.service');
const freshserviceService = require('../services/freshservice.service');
const sessionManager = require('../utils/session.manager');
const logger = require('../utils/logger');

class WhatsappController {
  /**
   * GET /webhook
   * Verification for Meta Cloud API Webhook
   */
  async verifyWebhook(req, res) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode && token) {
        if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
          logger.info('Webhook verified successfully.');
          return res.status(200).send(challenge);
        } else {
          logger.warn('Webhook verification failed: invalid token.');
          return res.sendStatus(403);
        }
      }
    } catch (error) {
      logger.error('Error verifying webhook:', error);
      return res.sendStatus(500);
    }
  }

  /**
   * POST /webhook
   * Handle incoming messages
   */
  async handleIncoming(req, res) {
    try {
      const { body } = req;

      // Ensure it's a message from WhatsApp
      if (!body.object || body.object !== 'whatsapp_business_account') {
        return res.sendStatus(404);
      }

      // Check for entries
      if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
        const messageData = body.entry[0].changes[0].value.messages[0];
        const contact = body.entry[0].changes[0].value.contacts[0];
        const from = messageData.from; // Phone number
        const userName = contact.profile.name;
        
        // Asynchronous processing to respond quickly (under 2s as required)
        this._processMessage(from, userName, messageData).catch(err => {
          logger.error(`Error processing message from ${from}:`, err);
        });
      }

      // Always return 200 immediately to WhatsApp
      return res.sendStatus(200);
    } catch (error) {
      logger.error('Error in handleIncoming:', error);
      // Return 200 anyway to prevent retries from Meta, but log error
      return res.sendStatus(200);
    }
  }

  /**
   * Logic for bot flow
   */
  async _processMessage(from, userName, message) {
    const session = sessionManager.get(from);
    const messageType = message.type;
    const text = messageType === 'text' ? message.text.body : '';
    const buttonId = messageType === 'interactive' ? message.interactive.button_reply.id : '';

    logger.info(`Processing message from ${from} [Step: ${session.step}]`);

    switch (session.step) {
      case 'START':
        await this._sendMainMenu(from, userName);
        sessionManager.set(from, { step: 'CHOOSING_CATEGORY', data: { userName } });
        break;

      case 'CHOOSING_CATEGORY':
        let choice = text.trim();
        if (choice === '5') {
          await whatsappService.sendTextMessage(from, 'Por favor, digite o número do ticket que você deseja consultar (apenas números).');
          sessionManager.set(from, { step: 'AWAITING_TICKET_NUMBER', data: session.data });
          return;
        }

        let category = '';
        if (messageType === 'text') {
          const choices = { '1': 'Problema com computador', '2': 'Problema com sistema', '3': 'Problema com acesso', '4': 'Outros' };
          category = choices[choice];
        } else if (messageType === 'interactive') {
          category = buttonId;
        }

        if (category) {
          session.data.category = category;
          await whatsappService.sendTextMessage(from, `Certo, você selecionou: *${category}*.\n\nPor favor, descreva detalhadamente o seu problema:`);
          sessionManager.set(from, { step: 'AWAITING_DESCRIPTION', data: session.data });
        } else {
          await whatsappService.sendTextMessage(from, 'Desculpe, não entendi. Escolha uma das opções de 1 a 5.');
        }
        break;

      case 'AWAITING_TICKET_NUMBER':
        const ticketId = text.trim().replace(/#/, '');
        if (!/^[0-9]+$/.test(ticketId)) {
          await whatsappService.sendTextMessage(from, 'Número de ticket inválido. Por favor, digite apenas os números do seu ticket.');
          return;
        }

        try {
          await whatsappService.sendTextMessage(from, `Buscando informações do ticket #${ticketId}...`);
          const ticket = await freshserviceService.getTicket(ticketId);

          const statusMap = {
            2: 'Aberto',
            3: 'Em Andamento',
            4: 'Resolvido',
            5: 'Fechado'
          };

          const statusText = statusMap[ticket.status] || 'Desconhecido';

          const response = `*Status do Ticket #${ticket.id}*\n\n*Assunto:* ${ticket.subject}\n*Status:* ${statusText}`;
          await whatsappService.sendTextMessage(from, response);
        } catch (error) {
          logger.error(`Error fetching ticket ${ticketId}:`, error);
          await whatsappService.sendTextMessage(from, `Não foi possível encontrar o ticket #${ticketId}. Verifique o número e tente novamente.`);
        }
        sessionManager.delete(from);
        break;


      case 'AWAITING_DESCRIPTION':
        if (messageType === 'text' && text.length > 5) {
          session.data.description = text;
          
          const confirmationText = `Confirma a abertura do chamado?\n\n*Nome:* ${session.data.userName}\n*Problema:* ${session.data.category}\n*Descrição:* ${session.data.description}`;
          
          await whatsappService.sendInteractiveButtons(from, confirmationText, [
            { id: 'CONFIRM_YES', title: 'Sim, criar' },
            { id: 'CONFIRM_NO', title: 'Cancelar' }
          ]);
          
          sessionManager.set(from, { step: 'CONFIRMATION', data: session.data });
        } else {
          await whatsappService.sendTextMessage(from, 'Por favor, forneça uma descrição um pouco mais detalhada (mínimo 5 caracteres).');
        }
        break;

      case 'CONFIRMATION':
        if (buttonId === 'CONFIRM_YES') {
          await whatsappService.sendTextMessage(from, '⏳ Criando seu ticket no Freshservice...');
          
          try {
            const ticketData = {
              subject: `[WhatsApp] Atendimento - ${session.data.userName}`,
              description: `Solicitação de atendimento via WhatsApp\n\nContato: ${session.data.userName}\nTelefone: ${from}\n\nCategoria: ${session.data.category}\nMensagem:\n${session.data.description}\n\n---\nTicket criado automaticamente pelo bot WhatsApp`,
              email: `whatsapp+${from}@nextbot.com`,
              phone: from
            };

            const ticket = await freshserviceService.createTicket(ticketData);
            
            await whatsappService.sendTextMessage(from, `✅ Chamado criado com sucesso!\n\nNúmero do ticket: *#${ticket.id}*\n\nNossa equipe entrará em contato em breve.`);
            sessionManager.delete(from);
          } catch (error) {
            logger.error('Failed to create ticket:', error);
            await whatsappService.sendTextMessage(from, '❌ Ocorreu um erro ao criar o chamado no Freshservice. Por favor, tente novamente mais tarde ou entre em contato via telefone.');
            sessionManager.delete(from);
          }
        } else {
          await whatsappService.sendTextMessage(from, 'Atendimento cancelado. Se precisar de algo, é só enviar um "Olá" novamente! 👋');
          sessionManager.delete(from);
        }
        break;

      default:
        await this._sendMainMenu(from, userName);
        sessionManager.set(from, { step: 'CHOOSING_CATEGORY', data: { userName } });
        break;
    }
  }

  async _sendMainMenu(from, userName) {
    const welcomeText = `Olá ${userName} 👋 Bem-vindo ao Suporte de TI.\n\nComo podemos ajudar hoje?`;
    
    const menu = `${welcomeText}\n\n*Para abrir um novo chamado, digite o número da opção:*\n1 - Problema com computador\n2 - Problema com sistema\n3 - Problema com acesso\n4 - Outros\n\n*Para consultar um chamado existente, digite:*\n5 - Status de um ticket`;
    
    await whatsappService.sendTextMessage(from, menu);
  }
}

module.exports = new WhatsappController();
