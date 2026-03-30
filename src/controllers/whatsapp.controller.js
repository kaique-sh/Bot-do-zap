const config = require('../config/config');
const whatsappService = require('../services/whatsapp.service');
const freshserviceService = require('../services/freshservice.service');
const sessionManager = require('../utils/session.manager');
const logger = require('../utils/logger');

class WhatsappController {
  constructor() {
    this.isInitialized = false;
    this.processedMessages = new Set();
    // Initialize listener for QR Code bot messages
    this._initListener();
  }

  _initListener() {
    if (this.isInitialized) return;
    
    whatsappService.onMessage(async (msg) => {
      const msgId = msg.id.id;
      
      // Evitar processamento duplicado da mesma mensagem
      if (this.processedMessages.has(msgId)) {
        logger.info(`Message ${msgId} already processed, skipping.`);
        return;
      }
      
      this.processedMessages.add(msgId);
      
      // Limpar cache de mensagens antigas a cada 100 mensagens para não vazar memória
      if (this.processedMessages.size > 100) {
        const firstValue = this.processedMessages.values().next().value;
        this.processedMessages.delete(firstValue);
      }

      const from = msg.from; // Usar o ID completo (ex: 5511... @c.us ou LID)
      const contact = await msg.getContact();
      const userName = contact.pushname || 'Usuário';
      const realNumber = contact.number; // Este é o número de telefone real (MSISDN)
      
      await this._processMessage(from, userName, msg, realNumber);
    });

    this.isInitialized = true;
  }

  /**
   * Logic for bot flow (adapted for QR Code bot)
   */
  async _processMessage(from, userName, message, realNumber) {
    const session = sessionManager.get(from);
    const text = message.body ? message.body.trim() : '';

    // Garantir que o realNumber e o nome estejam sempre atualizados na sessão
    session.data.userName = userName;
    if (realNumber) {
      session.data.realNumber = realNumber;
    }

    logger.info(`Processing QR message from ${from} (Real Number: ${session.data.realNumber}) [Step: ${session.step}]`);

    switch (session.step) {
      case 'START':
        await this._sendMainMenu(from, userName);
        sessionManager.set(from, { step: 'CHOOSING_CATEGORY', data: session.data });
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
          const conversations = await freshserviceService.getTicketConversations(ticketId);

          // Encontrar a última resposta pública de um analista
          const lastAgentReply = conversations
            .filter(c => c.private === false && c.user_id !== ticket.requester_id)
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];

          const statusMap = {
            2: 'Aberto',
            3: 'Em Andamento',
            4: 'Resolvido',
            5: 'Fechado'
          };

          const statusText = statusMap[ticket.status] || 'Desconhecido';

          let response = `*Status do Ticket #${ticket.id}*\n\n*Assunto:* ${ticket.subject}\n*Status:* ${statusText}`;

          if (lastAgentReply) {
            // Limpa o HTML da resposta para enviar texto puro
            const cleanBody = lastAgentReply.body_text.replace(/<[^>]*>/g, '\n').trim();
            response += `\n\n*Última atualização do analista:*\n${cleanBody}`;
          } else {
            response += `\n\nNenhuma atualização de um analista encontrada ainda.`;
          }

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
        // Aceitar tanto "SIM" quanto o texto do botão "Sim, criar"
        if (normalizedText === 'SIM' || normalizedText.includes('SIM')) {
          await whatsappService.sendTextMessage(from, '⏳ Criando seu ticket no Freshservice...');
          
          try {
            const cleanPhone = from.split('@')[0];
            const realPhone = session.data.realNumber || cleanPhone;
            // Limpar o número para o e-mail (remover +, espaços, hífens) conforme n8n
            const emailPhone = realPhone.replace(/[+\s-]/g, '');
            
            const ticketData = {
              subject: `[WhatsApp] Atendimento - ${session.data.userName}`,
              description: `Solicitação de atendimento via WhatsApp\n\nContato: ${session.data.userName}\nTelefone: ${realPhone}\n\nCategoria Escolhida: ${session.data.category}\nMensagem:\n${session.data.description}\n\n---\nOrigem: WhatsApp Bot\nData: ${new Date().toLocaleString('pt-BR')}\nTicket criado automaticamente pelo bot WhatsApp`,
              email: `whatsapp+${emailPhone}@nextbot.com`,
              phone: emailPhone
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
