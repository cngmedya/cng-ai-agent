

const { getOutreachQueuedForJob, hasOutreachTerminalEvent, markOutreachDelivered, markOutreachFailed } = require('./repo');
const providers = require('./providers');

function coalesceTo(payload) {
  if (payload) {
    if (payload.to) return payload.to;
    if (payload.email) return payload.email;
    if (payload.recipient) return payload.recipient;
  }
  if (process.env.OUTREACH_TEST_TO) return process.env.OUTREACH_TEST_TO;
  return null;
}

async function processOutreachQueue({ jobId, limit } = {}) {
  if (!jobId) {
    throw new Error('jobId is required');
  }

  const rows = getOutreachQueuedForJob(jobId, { limit: limit || 100 });

  const results = [];
  for (const r of rows) {
    const idempotencyKey = r && r.idempotency_key ? String(r.idempotency_key) : '';
    if (!idempotencyKey) continue;

    if (hasOutreachTerminalEvent({ jobId, idempotencyKey })) {
      results.push({ ok: true, skipped: true, idempotency_key: idempotencyKey });
      continue;
    }

    const channel = r.channel || 'email';
    const payload = r.payload || {};
    const msg = payload && payload.payload ? payload.payload : payload;
    const to = coalesceTo(msg);

    try {
      const res = await providers.sendMessage({
        channel,
        to,
        subject: msg.subject || process.env.OUTREACH_TEST_SUBJECT || 'Merhaba',
        text: msg.text || msg.message || msg.opening_message || msg.body || null,
        html: msg.html || null,
        meta: msg.meta || null,
      });

      if (res && res.ok) {
        markOutreachDelivered({
          jobId,
          idempotencyKey,
          providerMessageId: res.provider_message_id || null,
          extra: { provider: res.provider, channel: res.channel },
        });

        results.push({
          ok: true,
          delivered: true,
          idempotency_key: idempotencyKey,
          provider_message_id: res.provider_message_id || null,
        });
      } else {
        markOutreachFailed({
          jobId,
          idempotencyKey,
          errorCode: res && res.error_code ? res.error_code : 'SEND_FAILED',
          errorMessage: res && res.error_message ? res.error_message : 'Send failed',
          extra: { provider: res && res.provider ? res.provider : null, channel },
        });

        results.push({
          ok: false,
          delivered: false,
          idempotency_key: idempotencyKey,
          error_code: res && res.error_code ? res.error_code : 'SEND_FAILED',
        });
      }
    } catch (e) {
      markOutreachFailed({
        jobId,
        idempotencyKey,
        errorCode: e && (e.code || e.name) ? String(e.code || e.name) : 'WORKER_ERROR',
        errorMessage: e && e.message ? String(e.message) : 'Worker error',
        extra: null,
      });

      results.push({
        ok: false,
        delivered: false,
        idempotency_key: idempotencyKey,
        error_code: e && (e.code || e.name) ? String(e.code || e.name) : 'WORKER_ERROR',
      });
    }
  }

  return { ok: true, jobId, processed: results.length, results };
}

module.exports = {
  processOutreachQueue,
};

async function main() {
  const argv = process.argv.slice(2);
  const jobId = argv[0] || process.env.OUTREACH_WORKER_JOB_ID || null;
  const limitRaw = argv[1] || process.env.OUTREACH_WORKER_LIMIT || null;
  const limit = limitRaw ? Number(limitRaw) : undefined;

  if (!jobId) {
    console.error('Missing jobId. Usage: node src/modules/outreach/worker.js <jobId> [limit]');
    process.exit(2);
  }

  try {
    const res = await processOutreachQueue({ jobId, limit });
    console.log(JSON.stringify(res));
    process.exit(res && res.ok ? 0 : 1);
  } catch (e) {
    console.error(String(e && e.stack ? e.stack : e));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}