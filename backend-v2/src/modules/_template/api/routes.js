const express = require('express');
const router = express.Router();

const controller = require('./controller');

// Basit health check
router.get('/ping', controller.ping);

// Echo endpoint (debug / playground)
router.get('/echo', controller.echo);

module.exports = {
  templateRouter: router,
};
