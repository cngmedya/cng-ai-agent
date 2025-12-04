// backend-v2/src/core/middleware/requestLogger.js
const logger = require('../logger');

function requestLogger(req, _res, next) {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
}

module.exports = { requestLogger };