const { Router } = require('express');
const { enqueueOutreachSequenceHandler } = require('./controller');

const outreachSchedulerRouter = Router();

outreachSchedulerRouter.post('/enqueue/:leadId', enqueueOutreachSequenceHandler);

module.exports = { outreachSchedulerRouter };