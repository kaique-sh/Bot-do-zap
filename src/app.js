const express = require('express');
const config = require('./config/config');
const routes = require('./routes');
const errorHandler = require('./middlewares/error.middleware');
const logger = require('./utils/logger');

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Logger for all requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, { body: req.body });
  next();
});

// Routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
});

// Global Error Handler
app.use(errorHandler);

// Process event handlers for resilience
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Give time for logs to be written
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  console.log(`✅ Servidor ativo na porta ${PORT}`);
  console.log(`🚀 Inicializando WhatsApp Bot via QR Code...`);
});

module.exports = app;
