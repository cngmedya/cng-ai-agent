// backend-v2/src/modules/outreachScheduler/repo.js

/**
 * Şimdilik gerçek DB tablosu yok.
 * Bu fonksiyon sadece enqueue edilen sequence'i temsil eden
 * sahte bir kayıt objesi döner. İleride sqlite tablosuna bağlanabilir.
 */
async function insertSequence({
  leadId,
  channel,
  tone,
  language,
  objective,
  max_followups,
  ai_context,
  sequence,
}) {
  const now = new Date().toISOString();

  return {
    id: `${leadId}-${Date.now()}`,
    lead_id: leadId,
    channel,
    tone,
    language,
    objective,
    max_followups,
    ai_context,
    sequence,
    status: 'queued',
    created_at: now,
  };
}

module.exports = {
  insertSequence,
};