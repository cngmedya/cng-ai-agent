// backend-v2/src/modules/email/service.js
const repo = require('./repo');
// ileride: shared/mail/mailerClient.js gibi bir katman ekleyebiliriz.

async function sendTestEmail(payload) {
  // TODO: gerçek mail gönderimi için SMTP entegrasyonu eklenecek.
  const log = await repo.logEmail({
    leadId: null,
    to: payload.to || 'test@example.com',
    subject: payload.subject || 'CNG AI Agent Email Test',
    body: payload.body || 'Bu bir test mailidir.',
    channel: 'test',
    status: 'queued',
    providerMessageId: null,
  });

  return {
    ...log,
    note: 'Email module v0.1.0 — SMTP entegrasyonu henüz eklenmedi, sadece log kaydı oluşturuldu.',
  };
}

async function sendEmailForLead({ leadId, payload }) {
  // payload: { subject, message, toOverride? }
  const log = await repo.logEmail({
    leadId,
    to: payload.to || null,
    subject: payload.subject,
    body: payload.message,
    channel: 'lead_email',
    status: 'queued',
    providerMessageId: null,
  });

  return {
    ...log,
    note: 'Şu an sadece DB log kaydı oluşturuluyor. SMTP entegrasyonu eklendiğinde gerçek gönderim yapılacak.',
  };
}

module.exports = {
  sendTestEmail,
  sendEmailForLead,
};