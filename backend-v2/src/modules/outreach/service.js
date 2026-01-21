// backend-v2/src/modules/outreach/service.js
const { getLeadById, enqueueOutreach } = require('./repo');
const { chatJson } = require('../../shared/ai/llmClient');
const { loadPrompt } = require('../../shared/ai/promptLoader');
const { analyzeLead } = require('../intel/service');

// v1 prompt
const firstContactPrompt = loadPrompt('outreach/first_contact_message.md');

// v2 prompt
const outreachSequencePrompt = loadPrompt('outreach/outreach_sequence_v2.md');

/**
 * v1 - Tek seferlik ilk temas mesajı
 */
async function generateFirstContact({ leadId, channel, tone, language }) {
  const id = Number(leadId);
  if (!id || Number.isNaN(id)) {
    throw new Error('Geçerli bir leadId zorunlu.');
  }

  const lead = getLeadById(id);
  if (!lead) {
    throw new Error(`Lead bulunamadı: id=${id}`);
  }

  const system = firstContactPrompt;
  const user = JSON.stringify({
    name: lead.name,
    address: lead.address,
    ai_category: lead.ai_category,
    ai_score: lead.ai_score,
    ai_notes: lead.ai_notes,
    channel: channel || 'whatsapp',
    tone: tone || 'premium',
    language: language || 'tr'
  });

  const result = await chatJson({ system, user });

  // chatJson -> { ok, json, raw } yapısında dönüyor
  const payload = result && result.json ? result.json : result || {};

  return {
    leadId: lead.id,
    leadName: lead.name,
    channel: channel || 'whatsapp',
    tone: tone || 'premium',
    language: language || 'tr',
    subject: payload.subject || null,
    message: payload.message
  };
}

/**
 * v2 - Lead bazlı, çok adımlı outreach sequence
 */
async function generateSequenceForLead({
  leadId,
  channel,
  tone,
  language,
  objective,
  max_followups
}) {
  const id = Number(leadId);
  if (!id || Number.isNaN(id)) {
    throw new Error('Geçerli bir leadId zorunlu.');
  }

  const lead = getLeadById(id);
  if (!lead) {
    throw new Error(`Lead bulunamadı: id=${id}`);
  }

  // Intel basic
  const intelResult = await analyzeLead({ leadId: id });
  const intel = intelResult.intel || intelResult;

  const safeChannel = channel || 'whatsapp';
  const safeTone = tone || 'kurumsal';
  const safeLanguage = language || 'tr';
  const safeObjective = objective || 'ilk_temas';
  const safeMaxFollowups =
    typeof max_followups === 'number' && max_followups >= 0 && max_followups <= 3
      ? max_followups
      : 2;

  const system = outreachSequencePrompt;

  const userPayload = {
    lead: {
      id: lead.id,
      name: lead.name,
      address: lead.address,
      city: lead.city,
      country: lead.country,
      category: lead.category,
      website: lead.website,
      phone: lead.phone,
      ai_score: lead.ai_score,
      ai_category: lead.ai_category,
      ai_notes: lead.ai_notes
    },
    intel,
    channel: safeChannel,
    tone: safeTone,
    language: safeLanguage,
    objective: safeObjective,
    max_followups: safeMaxFollowups
  };

  const user = JSON.stringify(userPayload);

  const result = await chatJson({ system, user });

  // chatJson -> { ok, json, raw }
  const payload = result && result.json ? result.json : result || {};

  const ai_context = payload.ai_context || null;
  const sequence = payload.sequence || [];

  // enqueue outreach execution intents (queue-only at this layer)
  for (const step of sequence) {
    if (!step || !step.message) continue;

    enqueueOutreach({
      jobId: intelResult.job_id || null,
      leadId: lead.id,
      provider: lead.provider || null,
      providerId: String(lead.provider_id || ''),
      channel: safeChannel,
      priority: step.priority || 0,
      payload: {
        to: lead.email || null,
        subject: step.subject || null,
        message: step.message,
        step_type: step.type || 'initial',
      },
    });
  }

  return {
    lead_id: lead.id,
    channel: safeChannel,
    tone: safeTone,
    language: safeLanguage,
    objective: safeObjective,
    ai_context,
    sequence
  };
}

module.exports = {
  generateFirstContact,
  generateSequenceForLead,
  enqueueOutreach
};