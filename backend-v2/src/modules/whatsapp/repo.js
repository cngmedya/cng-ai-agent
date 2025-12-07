// backend-v2/src/modules/whatsapp/repo.js
const logger = require('../../core/logger');

const whatsappLogs = [];

function logWhatsapp({ leadId = null, phone = null, message, meta = {} }) {
  const entry = {
    id: whatsappLogs.length + 1,
    ts: new Date().toISOString(),
    lead_id: leadId,
    phone,
    message,
    meta,
  };

  whatsappLogs.push(entry);

  if (logger && typeof logger.info === 'function') {
    logger.info('[WHATSAPP][LOG]', entry);
  } else {
    console.log('[WHATSAPP][LOG]', entry);
  }

  return entry;
}

function listWhatsappLogs(limit = 50) {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  return whatsappLogs.slice(-limit);
}

module.exports = {
  logWhatsapp,
  listWhatsappLogs,
};