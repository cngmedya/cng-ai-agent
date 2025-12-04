// backend-v2/src/modules/research/api/routes.js

const express = require('express');
const router = express.Router();

const {
  fullReportHandler,
  getLatestHandler,
  getAllHandler,
  getHistoryHandler
} = require('../controller/controller');

// CIR Raporu üret
router.post('/full-report', fullReportHandler);

// Son CIR raporu
router.get('/latest/:leadId', getLatestHandler);

// Tüm CIR raporları
router.get('/all/:leadId', getAllHandler);

// CIR History (skor + timestamp listesi)
router.get('/history/:leadId', getHistoryHandler);

module.exports = { researchRouter: router };