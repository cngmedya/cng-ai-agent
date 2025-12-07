// backend-v2/src/modules/godmode/workers/dataFeederWorker.js
const godmodeService = require('../service');

/**
 * Şimdilik v1: MOCK DISCOVERY RUNNER
 *
 * - Job'ı running → completed'e geçirir
 * - Kriterlere göre "fake" istatistik üretir
 * - Gerçek tarama / discovery modülleri Faz 2.x'te bağlanacak
 */

function estimateLeadCounts(criteria) {
  const base = criteria?.categories?.length || 1;
  const maxResults = criteria?.maxResults || 100;

  // Basit bir tahmin heuristiği (mock)
  const found = Math.min(maxResults, base * 50);
  const enriched = Math.round(found * 0.7);

  return { found, enriched };
}

async function runDiscoveryJob(jobId) {
  const job = godmodeService.getJobById(jobId);
  if (!job) {
    throw new Error('Job bulunamadı.');
  }
  if (job.type !== 'discovery_scan') {
    throw new Error('Sadece discovery_scan tipindeki job çalıştırılabilir.');
  }
  if (job.status === 'running') {
    throw new Error('Job zaten running durumda.');
  }
  if (job.status === 'completed') {
    throw new Error('Job zaten completed.');
  }

  // 1) running'e al
  godmodeService.setJobRunning(jobId);

  // 2) Şimdilik "instant" mock çalıştırma (bloklamıyor çünkü küçük iş)
  const { found, enriched } = estimateLeadCounts(job.criteria);

  const resultSummary = {
    engine_version: 'v1.0.0-mock',
    notes:
      'Bu sonuçlar şimdilik demo amaçlıdır. Gerçek çok-kaynaklı discovery entegrasyonu Faz 2 OMNI-DATA FEEDER ile bağlanacaktır.',
    criteria_snapshot: job.criteria,
    stats: {
      found_leads: found,
      enriched_leads: enriched,
      providers_used: job.criteria.channels || ['google_places'],
    },
  };

  const updated = godmodeService.setJobCompleted(
    jobId,
    {
      found_leads: found,
      enriched_leads: enriched,
    },
    resultSummary,
  );

  return updated;
}

module.exports = {
  runDiscoveryJob,
};