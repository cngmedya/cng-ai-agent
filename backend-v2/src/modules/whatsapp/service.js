// backend-v2/src/modules/whatsapp/service.js
const repo = require('./repo');

/**
 * NOT:
 * Şu an gerçek WhatsApp Cloud API entegrasyonu yok.
 * Sadece log kaydı atıyoruz. v1.0.0'da Cloud API bağlanacak.
 */

async function sendTestMessage(payload) {
  const log = await repo.logWhatsapp({
    leadId: null,
    phone: payload.phone || '+900000000000',
    message: payload.message || 'CNG AI Agent WhatsApp test mesajı',
    channel: 'test',
    status: 'queued',
    providerMessageId: null,
  });

  return {
    ...log,
    note: 'WhatsApp module v0.1.0 — Cloud API entegrasyonu henüz yok, sadece log kaydı.',
  };
}

async function sendMessageForLead({ leadId, payload }) {
  const log = await repo.logWhatsapp({
    leadId,
    phone: payload.phone || null,
    message: payload.message,
    channel: 'lead_whatsapp',
    status: 'queued',
    providerMessageId: null,
  });

  return {
    ...log,
    note: 'Şu an sadece DB log kaydı oluşturuluyor. Cloud API eklendiğinde gerçek gönderim yapılacak.',
  };
}

module.exports = {
  sendTestMessage,
  sendMessageForLead,
};