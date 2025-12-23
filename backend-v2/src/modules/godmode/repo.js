/**
 * Potential lead dedup + upsert
 * Canonical key: provider + provider_id (örn: google_places + place_id)
 */
function upsertPotentialLead({
  provider,
  provider_id,
  name,
  category,
  city,
  raw_payload,
  canonical_key,
  provider_count,
  source_confidence,
  sources,
}) {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare(
      `
      SELECT
        id,
        first_seen_at,
        last_seen_at,
        scan_count
      FROM potential_leads
      WHERE provider = ?
        AND provider_id = ?
      LIMIT 1
    `,
    )
    .get(provider, provider_id);

  if (existing) {
    db.prepare(
      `
      UPDATE potential_leads
      SET
        last_seen_at     = @last_seen_at,
        scan_count       = scan_count + 1,
        raw_payload_json = @raw_payload_json,
        updated_at       = @updated_at
      WHERE id = @id
    `,
    ).run({
      id: existing.id,
      last_seen_at: now,
      updated_at: now,
      raw_payload_json: JSON.stringify({
        ...(raw_payload || {}),
        _merge: {
          canonical_key: canonical_key || null,
          provider_count:
            typeof provider_count === 'number' ? provider_count : null,
          source_confidence:
            typeof source_confidence === 'number' ? source_confidence : null,
          sources: Array.isArray(sources) ? sources : null,
        },
      }),
    });

    return {
      id: existing.id,
      deduped: true,
      last_seen_at_before: existing.last_seen_at || null,
      last_seen_at_after: now,
    };
  }

  const result = db
    .prepare(
      `
      INSERT INTO potential_leads (
        provider,
        provider_id,
        name,
        category,
        city,
        raw_payload_json,
        first_seen_at,
        last_seen_at,
        scan_count,
        created_at,
        updated_at
      )
      VALUES (
        @provider,
        @provider_id,
        @name,
        @category,
        @city,
        @raw_payload_json,
        @first_seen_at,
        @last_seen_at,
        @scan_count,
        @created_at,
        @updated_at
      )
    `,
    )
    .run({
      provider,
      provider_id,
      name: name || null,
      category: category || null,
      city: city || null,
      raw_payload_json: JSON.stringify({
        ...(raw_payload || {}),
        _merge: {
          canonical_key: canonical_key || null,
          provider_count:
            typeof provider_count === 'number' ? provider_count : null,
          source_confidence:
            typeof source_confidence === 'number' ? source_confidence : null,
          sources: Array.isArray(sources) ? sources : null,
        },
      }),
      first_seen_at: now,
      last_seen_at: now,
      scan_count: 1,
      created_at: now,
      updated_at: now,
    });

  return {
    id: result.lastInsertRowid,
    deduped: false,
    last_seen_at_before: null,
    last_seen_at_after: now,
  };
}
// backend-v2/src/modules/godmode/repo.js

const { getDb } = require('../../core/db');

/**
 * DB satırını job objesine çevir
 */
function rowToJob(row) {
  if (!row) return null;

  const criteria = row.criteria_json ? JSON.parse(row.criteria_json) : null;
  const resultSummary = row.result_summary_json
    ? JSON.parse(row.result_summary_json)
    : null;

  const progress = {
    percent: typeof row.percent === 'number' ? row.percent : 0,
    found_leads:
      typeof row.found_leads === 'number' ? row.found_leads : 0,
    enriched_leads:
      typeof row.enriched_leads === 'number' ? row.enriched_leads : 0,
  };

  return {
    id: row.id,
    type: row.type,
    label: row.label,
    criteria,
    status: row.status,
    progress,
    result_summary: resultSummary,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Tüm job’ları DB’den yükle (status + progress + result ile beraber).
 */
function loadAllJobs() {
  const db = getDb();

  const rows = db
    .prepare(
      `
      SELECT
        j.id,
        j.type,
        j.label,
        j.criteria_json,
        j.status,
        j.created_at,
        j.updated_at,
        p.percent,
        p.found_leads,
        p.enriched_leads,
        r.result_summary_json
      FROM godmode_jobs j
      LEFT JOIN godmode_job_progress p ON p.job_id = j.id
      LEFT JOIN godmode_job_results  r ON r.job_id = j.id
      ORDER BY j.created_at DESC
    `,
    )
    .all();

  return rows.map(rowToJob);
}

/**
 * Yeni job insert.
 */
function insertJob(job) {
  const db = getDb();
  const now = job.created_at || new Date().toISOString();

  db.prepare(
    `
    INSERT INTO godmode_jobs (
      id,
      type,
      label,
      criteria_json,
      status,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @type,
      @label,
      @criteria_json,
      @status,
      @created_at,
      @updated_at
    )
  `,
  ).run({
    id: job.id,
    type: job.type,
    label: job.label || null,
    criteria_json: JSON.stringify(job.criteria || {}),
    status: job.status,
    created_at: now,
    updated_at: now,
  });

  const progress = job.progress || {
    percent: 0,
    found_leads: 0,
    enriched_leads: 0,
  };

  db.prepare(
    `
    INSERT INTO godmode_job_progress (
      job_id,
      percent,
      found_leads,
      enriched_leads,
      updated_at
    )
    VALUES (
      @job_id,
      @percent,
      @found_leads,
      @enriched_leads,
      @updated_at
    )
  `,
  ).run({
    job_id: job.id,
    percent: progress.percent || 0,
    found_leads: progress.found_leads || 0,
    enriched_leads: progress.enriched_leads || 0,
    updated_at: now,
  });

  if (job.result_summary) {
    db.prepare(
      `
      INSERT INTO godmode_job_results (
        job_id,
        result_summary_json,
        updated_at
      )
      VALUES (
        @job_id,
        @result_summary_json,
        @updated_at
      )
    `,
    ).run({
      job_id: job.id,
      result_summary_json: JSON.stringify(job.result_summary),
      updated_at: now,
    });
  }

  return job;
}

/**
 * Status + progress + result güncelle.
 */
function updateJob(job) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `
    UPDATE godmode_jobs
    SET
      status = @status,
      updated_at = @updated_at
    WHERE id = @id
  `,
  ).run({
    id: job.id,
    status: job.status,
    updated_at: now,
  });

  const progress = job.progress || {
    percent: 0,
    found_leads: 0,
    enriched_leads: 0,
  };

  db.prepare(
    `
    INSERT INTO godmode_job_progress (
      job_id,
      percent,
      found_leads,
      enriched_leads,
      updated_at
    )
    VALUES (
      @job_id,
      @percent,
      @found_leads,
      @enriched_leads,
      @updated_at
    )
    ON CONFLICT(job_id) DO UPDATE SET
      percent        = excluded.percent,
      found_leads    = excluded.found_leads,
      enriched_leads = excluded.enriched_leads,
      updated_at     = excluded.updated_at
  `,
  ).run({
    job_id: job.id,
    percent: progress.percent || 0,
    found_leads: progress.found_leads || 0,
    enriched_leads: progress.enriched_leads || 0,
    updated_at: now,
  });

  if (job.result_summary) {
    db.prepare(
      `
      INSERT INTO godmode_job_results (
        job_id,
        result_summary_json,
        updated_at
      )
      VALUES (
        @job_id,
        @result_summary_json,
        @updated_at
      )
      ON CONFLICT(job_id) DO UPDATE SET
        result_summary_json = excluded.result_summary_json,
        updated_at          = excluded.updated_at
    `,
    ).run({
      job_id: job.id,
      result_summary_json: JSON.stringify(job.result_summary),
      updated_at: now,
    });
  }

  return job;
}

/**
 * Tek job’ı DB’den oku.
 */
function getJobById(id) {
  const db = getDb();

  const row = db
    .prepare(
      `
      SELECT
        j.id,
        j.type,
        j.label,
        j.criteria_json,
        j.status,
        j.created_at,
        j.updated_at,
        p.percent,
        p.found_leads,
        p.enriched_leads,
        r.result_summary_json
      FROM godmode_jobs j
      LEFT JOIN godmode_job_progress p ON p.job_id = j.id
      LEFT JOIN godmode_job_results  r ON r.job_id = j.id
      WHERE j.id = ?
    `,
    )
    .get(id);

  return rowToJob(row);
}

/**
 * Job event log append (1.G.5)
 */
function appendJobLog(jobId, eventType, payload) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO godmode_job_logs (
      job_id,
      event_type,
      payload_json,
      created_at
    )
    VALUES (
      @job_id,
      @event_type,
      @payload_json,
      @created_at
    )
  `,
  ).run({
    job_id: jobId,
    event_type: eventType,
    payload_json: payload ? JSON.stringify(payload) : null,
    created_at: now,
  });
}

/**
 * Deep Enrichment stage state append
 */
function appendDeepEnrichmentStage(jobId, stage, payload) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO godmode_job_logs (
      job_id,
      event_type,
      payload_json,
      created_at
    )
    VALUES (
      @job_id,
      @event_type,
      @payload_json,
      @created_at
    )
  `,
  ).run({
    job_id: jobId,
    event_type: `DEEP_ENRICHMENT_${stage}`,
    payload_json: payload ? JSON.stringify(payload) : null,
    created_at: now,
  });
}

/**
 * İsteğe bağlı: bir job’ın log geçmişi (debug için)
 */
function getJobLogs(jobId) {
  const db = getDb();

  return db
    .prepare(
      `
      SELECT
        id,
        job_id,
        event_type,
        payload_json,
        created_at
      FROM godmode_job_logs
      WHERE job_id = ?
      ORDER BY id ASC
    `,
    )
    .all(jobId);
}

/**
 * Read deep enrichment related logs for a job
 */
function getDeepEnrichmentLogs(jobId) {
  const db = getDb();

  return db
    .prepare(
      `
      SELECT
        id,
        event_type,
        payload_json,
        created_at
      FROM godmode_job_logs
      WHERE job_id = ?
        AND event_type LIKE 'DEEP_ENRICHMENT_%'
      ORDER BY id ASC
    `,
    )
    .all(jobId);
}

/**
 * Persist deep enrichment queue batches as job logs (no new table yet).
 * This is an infra-safe queue primitive; real execution can later move to a dedicated table + migration.
 */
function enqueueDeepEnrichmentCandidates(jobId, candidateIds, sources, opts) {
  const db = getDb();
  const now = new Date().toISOString();

  const ids = Array.isArray(candidateIds) ? candidateIds : [];
  const normalized = ids
    .map((x) => (typeof x === 'string' ? x.trim() : String(x || '')))
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));

  const chunkSize =
    opts && typeof opts.chunk_size === 'number' && opts.chunk_size > 0
      ? Math.floor(opts.chunk_size)
      : 50;

  const cap =
    opts && typeof opts.cap === 'number' && opts.cap > 0
      ? Math.floor(opts.cap)
      : 5000;

  const finalIds = unique.slice(0, cap);

  if (finalIds.length === 0) {
    return {
      queued: 0,
      batches: 0,
    };
  }

  const batchCount = Math.ceil(finalIds.length / chunkSize);

  const insertStmt = db.prepare(
    `
    INSERT INTO godmode_job_logs (
      job_id,
      event_type,
      payload_json,
      created_at
    )
    VALUES (
      @job_id,
      @event_type,
      @payload_json,
      @created_at
    )
  `,
  );

  const tx = db.transaction(() => {
    for (let i = 0; i < batchCount; i += 1) {
      const batchIds = finalIds.slice(i * chunkSize, (i + 1) * chunkSize);

      insertStmt.run({
        job_id: jobId,
        event_type: 'DEEP_ENRICHMENT_QUEUED',
        payload_json: JSON.stringify({
          job_id: jobId,
          batch_index: i,
          batch_count: batchCount,
          ids: batchIds,
          sources: Array.isArray(sources) ? sources : [],
          created_at: now,
        }),
        created_at: now,
      });
    }
  });

  tx();

  return {
    queued: finalIds.length,
    batches: batchCount,
  };
}

/**
 * Convenience reader: queued batches for a job.
 */
function getDeepEnrichmentQueuedBatches(jobId) {
  const db = getDb();

  const rows = db
    .prepare(
      `
      SELECT
        id,
        payload_json,
        created_at
      FROM godmode_job_logs
      WHERE job_id = ?
        AND event_type = 'DEEP_ENRICHMENT_QUEUED'
      ORDER BY id ASC
    `,
    )
    .all(jobId);

  return rows.map((r) => {
    try {
      return {
        id: r.id,
        created_at: r.created_at,
        payload: r.payload_json ? JSON.parse(r.payload_json) : null,
      };
    } catch {
      return {
        id: r.id,
        created_at: r.created_at,
        payload: null,
      };
    }
  });
}

module.exports = {
  loadAllJobs,
  insertJob,
  updateJob,
  getJobById,
  appendJobLog,
  getJobLogs,
  upsertPotentialLead,
  appendDeepEnrichmentStage,
  getDeepEnrichmentLogs,
  enqueueDeepEnrichmentCandidates,
  getDeepEnrichmentQueuedBatches,
};