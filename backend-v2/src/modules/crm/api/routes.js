// src/modules/crm/api/routes.js

const express = require('express');
const router = express.Router();

const { getLeadBrainHandler } = require('./controller');  
// controller.js ile aynı klasördeyiz → ./controller DOĞRU YOL

router.get('/lead-brain/:leadId', getLeadBrainHandler);

module.exports = { crmRouter: router };