// backend-v2/src/modules/godmode/api/controller.js

const godmodeService = require('../service');
const { bulkUpsertLeadsFromSummary } = require('../pipeline/discoveryPipeline');

/**
 * GET /api/godmode/status
 */
async function getStatus(req, res) {
  try {
    const status = await godmodeService.getStatus();
    res.json({ ok: true, data: status });
  } catch (err) {
    console.error('[GODMODE][STATUS] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_STATUS_ERROR',
      message: err.message || 'Status alınırken hata oluştu.',
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
 * POST /api/godmode/jobs/discovery-scan
 */
async function createDiscoveryJob(req, res) {
  try {
    const payload = req.body || {};

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

    // Faz 2.B pipeline
    try {
      const summary = job.result_summary;
      if (summary && Array.isArray(summary.sample_leads) && summary.sample_leads.length > 0) {
        const result = bulkUpsertLeadsFromSummary(summary.sample_leads);
        console.log(
          `[GODMODE][PIPELINE] potential_leads upsert tamamlandı. affected=${result.inserted_or_updated}`
        );
      } else {
        console.log('[GODMODE][PIPELINE] sample_leads yok → potential_leads’e yazılacak veri bulunamadı.');
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
  createDiscoveryJob,
  listJobs,
  getJob,
  runJob,
};