// backend-v2/src/modules/godmode/service.js
const { randomUUID } = require('crypto');

const GODMODE_VERSION = 'v1.0.0';

// In-memory job store (v1.0 — henüz kalıcı DB yok)
const jobs = [];

/**
 * Godmode genel durum / health
 */
function getGodmodeStatus() {
  const totalJobs = jobs.length;
  const queued = jobs.filter(j => j.status === 'queued').length;
  const running = jobs.filter(j => j.status === 'running').length;
  const completed = jobs.filter(j => j.status === 'completed').length;
  const failed = jobs.filter(j => j.status === 'failed').length;

  return {
    version: GODMODE_VERSION,
    phases: {
      phase1_core_bootstrap: 'done',
      phase2_data_pipelines: 'pending',
      phase3_brain_integration: 'pending',
      phase4_automation: 'pending',
    },
    jobs: {
      total: totalJobs,
      queued,
      running,
      completed,
      failed,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Yeni bir discovery / hunting job oluşturur.
 * v1.0'da sadece in-memory queue, gerçek worker entegrasyonu sonraki fazda.
 */
function createScanJob(payload) {
  const {
    label,
    city,
    country,
    categories,
    minGoogleRating,
    maxResults,
    channels,
    notes,
  } = payload || {};

  const id = randomUUID();
  const now = new Date().toISOString();

  const job = {
    id,
    type: 'discovery_scan',
    label: label || `Scan ${city || ''} ${categories?.join(', ') || ''}`.trim(),
    criteria: {
      city: city || null,
      country: country || null,
      categories: Array.isArray(categories) ? categories : [],
      minGoogleRating: typeof minGoogleRating === 'number' ? minGoogleRating : null,
      maxResults: typeof maxResults === 'number' ? maxResults : 100,
      channels: Array.isArray(channels) ? channels : ['google_places'],
      notes: notes || null,
    },
    status: 'queued',
    progress: {
      percent: 0,
      found_leads: 0,
      enriched_leads: 0,
    },
    result_summary: null,
    created_at: now,
    updated_at: now,
  };

  jobs.push(job);
  return job;
}

/**
 * Job listesi (basit, sayfa yok – v1.0)
 */
function listJobs(limit = 20) {
  const n = typeof limit === 'number' && limit > 0 ? limit : 20;
  return jobs
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, n);
}

/**
 * Tek bir job detayını getirir
 */
function getJobById(id) {
  return jobs.find(j => j.id === id) || null;
}

/**
 * Demo için job durumunu simulate eden basit helper
 * v1.0: sadece status ve progress'i update ediyoruz.
 */
function simulateJobProgress(id, patch) {
  const job = jobs.find(j => j.id === id);
  if (!job) return null;

  job.status = patch.status || job.status;
  job.progress = {
    ...job.progress,
    ...patch.progress,
  };
  job.result_summary = patch.result_summary || job.result_summary;
  job.updated_at = new Date().toISOString();

  return job;
}

module.exports = {
  getGodmodeStatus,
  createScanJob,
  listJobs,
  getJobById,
  simulateJobProgress,
};