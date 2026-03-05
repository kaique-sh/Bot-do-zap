const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`[Global Error Handler] Status: ${status} - Error: ${message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  res.status(status).json({
    error: {
      message: status === 500 ? 'Ocorreu um erro interno no servidor.' : message,
      status
    }
  });
};

module.exports = errorHandler;
