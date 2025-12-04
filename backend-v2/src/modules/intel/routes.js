// backend-v2/src/modules/intel/routes.js
const { Router } = require('express');
const {
  analyzeLeadHandler,
  deepAnalyzeLeadHandler
} = require('./controller');

const intelRouter = Router();

/**
 * POST /api/intel/analyze
 * Body: { "leadId": 180 }
 */
intelRouter.post('/analyze', analyzeLeadHandler);

/**
 * POST /api/intel/deep-analyze
 * Body: { "leadId": 180 }
 * Website'e girip çok daha derin analiz yapar.
 */
intelRouter.post('/deep-analyze', deepAnalyzeLeadHandler);

module.exports = { intelRouter };