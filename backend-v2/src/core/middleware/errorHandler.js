// backend-v2/src/core/middleware/errorHandler.js
const logger = require('../logger');

function errorHandler(err, _req, res, _next) {
  logger.error('Unhandled error:', err);

  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: err.message || 'Internal server error'
  });
}

module.exports = { errorHandler };