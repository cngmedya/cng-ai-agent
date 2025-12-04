// backend-v2/src/modules/leadDashboard/routes.js
const { Router } = require('express');
const { leadAiDashboardHandler } = require('./controller');

const leadDashboardRouter = Router();

/**
 * GET /api/leads/:id/ai-dashboard
 */
leadDashboardRouter.get('/:id/ai-dashboard', leadAiDashboardHandler);

module.exports = { leadDashboardRouter };