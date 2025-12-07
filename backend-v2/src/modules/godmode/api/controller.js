// backend-v2/src/modules/godmode/api/controller.js
const godmodeService = require('../service');

async function getStatusHandler(req, res) {
  try {
    const status = godmodeService.getGodmodeStatus();
    res.json({ ok: true, data: status });
  } catch (err) {
    console.error('[GODMODE][STATUS] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_STATUS_FAILED',
      message: err.message || 'Godmode status alınırken hata oluştu.',
    });
  }
}

async function createScanJobHandler(req, res) {
  try {
    const payload = req.body || {};

    if (!payload.city && !payload.country && !Array.isArray(payload.categories)) {
      return res.status(400).json({
        ok: false,
        error: 'GODMODE_BAD_REQUEST',
        message: 'En azından city, country veya categories alanlarından biri dolu olmalıdır.',
      });
    }

    const job = godmodeService.createScanJob(payload);

    res.json({
      ok: true,
      data: job,
    });
  } catch (err) {
    console.error('[GODMODE][CREATE_SCAN_JOB] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_CREATE_SCAN_JOB_FAILED',
      message: err.message || 'Scan job oluşturulurken hata oluştu.',
    });
  }
}

async function listJobsHandler(req, res) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const jobs = godmodeService.listJobs(limit);
    res.json({ ok: true, data: jobs });
  } catch (err) {
    console.error('[GODMODE][LIST_JOBS] Error:', err);
    res.status(500).json({
      ok: false,
      error: 'GODMODE_LIST_JOBS_FAILED',
      message: err.message || 'Job listesi alınırken hata oluştu.',
    });
  }
}

async function getJobHandler(req, res) {
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
      error: 'GODMODE_GET_JOB_FAILED',
      message: err.message || 'Job detayı alınırken hata oluştu.',
    });
  }
}

module.exports = {
  getStatusHandler,
  createScanJobHandler,
  listJobsHandler,
  getJobHandler,
};