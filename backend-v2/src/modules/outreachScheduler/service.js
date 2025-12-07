// backend-v2/src/modules/outreachScheduler/service.js
const outreachService = require('../outreach/service');
const schedulerRepo = require('./repo');

/**
 * Belirli bir lead için outreach sequence üretir
 * ve (şimdilik sahte) queue kaydı oluşturur.
 */
async function enqueueSequenceForLead({
  leadId,
  channel,
  tone,
  language,
  objective,
  max_followups,
}) {
  const id = Number(leadId);
  if (!id || Number.isNaN(id)) {
    throw new Error('Geçerli bir leadId zorunlu.');
  }

  const sequencePayload = await outreachService.generateSequenceForLead({
    leadId: id,
    channel,
    tone,
    language,
    objective,
    max_followups,
  });

  const queueRecord = await schedulerRepo.insertSequence({
    leadId: id,
    channel,
    tone,
    language,
    objective,
    max_followups,
    ai_context: sequencePayload.ai_context,
    sequence: sequencePayload.sequence,
  });

  return {
    ...sequencePayload,
    queue_record: queueRecord,
  };
}

module.exports = {
  enqueueSequenceForLead,
};