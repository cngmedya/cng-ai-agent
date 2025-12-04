// backend-v2/src/modules/outreach/routes.js
const { Router } = require('express');
const { firstContactHandler } = require('./controller');

const outreachRouter = Router();

/**
 * POST /api/outreach/first-contact
 * Body:
 * {
 *   "leadId": 180,
 *   "channel": "whatsapp" | "email" | "instagram_dm",
 *   "tone": "premium" | "samimi" | "kurumsal",
 *   "language": "tr" | "en"
 * }
 */
outreachRouter.post('/first-contact', firstContactHandler);

module.exports = { outreachRouter };