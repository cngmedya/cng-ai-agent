const godmodeService = require('../service');
const { bulkUpsertLeadsFromSummary } = require('../pipeline/discoveryPipeline');
const godmodeRepo = require('../repo');

/**
 * GET /api/godmode/status
 */
async function getStatus(req, res) {
  try {
    const startedAt = Date.now();

    const status = await Promise.race([
      godmodeService.getStatus(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GODMODE_STATUS_TIMEOUT')), 1500),
      ),
    ]);

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > 1400) {
      console.warn('[GODMODE][STATUS] slow response', { elapsedMs });
    }

    const deepEnrichment = {
      enabled: process.env.GODMODE_DEEP_ENRICHMENT === '1',
      sources: (process.env.GODMODE_DEEP_ENRICHMENT_SOURCES || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      collect_ids: process.env.GODMODE_DEEP_ENRICHMENT_COLLECT_IDS === '1',
    };

    res.json({ ok: true, data: { ...status, deep_enrichment: deepEnrichment } });
  } catch (err) {
    if (err && err.message === 'GODMODE_STATUS_TIMEOUT') {
      const deepEnrichment = {
        enabled: process.env.GODMODE_DEEP_ENRICHMENT === '1',
        sources: (process.env.GODMODE_DEEP_ENRICHMENT_SOURCES || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        collect_ids: process.env.GODMODE_DEEP_ENRICHMENT_COLLECT_IDS === '1',
      };

      return res.json({
        ok: true,
        data: {
          healthy: false,
          error: 'GODMODE_STATUS_TIMEOUT',
          message: 'godmodeService.getStatus() 1500ms içinde dönmedi.',
          deep_enrichment: deepEnrichment,
        },
      });
    }
    console.error('[GODMODE][STATUS] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_STATUS_ERROR',
      message: err.message || 'Status alınırken hata oluştu.',
    });
  }
}

/**
 * GET /api/godmode/providers/health
 */
async function getProvidersHealth(req, res) {
  try {
    const snapshot = await godmodeService.getProvidersHealth();
    res.json({ ok: true, data: snapshot });
  } catch (err) {
    console.error('[GODMODE][PROVIDERS_HEALTH] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_PROVIDERS_HEALTH_ERROR',
      message: err.message || 'Provider health alınırken hata oluştu.',
    });
  }
}

/**
 * GET /api/godmode/jobs
 */
async function listJobs(req, res) {
  try {
    const jobs = await godmodeService.listJobs();
    res.json({ ok: true, data: jobs });
  } catch (err) {
    console.error('[GODMODE][LIST_JOBS] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_LIST_JOBS_ERROR',
      message: err.message || 'Job listesi alınırken hata oluştu.',
    });
  }
}

/**
 * GET /api/godmode/jobs/:id
 */
async function getJob(req, res) {
  const { id } = req.params;

  try {
    const job = await godmodeService.getJobById(id);
    if (!job) {
      return res.status(404).json({
        ok: false,
        error: 'GODMODE_JOB_NOT_FOUND',
        message: 'İstenen GODMODE job kaydı bulunamadı.',
      });
    }

    res.json({ ok: true, data: job });
  } catch (err) {
    console.error('[GODMODE][GET_JOB] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_GET_JOB_ERROR',
      message: err.message || 'Job detayları alınırken hata oluştu.',
    });
  }
}

/**
 * GET /api/godmode/jobs/:id/logs
 */
async function getJobLogs(req, res) {
  const { id } = req.params;

  try {
    const logs = await godmodeRepo.getJobLogs(id);
    res.json({ ok: true, data: logs });
  } catch (err) {
    console.error('[GODMODE][GET_JOB_LOGS] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_GET_JOB_LOGS_ERROR',
      message: err.message || 'Job logları alınırken hata oluştu.',
    });
  }
}

/**
 * GET /api/godmode/jobs/:id/logs/deep-enrichment
 */
async function getDeepEnrichmentLogs(req, res) {
  const { id } = req.params;

  try {
    const logs = await godmodeRepo.getDeepEnrichmentLogs(id);
    res.json({ ok: true, data: logs });
  } catch (err) {
    console.error('[GODMODE][GET_DEEP_ENRICHMENT_LOGS] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_GET_DEEP_ENRICHMENT_LOGS_ERROR',
      message: err.message || 'Deep enrichment logları alınırken hata oluştu.',
    });
  }
}

/**
 * POST /api/godmode/jobs/discovery-scan
 */
async function createDiscoveryJob(req, res) {
  try {
    const raw = req.body || {};
    const payload =
      raw.criteria && typeof raw.criteria === 'object' && !Array.isArray(raw.criteria)
        ? raw.criteria
        : raw;

    const job = await godmodeService.createDiscoveryScanJob(payload);

    res.status(201).json({
      ok: true,
      data: job,
    });
  } catch (err) {
    console.error('[GODMODE][CREATE_DISCOVERY_JOB] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_CREATE_JOB_ERROR',
      message: err.message || 'Discovery job oluşturulurken hata oluştu.',
    });
  }
}

/**
 * POST /api/godmode/jobs/:id/run
 *
 * Job’ı çalıştırır, provider’lardan discovery yapar ve
 * summary.sample_leads içindeki lead'leri potential_leads'e yazar.
 */
async function runJob(req, res) {
  const { id } = req.params;

  try {
    const job = await godmodeService.runJob(id);

    if (!job) {
      return res.status(404).json({
        ok: false,
        error: 'GODMODE_JOB_NOT_FOUND',
        message: 'Çalıştırılmak istenen GODMODE job kaydı bulunamadı.',
      });
    }

    // Faz 2.C.4 pipeline: Prefer top_ranked_sample, fallback to sample_leads
    try {
      const summary = job.result_summary;

      const leadsToPersist =
        summary &&
        Array.isArray(summary.top_ranked_sample) &&
        summary.top_ranked_sample.length > 0
          ? summary.top_ranked_sample
          : summary && Array.isArray(summary.sample_leads)
            ? summary.sample_leads
            : [];

      if (Array.isArray(leadsToPersist) && leadsToPersist.length > 0) {
        const result = bulkUpsertLeadsFromSummary(leadsToPersist);

        console.log(
          `[GODMODE][PIPELINE] potential_leads upsert tamamlandı. source=${(summary && Array.isArray(summary.top_ranked_sample) && summary.top_ranked_sample.length > 0) ? 'top_ranked_sample' : 'sample_leads'} affected=${result.affected_rows} skipped_enrichment_rows=${result.skipped_enrichment_rows}`
        );
      } else {
        console.log('[GODMODE][PIPELINE] lead listesi yok → potential_leads’e yazılacak veri bulunamadı.');
      }
    } catch (pipelineErr) {
      console.error('[GODMODE][PIPELINE] Hata:', pipelineErr);
    }

    res.json({
      ok: true,
      data: job,
    });
  } catch (err) {
    console.error('[GODMODE][RUN_JOB] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_RUN_JOB_ERROR',
      message: err.message || 'GODMODE job çalıştırılırken hata oluştu.',
    });
  }
}

module.exports = {
  getStatus,
  getProvidersHealth,
  createDiscoveryJob,
  listJobs,
  getJob,
  runJob,
  getJobLogs,
  getDeepEnrichmentLogs,
};