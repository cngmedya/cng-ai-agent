// backend-v2/src/modules/whatsapp/routes.js
const express = require('express');
const {
  sendTestWhatsappHandler,
  sendWhatsappForLeadHandler,
  listWhatsappLogsHandler,
} = require('./controller');

const router = express.Router();

router.post('/test', sendTestWhatsappHandler);
router.post('/send-for-lead/:leadId', sendWhatsappForLeadHandler);
router.get('/logs', listWhatsappLogsHandler);

module.exports = {
  whatsappRouter: router,
};