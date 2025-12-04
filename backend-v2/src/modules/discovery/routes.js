// backend-v2/src/modules/discovery/routes.js
const { Router } = require('express');
const {
  getHealth,
  getLeads,
  placesSearch,
  rankMissing,
  aiSearchHandler
} = require('./controller');

const discoveryRouter = Router();

discoveryRouter.get('/health', getHealth);
discoveryRouter.get('/leads', getLeads);
discoveryRouter.post('/places-search', placesSearch);
discoveryRouter.post('/ai-rank-missing', rankMissing);

/**
 * Full AI Discovery endpoint
 * POST /api/discovery/ai-search
 */
discoveryRouter.post('/ai-search', aiSearchHandler);

module.exports = { discoveryRouter };