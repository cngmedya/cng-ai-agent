// backend-v2/src/modules/intel/routes.js
const { Router } = require('express');
const { analyzeLeadHandler } = require('./controller');

const intelRouter = Router();

/**
 * POST /api/intel/analyze
 * Body: { "leadId": 180 }
 */
intelRouter.post('/analyze', analyzeLeadHandler);

module.exports = { intelRouter };