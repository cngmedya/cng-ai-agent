// backend-v2/src/modules/godmode/api/routes.js
const express = require('express');
const {
  getStatusHandler,
  createScanJobHandler,
  listJobsHandler,
  getJobHandler,
} = require('./controller');

const godmodeRouter = express.Router();

godmodeRouter.get('/status', getStatusHandler);

godmodeRouter.post('/scan', createScanJobHandler);

godmodeRouter.get('/jobs', listJobsHandler);

godmodeRouter.get('/jobs/:id', getJobHandler);

module.exports = {
  godmodeRouter,
};