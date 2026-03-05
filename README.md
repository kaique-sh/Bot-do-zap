# WhatsApp Business Bot para Freshservice 🚀

Bot corporativo profissional desenvolvido em Node.js para integração direta entre WhatsApp Business (Cloud API) e Freshservice.

## 📋 Funcionalidades

- ✅ **Webhook de Verificação:** Pronto para validar com a Meta Cloud API.
- ✅ **Fluxo Interativo:** Menu de opções, coleta de descrição e confirmação.
- ✅ **Integração Freshservice:** Criação automática de tickets com todos os campos obrigatórios.
- ✅ **Resiliência:** Retry automático (3x) em falhas de API e tratamento de erros global.
- ✅ **Logs Estruturados:** Utiliza Winston para logs em arquivos e console.
- ✅ **Consulta de Status:** Permite que o usuário verifique o status de um ticket existente.

## 🛠️ Stack Tecnológica

- **Node.js** (LTS)
- **Express.js** (Framework Web)
- **Axios** (Requisições HTTP com suporte a retry)
- **Winston** (Logging profissional)
- **Dotenv** (Gerenciamento de variáveis de ambiente)
- **PM2** (Gerenciador de processos)

## 📁 Estrutura do Projeto

```text
src/
  ├── config/        # Configurações centralizadas
  ├── controllers/   # Lógica de controle (WhatsApp Webhook)
  ├── middlewares/   # Middlewares (Erro, Assinatura)
  ├── routes/        # Definição de rotas
  ├── services/      # Integrações externas (Freshservice, WhatsApp)
  ├── utils/         # Utilitários (Logger, Session Manager)
  └── app.js         # Ponto de entrada da aplicação
```

## 🚀 Instalação e Configuração

### 1. Pré-requisitos
- Node.js instalado (v16+)
- Conta no Meta Developers (WhatsApp Cloud API)
- Conta no Freshservice com API Key disponível

### 2. Instalação
```bash
git clone <seu-repositorio>
cd bot-do-zap
npm install
```

### 3. Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e preencha as informações:
```bash
cp .env.example .env
```

| Variável | Descrição |
|----------|-----------|
| `FRESHSERVICE_API_KEY` | Sua chave de API do Freshservice |
| `WHATSAPP_ACCESS_TOKEN` | Token de acesso temporário ou permanente da Meta |
| `WHATSAPP_VERIFY_TOKEN` | Token definido por você na configuração do Webhook |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número de telefone na Meta Cloud API |
| `WHATSAPP_APP_SECRET` | Segredo do aplicativo Meta (opcional para validação de assinatura) |

## 💻 Execução

### Modo Desenvolvimento
```bash
npm run dev
```

### Modo Produção (PM2)
```bash
# Instalar PM2 globalmente se não tiver
npm install pm2 -g

# Iniciar aplicação
pm2 start ecosystem.config.js

# Ver logs
pm2 logs whatsapp-bot-freshservice
```

## 🔗 Endpoints do Webhook

- **Verificação (GET):** `http://seu-dominio.com/api/webhook`
- **Recebimento (POST):** `http://seu-dominio.com/api/webhook`
- **Health Check:** `http://seu-dominio.com/api/health`

## 🛡️ Segurança

O sistema inclui um middleware de validação de assinatura (`X-Hub-Signature-256`) para garantir que as mensagens recebidas no Webhook realmente venham da Meta.

## 📝 Licença
Este projeto é de uso corporativo interno.
