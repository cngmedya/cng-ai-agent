// backend-v2/src/modules/godmode/repo.js

const { getDb } = require('../../core/db');

/**
 * v2 – Persist deep enrichment snapshot into lead_enrichments table
 */
function insertLeadEnrichmentSnapshot({
  leadId,
  jobId,
  provider,
  providerId,
  source,
  seo,
  social,
  tech,
  opportunity,
}) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO lead_enrichments (
      lead_id,
      job_id,
      provider,
      provider_id,
      source,
      seo_json,
      social_json,
      tech_json,
      opportunity_json,
      created_at
    )
    VALUES (
      @lead_id,
      @job_id,
      @provider,
      @provider_id,
      @source,
      @seo_json,
      @social_json,
      @tech_json,
      @opportunity_json,
      @created_at
    )
  `,
  ).run({
    lead_id: leadId,
    job_id: jobId || null,
    provider: provider || null,
    provider_id: providerId || null,
    source: source || 'godmode',
    seo_json: seo ? JSON.stringify(seo) : null,
    social_json: social ? JSON.stringify(social) : null,
    tech_json: tech ? JSON.stringify(tech) : null,
    opportunity_json: opportunity ? JSON.stringify(opportunity) : null,
    created_at: now,
  });

  return { ok: true };
}

/**
 * Get latest enrichment snapshot for a lead (v2)
 */
function getLatestLeadEnrichmentByLeadId(leadId) {
  const db = getDb();

  const row = db
    .prepare(
      `
      SELECT
        id,
        lead_id,
        job_id,
        provider,
        provider_id,
        source,
        seo_json,
        social_json,
        tech_json,
        opportunity_json,
        created_at
      FROM lead_enrichments
      WHERE lead_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    )
    .get(leadId);

  if (!row) return null;

  return {
    id: row.id,
    lead_id: row.lead_id,
    job_id: row.job_id,
    provider: row.provider,
    provider_id: row.provider_id,
    source: row.source,
    seo: safeParseJson(row.seo_json, null),
    social: safeParseJson(row.social_json, null),
    tech: safeParseJson(row.tech_json, null),
    opportunity: safeParseJson(row.opportunity_json, null),
    created_at: row.created_at,
  };
}
/**
 * Potential lead dedup + upsert
 * Canonical key: provider + provider_id (örn: google_places + place_id)
 */
function upsertPotentialLead({
  jobId,
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
        scan_count,
        raw_payload_json
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
      raw_payload_json: JSON.stringify((() => {
        const prev = safeParseJson(existing.raw_payload_json, {});
        const prevObj = prev && typeof prev === 'object' ? prev : {};
        const prevMerge =
          prevObj && typeof prevObj._merge === 'object' && prevObj._merge
            ? prevObj._merge
            : {};

        const base = {
          ...prevObj,
          ...(raw_payload || {}),
        };

        // Begin: Accept last_discovery_job_id from raw_payload._merge if present
        const payloadMerge =
          raw_payload &&
          typeof raw_payload === 'object' &&
          raw_payload._merge &&
          typeof raw_payload._merge === 'object'
            ? raw_payload._merge
            : null;

        const payloadLastDiscoveryJobId =
          payloadMerge && payloadMerge.last_discovery_job_id
            ? payloadMerge.last_discovery_job_id
            : null;
        // End: Accept last_discovery_job_id from raw_payload._merge if present

        return {
          ...base,
          _merge: {
            ...prevMerge,
            last_discovery_job_id:
              payloadLastDiscoveryJobId ||
              jobId ||
              prevMerge.last_discovery_job_id ||
              null,
            discovered_at: now,
            source: 'godmode',
            canonical_key: canonical_key || prevMerge.canonical_key || null,
            provider_count:
              typeof provider_count === 'number'
                ? provider_count
                : typeof prevMerge.provider_count === 'number'
                  ? prevMerge.provider_count
                  : null,
            source_confidence:
              typeof source_confidence === 'number'
                ? source_confidence
                : typeof prevMerge.source_confidence === 'number'
                  ? prevMerge.source_confidence
                  : null,
            sources: Array.isArray(sources)
              ? sources
              : Array.isArray(prevMerge.sources)
                ? prevMerge.sources
                : null,
          },
        };
      })()),
    });

    return {
      id: existing.id,
      deduped: true,
      last_seen_at_before: existing.last_seen_at || null,
      last_seen_at_after: now,
      is_new: false,
      scan_count_before: typeof existing.scan_count === 'number' ? existing.scan_count : null,
      scan_count_after: (typeof existing.scan_count === 'number' ? existing.scan_count : 0) + 1,
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
          discovered_at: now,
          source: 'godmode',
          last_discovery_job_id:
            (raw_payload &&
            typeof raw_payload === 'object' &&
            raw_payload._merge &&
            typeof raw_payload._merge === 'object' &&
            raw_payload._merge.last_discovery_job_id
              ? raw_payload._merge.last_discovery_job_id
              : null) || jobId || null,
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
    is_new: true,
    scan_count_before: 0,
    scan_count_after: 1,
  };
}

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
 * AI Artifacts (read-only persistence layer)
 * Table (expected):
 *   ai_artifacts(
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     job_id TEXT,
 *     lead_id INTEGER,
 *     provider TEXT,
 *     provider_id TEXT,
 *     artifact_type TEXT,
 *     artifact_json TEXT,
 *     created_at TEXT
 *   )
 *
 * NOTE:
 * - Table is introduced via migration in FAZ 3.C.2.
 * - Repo calls are best-effort: if table is missing, we return ok:false and do not throw.
 */

function insertAiArtifact({
  jobId,
  leadId,
  provider,
  providerId,
  artifactType,
  artifact,
}) {
  const db = getDb();
  const now = new Date().toISOString();

  try {
    db.prepare(
      `
      INSERT INTO ai_artifacts (
        job_id,
        lead_id,
        provider,
        provider_id,
        artifact_type,
        artifact_json,
        created_at
      )
      VALUES (
        @job_id,
        @lead_id,
        @provider,
        @provider_id,
        @artifact_type,
        @artifact_json,
        @created_at
      )
    `,
    ).run({
      job_id: jobId || null,
      lead_id: typeof leadId === 'number' ? leadId : null,
      provider: provider || null,
      provider_id: providerId || null,
      artifact_type: artifactType,
      artifact_json: artifact ? JSON.stringify(artifact) : null,
      created_at: now,
    });

    return { ok: true, created_at: now };
  } catch (e) {
    const msg = e && (e.message || String(e));
    if (msg && msg.toLowerCase().includes('no such table')) {
      return { ok: false, reason: 'AI_ARTIFACTS_TABLE_MISSING' };
    }
    return { ok: false, reason: 'AI_ARTIFACTS_INSERT_FAILED', error: msg };
  }
}

function getLatestAiArtifactByLeadId(leadId, artifactType) {
  const db = getDb();

  try {
    const row = db
      .prepare(
        `
        SELECT
          id,
          job_id,
          lead_id,
          provider,
          provider_id,
          artifact_type,
          artifact_json,
          created_at
        FROM ai_artifacts
        WHERE lead_id = ?
          AND artifact_type = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      )
      .get(leadId, artifactType);

    if (!row) return null;

    return {
      id: row.id,
      job_id: row.job_id,
      lead_id: row.lead_id,
      provider: row.provider,
      provider_id: row.provider_id,
      artifact_type: row.artifact_type,
      artifact: safeParseJson(row.artifact_json, null),
      created_at: row.created_at,
    };
  } catch (e) {
    const msg = e && (e.message || String(e));
    if (msg && msg.toLowerCase().includes('no such table')) {
      return null;
    }
    return null;
  }
}

function listAiArtifactsByJobId(jobId, artifactType, limit) {
  const db = getDb();
  const lim =
    typeof limit === 'number' && limit > 0 ? Math.floor(limit) : 50;

  try {
    const rows = db
      .prepare(
        `
        SELECT
          id,
          job_id,
          lead_id,
          provider,
          provider_id,
          artifact_type,
          artifact_json,
          created_at
        FROM ai_artifacts
        WHERE job_id = ?
          AND artifact_type = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      )
      .all(jobId, artifactType, lim);

    return (rows || []).map((r) => ({
      id: r.id,
      job_id: r.job_id,
      lead_id: r.lead_id,
      provider: r.provider,
      provider_id: r.provider_id,
      artifact_type: r.artifact_type,
      artifact: safeParseJson(r.artifact_json, null),
      created_at: r.created_at,
    }));
  } catch (e) {
    const msg = e && (e.message || String(e));
    if (msg && msg.toLowerCase().includes('no such table')) {
      return [];
    }
    return [];
  }
}

function safeParseJson(text, fallback) {
  try {
    if (!text) return fallback;
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

/**
 * Persist deep enrichment snapshot into potential_leads.raw_payload_json
 * v1 approach: no new tables, merge under `_deep_enrichment`
 */
function upsertDeepEnrichmentIntoPotentialLead({
  provider,
  providerId,
  enrichment,
  jobId,
}) {
  const db = getDb();

  const row = db
    .prepare(
      `
      SELECT id, raw_payload_json
      FROM potential_leads
      WHERE provider = @provider AND provider_id = @provider_id
      LIMIT 1
    `,
    )
    .get({
      provider,
      provider_id: providerId,
    });

  if (!row) {
    return { ok: false, reason: 'LEAD_NOT_FOUND' };
  }

  const raw = safeParseJson(row.raw_payload_json, {});
  const existingMerge = raw && typeof raw === 'object' ? raw._merge || null : null;

  const next = {
    ...(raw && typeof raw === 'object' ? raw : {}),
    _merge: {
      ...(existingMerge && typeof existingMerge === 'object' ? existingMerge : {}),
      // Never lose discovery job binding; if missing, best-effort default to current jobId
      last_discovery_job_id:
        existingMerge && typeof existingMerge === 'object' && existingMerge.last_discovery_job_id
          ? existingMerge.last_discovery_job_id
          : jobId || null,
    },
    _deep_enrichment: {
      ...(raw && raw._deep_enrichment ? raw._deep_enrichment : {}),
      ...enrichment,
      job_id: jobId,
      provider,
      provider_id: providerId,
      persisted_at: new Date().toISOString(),
      version: 'v1.1.4',
    },
  };

  db.prepare(
    `
    UPDATE potential_leads
    SET raw_payload_json = @raw_payload_json,
        updated_at = @updated_at
    WHERE id = @id
  `,
  ).run({
    id: row.id,
    raw_payload_json: JSON.stringify(next),
    updated_at: new Date().toISOString(),
  });

  // v2 normalized snapshot persist (lead_enrichments) – best-effort but observable
  try {
    const seo =
      enrichment && typeof enrichment === 'object'
        ? enrichment.seo || enrichment.seo_signals || null
        : null;

    const social =
      enrichment && typeof enrichment === 'object'
        ? enrichment.social || enrichment.social_signals || null
        : null;

    const tech =
      enrichment && typeof enrichment === 'object'
        ? enrichment.tech || enrichment.tech_stub || []
        : [];

    const opportunity =
      enrichment && typeof enrichment === 'object'
        ? enrichment.opportunity || enrichment.opportunity_score || null
        : null;

    appendJobLog(jobId, 'DEEP_ENRICHMENT_V2_REPO_PERSIST_TRY', {
      provider,
      provider_id: providerId,
      lead_row_id: row.id,
    });

    insertLeadEnrichmentSnapshot({
      leadId: row.id,
      jobId: jobId || null,
      provider: provider || null,
      providerId: providerId || null,
      source: 'godmode_repo_v2',
      seo,
      social,
      tech,
      opportunity,
    });

    appendJobLog(jobId, 'DEEP_ENRICHMENT_V2_REPO_PERSIST_OK', {
      provider,
      provider_id: providerId,
      lead_row_id: row.id,
    });
  } catch (e2) {
    appendJobLog(jobId, 'DEEP_ENRICHMENT_V2_REPO_PERSIST_ERROR', {
      provider,
      provider_id: providerId,
      lead_row_id: row.id,
      error: e2 && (e2.message || String(e2)),
    });
    // best-effort: do not fail v1 persist
  }

  return { ok: true, id: row.id };
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
  upsertDeepEnrichmentIntoPotentialLead,
  insertLeadEnrichmentSnapshot,
  getLatestLeadEnrichmentByLeadId,
  insertAiArtifact,
  getLatestAiArtifactByLeadId,
  listAiArtifactsByJobId,
};