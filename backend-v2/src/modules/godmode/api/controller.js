// backend-v2/src/modules/godmode/api/controller.js
const godmodeService = require('../service');

/**
 * GET /api/godmode/status
 */
function getStatus(req, res) {
  try {
    const data = godmodeService.getStatus();
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[GODMODE][STATUS] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_STATUS_ERROR',
      message: err.message || 'Godmode status alınırken hata oluştu.',
    });
  }
}

/**
 * POST /api/godmode/jobs/discovery-scan
 */
function createDiscoveryJob(req, res) {
  try {
    const job = godmodeService.createDiscoveryJob(req.body || {});
    res.json({ ok: true, data: job });
  } catch (err) {
    console.error('[GODMODE][CREATE_JOB] Error:', err);
    res.status(400).json({
      ok: false,
      error: 'GODMODE_CREATE_JOB_ERROR',
      message: err.message || 'Discovery job oluşturulurken hata oluştu.',
    });
  }
}

/**
 * GET /api/godmode/jobs
 */
function listJobs(req, res) {
  try {
    const items = godmodeService.listJobs();
    res.json({ ok: true, data: items });
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
function getJob(req, res) {
  try {
    const { id } = req.params;
    const job = godmodeService.getJobById(id);

    if (!job) {
      return res.status(404).json({
        ok: false,
        error: 'GODMODE_JOB_NOT_FOUND',
        message: 'İstenen job bulunamadı.',
      });
    }

    res.json({ ok: true, data: job });
  } catch (err) {
    console.error('[GODMODE][GET_JOB] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_GET_JOB_ERROR',
      message: err.message || 'Job detayı alınırken hata oluştu.',
    });
  }
}

/**
 * POST /api/godmode/jobs/:id/run
 */
async function runJob(req, res) {
  try {
    const { id } = req.params;
    const job = await godmodeService.runDiscoveryJob(id);
    res.json({ ok: true, data: job });
  } catch (err) {
    console.error('[GODMODE][RUN_JOB] Error:', err);
    const status = err.code === 'JOB_NOT_FOUND' ? 404 : 500;

    res.status(status).json({
      ok: false,
      error: 'GODMODE_RUN_JOB_ERROR',
      message: err.message || 'Job çalıştırılırken hata oluştu.',
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