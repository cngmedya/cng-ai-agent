/**
 * Outreach Trigger Service — FAZ 4.C (v1 minimal) + FAZ 4.D guardrails (v1 minimal)
 * ------------------------------------------------------------
 * Sorumluluklar:
 * - Godmode Brain çıktılarından outreach enqueue kararı
 * - A/B band gating
 * - Idempotency (aynı job + lead için tek enqueue)
 * - Outreach modülüne push (send değil)
 *
 * Guardrails (4.D v1):
 * - Kill-switch: OUTREACH_EXECUTION_ENABLED
 * - Dry-run: OUTREACH_DRY_RUN (log only, no enqueue)
 * - Daily cap: OUTREACH_DAILY_CAP (hard cap per run)
 *
 * NOT:
 * - Mesaj göndermez
 * - Scheduler çalıştırmaz
 * - Sadece enqueue eder
 */

const {
  logJobEvent,
  hasOutreachEnqueue,
  countTodayOutreachExecutions,
  getLatestAiArtifactByJobProviderId,
  getPotentialLeadByProviderId,
} = require('../repo');
const { enqueueOutreach } = require('../../outreach/repo');

const FAILURE_TYPES = {
  POLICY_BLOCK: 'policy_block',
  VALIDATION: 'validation',
  PROVIDER_ERROR: 'provider_error',
  UNKNOWN: 'unknown',
};

const EXECUTION_MODES = {
  QUEUE_ONLY: 'queue_only',
  SEND_NOW: 'send_now',
  SCHEDULE: 'schedule',
};

function resolveExecutionIntent(mode) {
  switch (mode) {
    case EXECUTION_MODES.QUEUE_ONLY:
      return 'QUEUE';
    case EXECUTION_MODES.SEND_NOW:
      return 'SEND';
    case EXECUTION_MODES.SCHEDULE:
      return 'SCHEDULE';
    default:
      return 'BLOCK';
  }
}

const POLICY_REASONS = {
  KILL_SWITCH: 'KILL_SWITCH',
  DAILY_CAP_REACHED: 'DAILY_CAP_REACHED',
  UNSUPPORTED_CHANNEL: 'UNSUPPORTED_CHANNEL',
  MODE_NOT_IMPLEMENTED: 'MODE_NOT_IMPLEMENTED',
  ALLOWLIST_BLOCKED: 'ALLOWLIST_BLOCKED',
};

function readOutreachConfig() {
  const executionEnabled = process.env.OUTREACH_EXECUTION_ENABLED === '1';
  const dryRun = process.env.OUTREACH_DRY_RUN === '1';
  const dailyCap = Number(process.env.OUTREACH_DAILY_CAP || 50);

  const allowlistProviderIdsRaw = process.env.OUTREACH_ALLOWLIST_PROVIDER_IDS || '';
  const allowlistProviderIds = new Set(
    allowlistProviderIdsRaw
      .split(',')
      .map((s) => String(s || '').trim())
      .filter(Boolean)
  );
  const allowlistEnabled = allowlistProviderIds.size > 0;

  const rawMode = process.env.OUTREACH_EXECUTION_MODE || 'stub';

  // Normalize mode aliases (env-friendly)
  // - stub: keeps legacy behavior (SEND intent but only stub events)
  // - queue: alias for queue_only (real enqueue path)
  const normalizedMode =
    rawMode === 'stub'
      ? EXECUTION_MODES.SEND_NOW
      : rawMode === 'queue'
        ? EXECUTION_MODES.QUEUE_ONLY
        : rawMode;

  const executionMode = normalizedMode;

  return {
    executionEnabled,
    dryRun,
    dailyCap,
    rawMode,
    executionMode,
    allowlistEnabled,
    allowlistProviderIds,
  };
}

function isAllowlisted({ allowlistEnabled, allowlistProviderIds }, t) {
  if (!allowlistEnabled) return true;
  const pid = t && t.provider_id != null ? String(t.provider_id) : '';
  if (!pid) return false;
  return allowlistProviderIds.has(pid);
}

function getResolvedChannel(t) {
  return t.routing_channel || t.primary_channel || null;
}

function extractOutreachDraft(t) {
  const d =
    (t && (t.outreach_draft_v1 || t.outreach_draft || t.outreachDraft || t.draft)) ||
    (t && t.ai_artifacts && (t.ai_artifacts.outreach_draft_v1 || t.ai_artifacts.outreachDraft)) ||
    null;

  if (!d || typeof d !== 'object') return null;

  return {
    suggested_channel: d.suggested_channel || null,
    subject: d.subject || null,
    opening_message: d.opening_message || d.openingMessage || null,
    cta: d.cta || null,
    language: d.language || null,
    tone: d.tone || null,
  };
}

async function resolveOutreachDraft({ jobId, t }) {
  const inline = extractOutreachDraft(t);
  if (inline) return inline;

  const provider = t && t.provider ? t.provider : null;
  const providerId = t && t.provider_id != null ? String(t.provider_id) : null;

  if (!jobId || !provider || !providerId) return null;

  const row = getLatestAiArtifactByJobProviderId({
    jobId,
    provider,
    providerId,
    artifactType: 'outreach_draft_v1',
  });

  if (!row || !row.artifact || typeof row.artifact !== 'object') return null;

  return {
    suggested_channel: row.artifact.suggested_channel || null,
    subject: row.artifact.subject || null,
    opening_message: row.artifact.opening_message || row.artifact.openingMessage || null,
    cta: row.artifact.cta || null,
    language: row.artifact.language || null,
    tone: row.artifact.tone || null,
  };
}

/**
 * @param {Object} params
 * @param {Object} params.job
 * @param {Array<Object>} params.targets
 */
async function runOutreachAutoTrigger({ job, targets }) {
  let eligibleCount = 0;
  let enqueuedCount = 0;

  const {
    executionEnabled,
    dryRun,
    dailyCap,
    rawMode,
    executionMode,
    allowlistEnabled,
    allowlistProviderIds,
  } = readOutreachConfig();

  if (!executionEnabled) {
    logJobEvent(job.id, 'OUTREACH_EXECUTION_BLOCKED_POLICY', {
      reason: POLICY_REASONS.KILL_SWITCH,
    });
    return { eligibleCount: 0, enqueuedCount: 0 };
  }

  const usedToday = countTodayOutreachExecutions({ provider: null });
  let remainingQuota = Math.max(dailyCap - usedToday, 0);

  if (remainingQuota <= 0) {
    logJobEvent(job.id, 'OUTREACH_EXECUTION_BLOCKED_POLICY', {
      reason: POLICY_REASONS.DAILY_CAP_REACHED,
      cap: dailyCap,
      usedToday,
    });
    return { eligibleCount: 0, enqueuedCount: 0 };
  }

  for (const t of targets) {
    if (remainingQuota <= 0) {
      logJobEvent(job.id, 'OUTREACH_EXECUTION_BLOCKED_POLICY', {
        reason: POLICY_REASONS.DAILY_CAP_REACHED,
        cap: dailyCap,
        usedToday,
      });
      break;
    }

    logJobEvent(job.id, 'OUTREACH_EXECUTION_ATTEMPT', {
      provider: t.provider,
      provider_id: t.provider_id,
      mode: executionMode,
      raw_mode: rawMode,
    });

    const executionIntent = resolveExecutionIntent(executionMode);

    logJobEvent(job.id, 'OUTREACH_EXECUTION_INTENT', {
      provider: t.provider,
      provider_id: t.provider_id,
      intent: executionIntent,
      mode: executionMode,
      raw_mode: rawMode,
    });

    // A/B band gating
    if (t.ai_score_band !== 'A' && t.ai_score_band !== 'B') {
      continue;
    }

    const originalChannel = getResolvedChannel(t);
    let channel = originalChannel;

    // FAZ 4.E.1 scope lock (v1): only email is eligible for real execution paths
    // WhatsApp is NOT disabled; it is only downshifted to email until WhatsApp provider is implemented.
    if (!dryRun && channel !== 'email') {
      if (channel === 'whatsapp') {
        channel = 'email';
        logJobEvent(job.id, 'OUTREACH_CHANNEL_FALLBACK', {
          from: 'whatsapp',
          to: 'email',
          provider: t.provider,
          provider_id: t.provider_id,
        });
      } else {
        logJobEvent(job.id, 'OUTREACH_EXECUTION_BLOCKED_POLICY', {
          reason: POLICY_REASONS.UNSUPPORTED_CHANNEL,
          channel: channel,
        });
        continue;
      }
    }

    // FAZ 4.E.3 allowlist gate (v1): if configured, hard-block non-allowlisted targets
    if (!dryRun && !isAllowlisted({ allowlistEnabled, allowlistProviderIds }, t)) {
      logJobEvent(job.id, 'OUTREACH_EXECUTION_BLOCKED_POLICY', {
        reason: POLICY_REASONS.ALLOWLIST_BLOCKED,
        provider: t.provider,
        provider_id: t.provider_id,
      });
      continue;
    }

    // Idempotency check
    const alreadyEnqueued = await hasOutreachEnqueue({
      jobId: job.id,
      provider: t.provider,
      providerId: String(t.provider_id),
    });

    if (alreadyEnqueued) {
      logJobEvent(job.id, 'OUTREACH_AUTO_TRIGGER_SKIP', {
        provider: t.provider,
        provider_id: t.provider_id,
        reason: 'ALREADY_ENQUEUED',
      });
      continue;
    }

    eligibleCount += 1;

    try {
      if (dryRun) {
        logJobEvent(job.id, 'OUTREACH_EXECUTION_DRY_RUN', {
          provider: t.provider,
          provider_id: t.provider_id,
          mode: executionMode,
        });

        // Dry-run: simulate "sent" for analytics/CRM chain, but do not enqueue/send/schedule.
        // const channel = t.routing_channel || t.primary_channel || null;  // <-- removed as now resolved above

        if (executionIntent === 'SEND') {
          if (channel !== 'email' && channel !== 'whatsapp') {
            logJobEvent(job.id, 'OUTREACH_EXECUTION_BLOCKED_POLICY', {
              reason: POLICY_REASONS.UNSUPPORTED_CHANNEL,
              channel: channel,
            });
            continue;
          }
        }

        logJobEvent(job.id, 'OUTREACH_EXECUTION_SENT', {
          dry_run: true,
          provider: t.provider,
          provider_id: t.provider_id,
          intent: executionIntent,
          channel,
          mode: executionMode,
          raw_mode: rawMode,
        });
      } else if (executionIntent === 'QUEUE') {
        const draft = await resolveOutreachDraft({ jobId: job.id, t });

        const lead = getPotentialLeadByProviderId({
          provider: t.provider,
          providerId: String(t.provider_id),
        });

        const hasFallbackTo = Boolean(process.env.OUTREACH_TEST_TO);

        if (!lead || !lead.id || (!lead.email && !hasFallbackTo)) {
          logJobEvent(job.id, 'OUTREACH_EXECUTION_BLOCKED_POLICY', {
            reason: 'LEAD_NOT_RESOLVED',
            provider: t.provider,
            provider_id: t.provider_id,
          });
          continue;
        }

        await enqueueOutreach({
          jobId: job.id,
          leadId: lead.id,
          provider: t.provider,
          providerId: String(t.provider_id),
          channel: channel,
          priority: t.priority_score || 0,
          payload: {
            to: lead.email || process.env.OUTREACH_TEST_TO || null,
            subject: (draft && draft.subject) || null,
            opening_message: (draft && draft.opening_message) || null,
            message: (draft && draft.opening_message) || null,
            cta: (draft && draft.cta) || null,
            language: (draft && draft.language) || null,
            tone: (draft && draft.tone) || null,
          },
        });
      } else if (executionIntent === 'SEND') {
        if (channel === 'email') {
          logJobEvent(job.id, 'OUTREACH_SEND_STUB', {
            provider: t.provider,
            provider_id: t.provider_id,
            channel: 'email',
          });
        } else if (channel === 'whatsapp') {
          logJobEvent(job.id, 'OUTREACH_SEND_STUB', {
            provider: t.provider,
            provider_id: t.provider_id,
            channel: 'whatsapp',
          });
        } else {
          logJobEvent(job.id, 'OUTREACH_EXECUTION_BLOCKED_POLICY', {
            reason: POLICY_REASONS.UNSUPPORTED_CHANNEL,
            channel: channel || null,
          });
          continue;
        }
      } else if (executionIntent === 'SCHEDULE') {
        logJobEvent(job.id, 'OUTREACH_SCHEDULE_STUB', {
          provider: t.provider,
          provider_id: t.provider_id,
          channel: channel || null,
        });
      } else {
        logJobEvent(job.id, 'OUTREACH_EXECUTION_BLOCKED_POLICY', {
          reason: POLICY_REASONS.MODE_NOT_IMPLEMENTED,
          mode: executionMode,
        });
        continue;
      }

      enqueuedCount += 1;
      remainingQuota -= 1;

      logJobEvent(job.id, 'OUTREACH_AUTO_TRIGGER_ENQUEUED', {
        provider: t.provider,
        provider_id: t.provider_id,
      });
    } catch (err) {
      let failureType = FAILURE_TYPES.UNKNOWN;

      if (err && err.code === 'VALIDATION_ERROR') {
        failureType = FAILURE_TYPES.VALIDATION;
      } else if (err && err.code === 'PROVIDER_ERROR') {
        failureType = FAILURE_TYPES.PROVIDER_ERROR;
      }

      logJobEvent(job.id, 'OUTREACH_EXECUTION_FAILED', {
        dry_run: dryRun,
        provider: t.provider,
        provider_id: t.provider_id,
        reason_class: failureType,
        failure_type: failureType,
        error: err.message || String(err),
      });
    }
  }

  logJobEvent(job.id, 'OUTREACH_AUTO_TRIGGER_DONE', {
    eligibleCount,
    enqueuedCount,
  });

  return {
    eligibleCount,
    enqueuedCount,
  };
}

module.exports = {
  runOutreachAutoTrigger,
};