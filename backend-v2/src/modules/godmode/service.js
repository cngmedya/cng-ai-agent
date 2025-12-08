// backend-v2/src/modules/godmode/service.js

const os = require('os');
const { v4: uuidv4 } = require('uuid');

const {
  loadAllJobs,
  insertJob,
  updateJob,
  getJobById: getJobFromDb,
} = require('./repo');

/**
 * In-memory job store (v1.x) + SQLite sync
 */
const jobs = new Map();

/**
 * MODE:
 * GODMODE_DISCOVERY_MODE=0 -> MOCK
 * GODMODE_DISCOVERY_MODE=1 -> LIVE (Google Places)
 */
function isLiveDiscoveryMode() {
  const raw = process.env.GODMODE_DISCOVERY_MODE;
  if (!raw) return false; // varsayılan: mock
  return raw === '1' || raw.toLowerCase() === 'live';
}

/**
 * Roadmap / faz durumu
 */
function getRoadmapPhases() {
  return {
    phase1_core_bootstrap: 'done', // job modeli, run flow, mock + live engine
    phase2_data_pipelines: 'pending', // multi-provider discovery + enrichment
    phase3_brain_integration: 'pending',
    phase4_automation: 'pending',
  };
}

/**
 * Startup’ta DB’den job’ları hydrate et.
 * Eğer status=running ise auto-recovery: failed olarak işaretle.
 */
(function bootstrapJobsFromDb() {
  try {
    const persisted = loadAllJobs();
    persisted.forEach(job => {
      if (job.status === 'running') {
        job.status = 'failed';
        job.error =
          'Auto-recovery: previous run interrupted, job marked as failed.';
        updateJob(job);
      }
      jobs.set(job.id, job);
    });
  } catch (err) {
    console.error('[GODMODE][BOOTSTRAP] failed to hydrate jobs from db:', err);
  }
})();

/**
 * /api/godmode/status
 */
function getStatus() {
  const phases = getRoadmapPhases();

  return {
    version: 'v1.0.0',
    phases,
    jobs: {
      total: jobs.size,
      queued: Array.from(jobs.values()).filter(j => j.status === 'queued')
        .length,
      running: Array.from(jobs.values()).filter(j => j.status === 'running')
        .length,
      completed: Array.from(jobs.values()).filter(j => j.status === 'completed')
        .length,
      failed: Array.from(jobs.values()).filter(j => j.status === 'failed')
        .length,
    },
    host: {
      hostname: os.hostname(),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Job helper’ları
 */
function getJob(id) {
  return jobs.get(id) || null;
}

function listJobs() {
  return Array.from(jobs.values()).sort((a, b) =>
    (b.created_at || '').localeCompare(a.created_at || ''),
  );
}

/**
 * /api/godmode/jobs/discovery-scan
 * Discovery job create
 */
function createDiscoveryJob(payload) {
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

  if (!city || !country) {
    throw new Error('city ve country alanları zorunludur.');
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  const job = {
    id,
    type: 'discovery_scan',
    label: label || `${city} discovery job`,
    criteria: {
      city,
      country,
      categories: Array.isArray(categories) ? categories : [],
      minGoogleRating:
        typeof minGoogleRating === 'number' ? minGoogleRating : 0,
      maxResults: typeof maxResults === 'number' ? maxResults : 250,
      channels:
        Array.isArray(channels) && channels.length > 0
          ? channels
          : ['google_places'],
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

  // In-memory + DB
  jobs.set(job.id, job);
  insertJob(job);

  return job;
}

/**
 * Job status helper’ları (internal)
 */
function markJobRunning(job) {
  job.status = 'running';
  job.progress =
    job.progress || { percent: 0, found_leads: 0, enriched_leads: 0 };
  job.progress.percent = 0;
  job.updated_at = new Date().toISOString();

  jobs.set(job.id, job);
  updateJob(job);
}

function markJobCompleted(job) {
  job.status = 'completed';
  job.progress = job.progress || {};
  if (typeof job.progress.percent !== 'number') {
    job.progress.percent = 100;
  }
  job.updated_at = new Date().toISOString();

  jobs.set(job.id, job);
  updateJob(job);
}

function markJobFailed(job, error) {
  job.status = 'failed';
  job.error = error ? String(error.message || error) : 'unknown error';
  job.updated_at = new Date().toISOString();

  jobs.set(job.id, job);
  updateJob(job);
}

/**
 * MOCK discovery engine (v1.0.0-mock)
 */
async function runDiscoveryJobMock(job) {
  const { criteria } = job;

  const foundLeads = 150;
  const enrichedLeads = 105;

  job.progress = {
    percent: 100,
    found_leads: foundLeads,
    enriched_leads: enrichedLeads,
  };

  job.result_summary = {
    engine_version: 'v1.0.0-mock',
    notes:
      'Bu sonuçlar şimdilik demo amaçlıdır. Gerçek çok-kaynaklı discovery entegrasyonu Faz 2 OMNI-DATA FEEDER ile bağlanacaktır.',
    criteria_snapshot: criteria,
    stats: {
      found_leads: foundLeads,
      enriched_leads: enrichedLeads,
      providers_used: ['google_places'],
    },
  };
}

/**
 * GOOGLE PLACES discovery (v1.0.0-live)
 */
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function runGooglePlacesDiscovery(criteria) {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY tanımlı değil (.env).');
  }

  const {
    city,
    country,
    categories = [],
    minGoogleRating = 0,
    maxResults = 250,
  } = criteria;

  const leads = [];
  const usedCategories = [];

  const effectiveCategories =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : ['firma'];

  for (const cat of effectiveCategories) {
    if (leads.length >= maxResults) break;
    usedCategories.push(cat);

    const query = `${cat} ${city} ${country}`;
    let pageToken = null;
    let pageCount = 0;

    do {
      const url =
        pageToken == null
          ? `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
              query,
            )}&key=${GOOGLE_PLACES_API_KEY}`
          : `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${GOOGLE_PLACES_API_KEY}`;

      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Google Places API HTTP error: ${resp.status}`);
      }

      const data = await resp.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API status: ${data.status}`);
      }

      const results = data.results || [];
      for (const r of results) {
        if (leads.length >= maxResults) break;

        const rating = typeof r.rating === 'number' ? r.rating : 0;
        if (rating < minGoogleRating) continue;

        leads.push({
          provider: 'google_places',
          place_id: r.place_id,
          name: r.name,
          address: r.formatted_address || null,
          city,
          country,
          rating,
          user_ratings_total: r.user_ratings_total || 0,
          types: r.types || [],
          business_status: r.business_status || null,
          location:
            r.geometry && r.geometry.location ? r.geometry.location : null,
          raw: {
            reference: r.reference,
            url: r.url,
          },
        });
      }

      pageToken = data.next_page_token || null;
      pageCount += 1;

      if (pageToken && leads.length < maxResults) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } while (pageToken && pageCount < 3 && leads.length < maxResults);
  }

  return {
    leads,
    providers_used: ['google_places'],
    used_categories: usedCategories,
  };
}

/**
 * LIVE discovery engine wrapper
 */
async function runDiscoveryJobLive(job) {
  const { criteria } = job;

  const providerResults = [];
  let allLeads = [];

  if (
    criteria.channels &&
    Array.isArray(criteria.channels) &&
    criteria.channels.includes('google_places')
  ) {
    const gp = await runGooglePlacesDiscovery(criteria);
    providerResults.push(gp);
    allLeads = allLeads.concat(gp.leads || []);
  }

  const foundLeads = allLeads.length;
  const enrichedLeads = Math.round(foundLeads * 0.7);

  job.progress = {
    percent: 100,
    found_leads: foundLeads,
    enriched_leads: enrichedLeads,
  };

  job.result_summary = {
    engine_version: 'v1.0.0-live',
    notes:
      'Gerçek Google Places discovery çalıştırıldı. Faz 2’de multi-provider entegrasyon ve otomatik enrichment eklenecek.',
    criteria_snapshot: criteria,
    stats: {
      found_leads: foundLeads,
      enriched_leads: enrichedLeads,
      providers_used: ['google_places'],
    },
    sample_leads: allLeads.slice(0, 20),
  };
}

/**
 * /api/godmode/jobs/:id/run
 */
async function runDiscoveryJob(jobId) {
  const job = getJob(jobId) || getJobFromDb(jobId);

  if (!job) {
    const err = new Error('JOB_NOT_FOUND');
    err.code = 'JOB_NOT_FOUND';
    throw err;
  }

  if (job.type !== 'discovery_scan') {
    throw new Error(
      `Bu runner sadece discovery_scan job türü için geçerli (got: ${job.type})`,
    );
  }

  // cache’e geri yazalım
  jobs.set(job.id, job);

  markJobRunning(job);

  try {
    if (isLiveDiscoveryMode()) {
      await runDiscoveryJobLive(job);
    } else {
      await runDiscoveryJobMock(job);
    }

    markJobCompleted(job);
    return getJob(jobId);
  } catch (err) {
    markJobFailed(job, err);
    throw err;
  }
}

module.exports = {
  getStatus,
  listJobs,
  createDiscoveryJob,
  runDiscoveryJob,
};