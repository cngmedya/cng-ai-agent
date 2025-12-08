// backend-v2/src/modules/godmode/repo.js

const { getDb } = require('../../core/db');

/**
 * MIGRATION: godmode_jobs tablosunda 'error' kolonu yoksa ekle
 */
function ensureJobsTableHasErrorColumn() {
  const db = getDb();

  try {
    const cols = db.prepare(`PRAGMA table_info(godmode_jobs)`).all();
    const hasError = cols.some(col => col.name === 'error');

    if (!hasError) {
      db.prepare(`ALTER TABLE godmode_jobs ADD COLUMN error TEXT`).run();
      console.log('[GODMODE][MIGRATION] godmode_jobs.error kolonu eklendi.');
    }
  } catch (err) {
    // Tablo yoksa ya da başka bir sebeple migration çalışamazsa
    // server’ı düşürmeyelim; sadece log atalım.
    console.warn(
      '[GODMODE][MIGRATION] error column migration atlanıyor:',
      err.message || err,
    );
  }
}

/**
 * JOB EVENT LOG TABLE: godmode_job_logs
 */
function ensureJobLogTable() {
  const db = getDb();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS godmode_job_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL
    )
  `,
  ).run();
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_job_logs_job_id
    ON godmode_job_logs(job_id)
  `,
  ).run();
}

// Modül yüklendiğinde migration + log tablosunu garanti altına al
ensureJobsTableHasErrorColumn();
ensureJobLogTable();

/**
 * INTERNAL: Job satırını domain job objesine map eder
 */
function mapRowToJob(row) {
  if (!row) return null;

  let criteria = {};
  let resultSummary = null;

  try {
    criteria = row.criteria_json ? JSON.parse(row.criteria_json) : {};
  } catch {
    criteria = {};
  }

  try {
    resultSummary = row.result_summary_json
      ? JSON.parse(row.result_summary_json)
      : null;
  } catch {
    resultSummary = null;
  }

  return {
    id: row.id,
    type: row.type,
    label: row.label,
    criteria,
    status: row.status,
    progress: {
      percent: row.progress_percent || 0,
      found_leads: row.found_leads || 0,
      enriched_leads: row.enriched_leads || 0,
    },
    result_summary: resultSummary,
    created_at: row.created_at,
    updated_at: row.updated_at,
    error: row.error || null,
  };
}

/**
 * JOB CRUD
 */

function insertJob(job) {
  const db = getDb();

  const progress = job.progress || {};
  const resultSummaryJson = job.result_summary
    ? JSON.stringify(job.result_summary)
    : null;

  db.prepare(
    `
    INSERT INTO godmode_jobs (
      id,
      type,
      label,
      criteria_json,
      status,
      progress_percent,
      found_leads,
      enriched_leads,
      result_summary_json,
      error,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @type,
      @label,
      @criteria_json,
      @status,
      @progress_percent,
      @found_leads,
      @enriched_leads,
      @result_summary_json,
      @error,
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
    progress_percent:
      typeof progress.percent === 'number' ? progress.percent : 0,
    found_leads:
      typeof progress.found_leads === 'number' ? progress.found_leads : 0,
    enriched_leads:
      typeof progress.enriched_leads === 'number'
        ? progress.enriched_leads
        : 0,
    result_summary_json: resultSummaryJson,
    error: job.error || null,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });

  return job;
}

function updateJob(job) {
  const db = getDb();

  const progress = job.progress || {};
  const resultSummaryJson = job.result_summary
    ? JSON.stringify(job.result_summary)
    : null;

  db.prepare(
    `
    UPDATE godmode_jobs
    SET
      type = @type,
      label = @label,
      criteria_json = @criteria_json,
      status = @status,
      progress_percent = @progress_percent,
      found_leads = @found_leads,
      enriched_leads = @enriched_leads,
      result_summary_json = @result_summary_json,
      error = @error,
      updated_at = @updated_at
    WHERE id = @id
  `,
  ).run({
    id: job.id,
    type: job.type,
    label: job.label || null,
    criteria_json: JSON.stringify(job.criteria || {}),
    status: job.status,
    progress_percent:
      typeof progress.percent === 'number' ? progress.percent : 0,
    found_leads:
      typeof progress.found_leads === 'number' ? progress.found_leads : 0,
    enriched_leads:
      typeof progress.enriched_leads === 'number'
        ? progress.enriched_leads
        : 0,
    result_summary_json: resultSummaryJson,
    error: job.error || null,
    updated_at: job.updated_at,
  });

  return job;
}

function loadAllJobs() {
  const db = getDb();

  const rows = db
    .prepare(
      `
      SELECT
        id,
        type,
        label,
        criteria_json,
        status,
        progress_percent,
        found_leads,
        enriched_leads,
        result_summary_json,
        error,
        created_at,
        updated_at
      FROM godmode_jobs
      ORDER BY created_at DESC
    `,
    )
    .all();

  return rows.map(mapRowToJob);
}

function getJobById(id) {
  const db = getDb();

  const row = db
    .prepare(
      `
      SELECT
        id,
        type,
        label,
        criteria_json,
        status,
        progress_percent,
        found_leads,
        enriched_leads,
        result_summary_json,
        error,
        created_at,
        updated_at
      FROM godmode_jobs
      WHERE id = ?
    `,
    )
    .get(id);

  return row ? mapRowToJob(row) : null;
}

/**
 * JOB EVENT LOG SYSTEM (Faz 1.G — godmode_job_logs)
 */

function appendJobLog(jobId, eventType, payload) {
  const db = getDb();

  const createdAt = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO godmode_job_logs (
      job_id,
      event_type,
      payload_json,
      created_at
    ) VALUES (
      @job_id,
      @event_type,
      @payload_json,
      @created_at
    )
  `,
  ).run({
    job_id: jobId,
    event_type: eventType,
    payload_json:
      payload === undefined || payload === null
        ? null
        : JSON.stringify(payload),
    created_at: createdAt,
  });
}

function getJobLogs(jobId) {
  const db = getDb();

  const rows = db
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

  return rows.map(row => ({
    id: row.id,
    job_id: row.job_id,
    event_type: row.event_type,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    created_at: row.created_at,
  }));
}

module.exports = {
  insertJob,
  updateJob,
  loadAllJobs,
  getJobById,
  appendJobLog,
  getJobLogs,
};