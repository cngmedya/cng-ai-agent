const express = require('express');
const router = express.Router();

const {
  pingBrain,
  getLeadBrainHandler,
  getLeadBrainSummaryHandler,
} = require('./controller');

router.get('/ping', pingBrain);
router.get('/lead/:leadId', getLeadBrainHandler);
router.get('/lead/:leadId/summary', getLeadBrainSummaryHandler);

module.exports = {
  brainRouter: router,
};