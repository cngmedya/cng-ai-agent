// backend-v2/src/modules/whatsapp/service.js
const { logWhatsapp, listWhatsappLogs } = require('./repo');
const logger = require('../../core/logger');

async function sendTestMessage() {
  const entry = logWhatsapp({
    leadId: null,
    phone: null,
    message:
      '[TEST] WhatsApp module v0.1.0 — gerçek WhatsApp API çağrısı yok, sadece in-memory log.',
    meta: { kind: 'test', version: 'v0.1.0' },
  });

  return {
    ok: true,
    id: entry.id,
    note:
      'WhatsApp module v0.1.0 — Cloud API entegrasyonu henüz yok, sadece in-memory log.',
  };
}

async function sendMessageForLead({ leadId, phone, message }) {
  if (!leadId) throw new Error('leadId zorunlu');
  if (!message) throw new Error('message zorunlu');

  const entry = logWhatsapp({
    leadId,
    phone: phone || null,
    message,
    meta: {
      kind: 'lead_send',
      version: 'v0.1.0',
    },
  });

  if (logger && typeof logger.info === 'function') {
    logger.info('[WHATSAPP][SEND_FOR_LEAD]', {
      leadId,
      phone: phone || null,
      entryId: entry.id,
    });
  } else {
    console.log('[WHATSAPP][SEND_FOR_LEAD]', {
      leadId,
      phone: phone || null,
      entryId: entry.id,
    });
  }

  return {
    ok: true,
    id: entry.id,
    lead_id: leadId,
    phone: phone || null,
    note:
      'Mesaj sadece in-memory loglandı. Gerçek WhatsApp gönderimi v0.2’de eski WhatsApp Engine ile bağlanacak.',
  };
}

function getLastLogs(limit = 50) {
  return listWhatsappLogs(limit);
}

module.exports = {
  sendTestMessage,
  sendMessageForLead,
  getLastLogs,
};