// backend-v2/src/modules/godmode/api/routes.js
const express = require('express');
const router = express.Router();

const {
  getStatus,
  createDiscoveryJob,
  listJobs,
  getJob,
  runJob,
} = require('./controller');

// Status
router.get('/status', getStatus);

// Jobs
router.post('/jobs/discovery-scan', createDiscoveryJob);
router.get('/jobs', listJobs);
router.get('/jobs/:id', getJob);
router.post('/jobs/:id/run', runJob);

module.exports = {
  godmodeRouter: router,
};