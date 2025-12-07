// backend-v2/src/modules/outreachScheduler/routes.js
const express = require('express');
const { enqueueOutreachSequenceHandler } = require('./controller');

const outreachSchedulerRouter = express.Router({ mergeParams: true });

outreachSchedulerRouter.post('/enqueue/:leadId', enqueueOutreachSequenceHandler);

module.exports = {
  outreachSchedulerRouter,
};