const { Router } = require('express');
const {
  sendTestWhatsappHandler,
  sendWhatsappForLeadHandler,
} = require('./controller');

const whatsappRouter = Router();

whatsappRouter.post('/test', sendTestWhatsappHandler);
whatsappRouter.post('/send-for-lead/:leadId', sendWhatsappForLeadHandler);

module.exports = { whatsappRouter };