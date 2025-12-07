// backend-v2/src/modules/godmode/service.js
const os = require('os');
const { v4: uuidv4 } = require('uuid');

/**
 * In-memory job store (v1.x)
 * Faz 2’de sqlite / kalıcı storage’a taşınabilir.
 */
const jobs = new Map();

/**
 * MODE:
 * GODMODE_DISCOVERY_MODE=0  -> MOCK
 * GODMODE_DISCOVERY_MODE=1  -> LIVE (Google Places)
 */
function isLiveDiscoveryMode() {
  const raw = process.env.GODMODE_DISCOVERY_MODE;
  if (!raw) return false; // varsayılan: mock
  return raw === '1' || raw.toLowerCase() === 'live';
}

/**
 * Roadmap / faz durumu
 * (GODMODE_ROADMAP.md ile senkron tutmaya çalışıyoruz)
 */
function getRoadmapPhases() {
  return {
    phase1_core_bootstrap: 'done',    // job modeli, run flow, mock engine
    phase2_data_pipelines: 'pending', // gerçek provider entegrasyonları (Places, LinkedIn vb.)
    phase3_brain_integration: 'pending',
    phase4_automation: 'pending',
  };
}

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
      queued: Array.from(jobs.values()).filter(j => j.status === 'queued').length,
      running: Array.from(jobs.values()).filter(j => j.status === 'running').length,
      completed: Array.from(jobs.values()).filter(j => j.status === 'completed').length,
      failed: Array.from(jobs.values()).filter(j => j.status === 'failed').length,
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

function saveJob(job) {
  jobs.set(job.id, job);
  return job;
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
      minGoogleRating: typeof minGoogleRating === 'number' ? minGoogleRating : 0,
      maxResults: typeof maxResults === 'number' ? maxResults : 250,
      channels: Array.isArray(channels) && channels.length > 0
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

  saveJob(job);
  return job;
}

/**
 * Job status helper’ları (internal)
 */
function markJobRunning(job) {
  job.status = 'running';
  job.progress = job.progress || { percent: 0, found_leads: 0, enriched_leads: 0 };
  job.progress.percent = 0;
  job.updated_at = new Date().toISOString();
  saveJob(job);
}

function markJobCompleted(job) {
  job.status = 'completed';
  job.progress = job.progress || {};
  if (typeof job.progress.percent !== 'number') {
    job.progress.percent = 100;
  }
  job.updated_at = new Date().toISOString();
  saveJob(job);
}

function markJobFailed(job, error) {
  job.status = 'failed';
  job.error = error ? String(error.message || error) : 'unknown error';
  job.updated_at = new Date().toISOString();
  saveJob(job);
}

/**
 * MOCK discovery engine (v1.0.0-mock)
 * Şu anda kullandığımız davranışı koruyor.
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
 * - city + country + categories → Text Search
 * - rating filtresi
 * - maxResults limiti
 *
 * Not: Node 18+ global fetch kullanıyoruz (Node 24 sende zaten var).
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

  // Kategori listesi boşsa “genel firma avı” gibi davranabiliriz.
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

    // 3 sayfaya kadar (Google Places pagination limiti ile uyumlu)
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
        // Örn: OVER_QUERY_LIMIT vs.
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
          location: r.geometry && r.geometry.location ? r.geometry.location : null,
          raw: {
            reference: r.reference,
            url: r.url,
          },
        });
      }

      pageToken = data.next_page_token || null;
      pageCount += 1;

      // next_page_token aktif olması için bekleme gereksinimi var
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

  // Şimdilik sadece google_places
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
  const enrichedLeads = Math.round(foundLeads * 0.7); // Faz 2’de gerçek enrichment bağlanacak

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
    sample_leads: allLeads.slice(0, 20), // Frontend için örnek
  };
}

/**
 * /api/godmode/jobs/:id/run
 * MODE’e göre mock / live engine seçer.
 */
async function runDiscoveryJob(jobId) {
  const job = getJob(jobId);
  if (!job) {
    const err = new Error('JOB_NOT_FOUND');
    err.code = 'JOB_NOT_FOUND';
    throw err;
  }

  if (job.type !== 'discovery_scan') {
    throw new Error(`Bu runner sadece discovery_scan job türü için geçerli (got: ${job.type})`);
  }

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