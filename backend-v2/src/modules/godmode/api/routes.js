// backend-v2/src/modules/godmode/api/routes.js
const express = require('express');
const router = express.Router();

const {
  getStatus,
  getProvidersHealth,
  createDiscoveryJob,
  listJobs,
  getJob,
  runJob,
  getJobLogs,
  getDeepEnrichmentLogs,
} = require('./controller');

// Status
router.get('/status', getStatus);
router.get('/providers/health', getProvidersHealth);

// Jobs
router.post('/jobs/discovery-scan', createDiscoveryJob);
router.get('/jobs', listJobs);
router.get('/jobs/:id', getJob);
router.get('/jobs/:id/logs', getJobLogs);
router.get('/jobs/:id/logs/deep-enrichment', getDeepEnrichmentLogs);
router.post('/jobs/:id/run', runJob);

module.exports = {
  godmodeRouter: router,
};