const config = require('../config/config');
const whatsappService = require('../services/whatsapp.service');
const freshserviceService = require('../services/freshservice.service');
const sessionManager = require('../utils/session.manager');
const logger = require('../utils/logger');

class WhatsappController {
  constructor() {
    // Initialize listener for QR Code bot messages
    this._initListener();
  }

  _initListener() {
    whatsappService.onMessage(async (msg) => {
      const from = msg.from; // Usar o ID completo (ex: 5511... @c.us ou LID)
      const contact = await msg.getContact();
      const userName = contact.pushname || 'Usuário';
      
      await this._processMessage(from, userName, msg);
    });
  }

  /**
   * Logic for bot flow (adapted for QR Code bot)
   */
  async _processMessage(from, userName, message) {
    const session = sessionManager.get(from);
    const text = message.body ? message.body.trim() : '';

    logger.info(`Processing QR message from ${from} [Step: ${session.step}]`);

    switch (session.step) {
      case 'START':
        await this._sendMainMenu(from, userName);
        sessionManager.set(from, { step: 'CHOOSING_CATEGORY', data: { userName } });
        break;

      case 'CHOOSING_CATEGORY':
        if (text === '5') {
          await whatsappService.sendTextMessage(from, 'Por favor, digite o número do ticket que você deseja consultar (apenas números).');
          sessionManager.set(from, { step: 'AWAITING_TICKET_NUMBER', data: session.data });
          return;
        }

        const choices = { '1': 'Problema com computador', '2': 'Problema com sistema', '3': 'Problema com acesso', '4': 'Outros' };
        const category = choices[text];

        if (category) {
          session.data.category = category;
          await whatsappService.sendTextMessage(from, `Certo, você selecionou: *${category}*.\n\nPor favor, descreva detalhadamente o seu problema:`);
          sessionManager.set(from, { step: 'AWAITING_DESCRIPTION', data: session.data });
        } else {
          await whatsappService.sendTextMessage(from, 'Desculpe, não entendi. Escolha uma das opções de 1 a 5.');
        }
        break;

      case 'AWAITING_TICKET_NUMBER':
        const ticketId = text.replace(/#/, '');
        if (!/^[0-9]+$/.test(ticketId)) {
          await whatsappService.sendTextMessage(from, 'Número de ticket inválido. Por favor, digite apenas os números do seu ticket.');
          return;
        }

        try {
          await whatsappService.sendTextMessage(from, `Buscando informações do ticket #${ticketId}...`);
          const ticket = await freshserviceService.getTicket(ticketId);

          const statusMap = { 2: 'Aberto', 3: 'Em Andamento', 4: 'Resolvido', 5: 'Fechado' };
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
        if (text.length > 5) {
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
        const normalizedText = text.toUpperCase();
        if (normalizedText === 'SIM') {
          await whatsappService.sendTextMessage(from, '⏳ Criando seu ticket no Freshservice...');
          
          try {
            const cleanPhone = from.split('@')[0];
            const ticketData = {
              subject: `[WhatsApp] Atendimento - ${session.data.userName}`,
              description: `Solicitação de atendimento via WhatsApp\n\nContato: ${session.data.userName}\nTelefone: ${cleanPhone}\n\nCategoria Escolhida: ${session.data.category}\nMensagem:\n${session.data.description}\n\n---\nOrigem: WhatsApp Bot\nData: ${new Date().toLocaleString('pt-BR')}\nTicket criado automaticamente pelo bot WhatsApp`,
              email: `whatsapp+${cleanPhone}@nextbot.com`,
              phone: cleanPhone
              // Removi o sub_category dinâmico para usar o padrão fixo e evitar erro 400
            };

            const ticket = await freshserviceService.createTicket(ticketData);
            
            await whatsappService.sendTextMessage(from, `✅ Chamado criado com sucesso!\n\nNúmero do ticket: *#${ticket.id}*\n\nNossa equipe entrará em contato em breve.`);
            sessionManager.delete(from);
          } catch (error) {
            logger.error('Failed to create ticket:', error);
            await whatsappService.sendTextMessage(from, '❌ Ocorreu um erro ao criar o chamado no Freshservice. Por favor, tente novamente mais tarde.');
            sessionManager.delete(from);
          }
        } else if (normalizedText === 'CANCELAR') {
          await whatsappService.sendTextMessage(from, 'Atendimento cancelado. Se precisar de algo, é só enviar um "Olá" novamente! 👋');
          sessionManager.delete(from);
        } else {
          await whatsappService.sendTextMessage(from, 'Por favor, digite *SIM* para confirmar ou *CANCELAR* para desistir.');
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

  // Webhook methods kept for backward compatibility or verification, but not used for QR flow
  async verifyWebhook(req, res) { return res.sendStatus(200); }
  async handleIncoming(req, res) { return res.sendStatus(200); }
}

module.exports = new WhatsappController();
