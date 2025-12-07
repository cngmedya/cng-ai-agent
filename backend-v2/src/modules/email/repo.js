// backend-v2/src/modules/email/repo.js

// Basit in-memory log (v0.1 – demo amaçlı)
// Uygulama restart olduğunda sıfırlanır.
const emailLogsMemory = [];

/**
 * Genel log fonksiyonu (test + lead mailleri buradan geçiyor)
 */
async function logEmail({
  leadId = null,
  to,
  subject,
  body,
  channel,
  status,
  providerMessageId = null,
}) {
  const now = new Date().toISOString();

  const record = {
    id: `${leadId || 'test'}-${Date.now()}`,
    lead_id: leadId,
    to_email: to,
    subject,
    body,
    channel,
    status,
    provider_message_id: providerMessageId,
    created_at: now,
  };

  // Son eklenen en başta olsun
  emailLogsMemory.unshift(record);

  return record;
}

/**
 * Bir lead’e ait email loglarını getir
 */
async function getEmailLogsForLead(leadId) {
  if (!leadId) return [];
  return emailLogsMemory.filter((log) => log.lead_id === leadId);
}

module.exports = {
  logEmail,
  getEmailLogsForLead,
};