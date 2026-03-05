# WhatsApp Business Bot para Freshservice 🚀

Bot corporativo profissional desenvolvido em Node.js para integração direta entre WhatsApp Business (Cloud API) e Freshservice.

## 📋 Funcionalidades

- ✅ **Conexão via QR Code:** Não depende da Cloud API (Meta). Escaneie o QR no terminal.
- ✅ **Persistência Local:** A sessão é salva localmente, evitando novos scans ao reiniciar.
- ✅ **Fluxo Interativo:** Menu de opções, coleta de descrição e confirmação.
- ✅ **Integração Freshservice:** Criação automática de tickets com todos os campos obrigatórios.
- ✅ **Consulta de Status:** Permite que o usuário verifique o status de um ticket existente.
- ✅ **Resiliência:** Retry automático (3x) em falhas de API do Freshservice.

## 🛠️ Stack Tecnológica

- **Node.js** (LTS)
- **whatsapp-web.js** (Integração com WhatsApp via QR Code)
- **qrcode-terminal** (Exibição do QR Code no terminal)
- **Express.js** (Framework Web para Health Check e monitoramento)
- **Axios** (Requisições HTTP para Freshservice)
- **Winston** (Logging profissional)
- **PM2** (Gerenciador de processos)

## 📁 Estrutura do Projeto

```text
src/
  ├── config/        # Configurações centralizadas
  ├── controllers/   # Lógica do Bot (Listener de mensagens)
  ├── middlewares/   # Middlewares (Erro)
  ├── routes/        # Definição de rotas (Health check)
  ├── services/      # Integrações externas (Freshservice, WhatsApp Web)
  ├── utils/         # Utilitários (Logger, Session Manager)
  └── app.js         # Ponto de entrada da aplicação
```

## 🚀 Instalação e Configuração na VPS Ubuntu

### 1. Pré-requisitos
- Node.js instalado (v16+)
- **Dependências do Chromium** (Necessário para rodar o WhatsApp Web na VPS):

```bash
sudo apt update
sudo apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget libgbm-dev
```

### 2. Instalação
```bash
git clone <seu-repositorio>
cd bot-do-zap
npm install
```

### 3. Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e preencha sua API Key do Freshservice.
```bash
cp .env.example .env
nano .env
```

## 💻 Execução e Conexão

### 1. Iniciar em modo interativo (para o primeiro scan)
```bash
npm start
```
*Aguarde o QR Code aparecer no terminal, abra seu WhatsApp no celular > Dispositivos Conectados > Conectar um dispositivo.*

### 2. Modo Produção (PM2)
Após conectar o dispositivo uma vez, você pode rodar em segundo plano:
```bash
pm2 start ecosystem.config.js
```

## 🔗 Endpoints

- **Health Check:** `http://seu-dominio.com/api/health`

## 🛡️ Segurança

O sistema inclui um middleware de validação de assinatura (`X-Hub-Signature-256`) para garantir que as mensagens recebidas no Webhook realmente venham da Meta.

## 📝 Licença
Este projeto é de uso corporativo interno.
