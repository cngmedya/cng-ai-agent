const { Router } = require('express');
const { sendTestEmailHandler, sendLeadEmailHandler } = require('./controller');

const emailRouter = Router();

emailRouter.post('/test', sendTestEmailHandler);
emailRouter.post('/send-for-lead/:leadId', sendLeadEmailHandler);

module.exports = { emailRouter };