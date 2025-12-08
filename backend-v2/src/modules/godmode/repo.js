// backend-v2/src/modules/godmode/repo.js

const { getDb } = require('../../core/db');

function rowToJob(row) {
  if (!row) return null;

  const criteria = row.criteria_json ? JSON.parse(row.criteria_json) : null;
  const resultSummary = row.result_summary_json
    ? JSON.parse(row.result_summary_json)
    : null;

  const progress = {
    percent: typeof row.percent === 'number' ? row.percent : 0,
    found_leads: typeof row.found_leads === 'number' ? row.found_leads : 0,
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
      LEFT JOIN godmode_job_results r ON r.job_id = j.id
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
      id, type, label, criteria_json, status, created_at, updated_at
    ) VALUES (
      @id, @type, @label, @criteria_json, @status, @created_at, @updated_at
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
      job_id, percent, found_leads, enriched_leads, updated_at
    ) VALUES (
      @job_id, @percent, @found_leads, @enriched_leads, @updated_at
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
        job_id, result_summary_json, updated_at
      ) VALUES (
        @job_id, @result_summary_json, @updated_at
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
 * (Job objesini komple alıyoruz, DB’ye sync ediyoruz.)
 */
function updateJob(job) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `
    UPDATE godmode_jobs
    SET status = @status,
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
      job_id, percent, found_leads, enriched_leads, updated_at
    ) VALUES (
      @job_id, @percent, @found_leads, @enriched_leads, @updated_at
    )
    ON CONFLICT(job_id) DO UPDATE SET
      percent = excluded.percent,
      found_leads = excluded.found_leads,
      enriched_leads = excluded.enriched_leads,
      updated_at = excluded.updated_at
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
        job_id, result_summary_json, updated_at
      ) VALUES (
        @job_id, @result_summary_json, @updated_at
      )
      ON CONFLICT(job_id) DO UPDATE SET
        result_summary_json = excluded.result_summary_json,
        updated_at = excluded.updated_at
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
      LEFT JOIN godmode_job_results r ON r.job_id = j.id
      WHERE j.id = ?
    `,
    )
    .get(id);

  return rowToJob(row);
}

module.exports = {
  loadAllJobs,
  insertJob,
  updateJob,
  getJobById,
};