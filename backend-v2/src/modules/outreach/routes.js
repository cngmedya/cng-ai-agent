// backend-v2/src/modules/outreach/routes.js
const { Router } = require('express');
const {
  firstContactHandler,
  outreachSequenceHandler
} = require('./controller');

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

/**
 * POST /api/outreach/sequence/:leadId
 * Body:
 * {
 *   "channel": "whatsapp" | "email" | "instagram_dm",
 *   "tone": "premium" | "samimi" | "kurumsal",
 *   "language": "tr" | "en",
 *   "objective": "ilk_temas" | "yeniden_aktivasyon" | "teklif_sonrası_takip",
 *   "max_followups": 0-3
 * }
 */
outreachRouter.post('/sequence/:leadId', outreachSequenceHandler);

module.exports = { outreachRouter };