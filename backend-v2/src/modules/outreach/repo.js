// backend-v2/src/modules/outreach/repo.js
const { getDb } = require('../../core/db');

function getLeadById(id) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT *
    FROM potential_leads
    WHERE id = ?
  `);
  return stmt.get(id);
}

function getLeadByProviderId({ provider, providerId }) {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT id, raw_payload_json
      FROM potential_leads
      WHERE provider = ?
        AND provider_id = ?
        AND raw_payload_json IS NOT NULL
        AND length(raw_payload_json) > 0
      ORDER BY length(raw_payload_json) DESC
      LIMIT 1
    `,
    )
    .get(provider, String(providerId));

  if (!row) return null;

  let raw = null;
  try {
    raw = row.raw_payload_json ? JSON.parse(row.raw_payload_json) : null;
  } catch (_) {
    raw = null;
  }

  const email =
    raw && typeof raw === 'object'
      ? raw.email ||
        (Array.isArray(raw.emails) && raw.emails[0] ? raw.emails[0] : null) ||
        (raw.contact && raw.contact.email ? raw.contact.email : null) ||
        null
      : null;

  const website =
    raw && typeof raw === 'object'
      ? raw.website || raw.site || (raw.contact && raw.contact.website ? raw.contact.website : null) || null
      : null;

  return { id: row.id, email: email || null, website: website || null };
}

function getLatestOutreachDraftByJobProviderId({ jobId, provider, providerId }) {
  const db = getDb();

  const row = db
    .prepare(
      `
      SELECT artifact_json
      FROM ai_artifacts
      WHERE job_id = ?
        AND provider = ?
        AND provider_id = ?
        AND artifact_type = 'outreach_draft_v1'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    )
    .get(jobId, provider, String(providerId));

  if (!row || !row.artifact_json) return null;

  try {
    return JSON.parse(row.artifact_json);
  } catch (_) {
    return null;
  }
}

function enqueueOutreach({ jobId, leadId, provider, providerId, channel, priority, payload }) {
  const db = getDb();

  const inferredLead =
    (!leadId && provider && providerId) ? getLeadByProviderId({ provider, providerId }) : null;

  const inferredDraft =
    (jobId && provider && providerId && (!payload || !payload.message)) ? getLatestOutreachDraftByJobProviderId({ jobId, provider, providerId }) : null;

  const inferredPayload = payload
    ? payload
    : inferredDraft
      ? {
          to: (inferredLead && inferredLead.email) || process.env.OUTREACH_TEST_TO || null,
          subject: inferredDraft.subject || null,
          opening_message: inferredDraft.opening_message || inferredDraft.openingMessage || null,
          message: inferredDraft.opening_message || inferredDraft.openingMessage || null,
          cta: inferredDraft.cta || null,
          language: inferredDraft.language || null,
          tone: inferredDraft.tone || null,
        }
      : null;

  const normalized = {
    jobId: jobId ?? null,
    leadId: leadId ?? (inferredLead ? inferredLead.id : null),
    provider: provider ?? null,
    providerId: providerId ?? null,
    channel: channel ?? (payload && payload.channel ? payload.channel : null) ?? 'email',
    priority: priority ?? 0,
    payload: inferredPayload ?? null,
  };

  const to = normalized.payload && normalized.payload.to ? String(normalized.payload.to) : null;
  if (!to) {
    return {
      ok: false,
      queued: false,
      reason: 'MISSING_TO',
      jobId: normalized.jobId,
      leadId: normalized.leadId != null ? String(normalized.leadId) : null,
      provider: normalized.provider || null,
      providerId: normalized.providerId != null ? String(normalized.providerId) : null,
      channel: normalized.channel || null,
    };
  }

  const job_id = normalized.jobId;
  const lid = normalized.leadId != null ? String(normalized.leadId) : '';
  const pid = normalized.providerId != null ? String(normalized.providerId) : '';
  const ch = normalized.channel != null ? String(normalized.channel) : null;
  const prio = Number.isFinite(Number(normalized.priority)) ? Number(normalized.priority) : 0;

  const idempotencyKey =
    normalized.payload && normalized.payload.idempotency_key
      ? String(normalized.payload.idempotency_key)
      : `job:${job_id}::lead:${lid}::provider:${normalized.provider || ''}::pid:${pid}::channel:${ch || ''}`;

  const existing = db
    .prepare(
      `
      SELECT id
      FROM godmode_job_logs
      WHERE job_id = ?
        AND event_type = 'OUTREACH_ENQUEUED'
        AND json_extract(payload_json, '$.idempotency_key') = ?
      LIMIT 1
    `
    )
    .get(job_id, idempotencyKey);

  if (existing && existing.id) {
    return {
      ok: true,
      queued: false,
      jobId,
      leadId: lid || null,
      provider: normalized.provider || null,
      providerId: pid || null,
      channel: ch,
      priority: prio,
      idempotencyKey,
      alreadyQueued: true,
    };
  }

  const payloadJson = JSON.stringify({
    idempotency_key: idempotencyKey,
    lead_id: lid || null,
    provider: normalized.provider || null,
    provider_id: pid || null,
    channel: ch,
    priority: prio,
    payload: normalized.payload,
  });

  db.prepare(
    `
    INSERT INTO godmode_job_logs (job_id, event_type, payload_json, created_at)
    VALUES (?, 'OUTREACH_ENQUEUED', ?, ?)
  `
  ).run(job_id, payloadJson, new Date().toISOString());

  return {
    ok: true,
    queued: true,
    jobId,
    leadId: lid || null,
    provider: normalized.provider || null,
    providerId: pid || null,
    channel: ch,
    priority: prio,
    idempotencyKey,
    alreadyQueued: false,
  };
}

function getOutreachQueuedForJob(jobId, { limit } = {}) {
  const db = getDb();
  const lim = Number.isFinite(Number(limit)) ? Number(limit) : 100;

  const rows = db
    .prepare(
      `
      SELECT id, job_id, event_type, payload_json, created_at
      FROM godmode_job_logs
      WHERE job_id = ?
        AND event_type = 'OUTREACH_ENQUEUED'
      ORDER BY id ASC
      LIMIT ?
    `
    )
    .all(jobId, lim);

  return rows.map((r) => {
    let payload = null;
    try {
      payload = r.payload_json ? JSON.parse(r.payload_json) : null;
    } catch (_) {
      payload = null;
    }
    return {
      id: r.id,
      created_at: r.created_at,
      ...payload,
    };
  });
}

function hasOutreachTerminalEvent({ jobId, idempotencyKey }) {
  const db = getDb();

  const row = db
    .prepare(
      `
      SELECT id
      FROM godmode_job_logs
      WHERE job_id = ?
        AND event_type IN ('OUTREACH_DELIVERED', 'OUTREACH_FAILED')
        AND json_extract(payload_json, '$.idempotency_key') = ?
      LIMIT 1
    `
    )
    .get(jobId, String(idempotencyKey));

  return !!(row && row.id);
}

function markOutreachDelivered({ jobId, idempotencyKey, providerMessageId, extra }) {
  const db = getDb();
  const now = new Date().toISOString();

  const payloadJson = JSON.stringify({
    idempotency_key: String(idempotencyKey),
    provider_message_id: providerMessageId != null ? String(providerMessageId) : null,
    extra: extra || null,
  });

  db.prepare(
    `
    INSERT INTO godmode_job_logs (job_id, event_type, payload_json, created_at)
    VALUES (?, 'OUTREACH_DELIVERED', ?, ?)
  `
  ).run(jobId, payloadJson, now);

  return { ok: true };
}

function markOutreachFailed({ jobId, idempotencyKey, errorCode, errorMessage, extra }) {
  const db = getDb();
  const now = new Date().toISOString();

  const payloadJson = JSON.stringify({
    idempotency_key: String(idempotencyKey),
    error_code: errorCode != null ? String(errorCode) : null,
    error_message: errorMessage != null ? String(errorMessage) : null,
    extra: extra || null,
  });

  db.prepare(
    `
    INSERT INTO godmode_job_logs (job_id, event_type, payload_json, created_at)
    VALUES (?, 'OUTREACH_FAILED', ?, ?)
  `
  ).run(jobId, payloadJson, now);

  return { ok: true };
}

module.exports = {
  getLeadById,
  getLeadByProviderId,
  getLatestOutreachDraftByJobProviderId,
  enqueueOutreach,
  getOutreachQueuedForJob,
  hasOutreachTerminalEvent,
  markOutreachDelivered,
  markOutreachFailed,
};