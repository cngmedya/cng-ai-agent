// src/modules/admin/api/routes.js
const express = require('express');
const router = express.Router();

const adminController = require('./controller');

// Şimdilik auth middleware koymuyoruz; sonra RBAC ekleriz.
// Eğer istersen buraya authRequired ekleyebiliriz:
// const authRequired = require('../../../core/middleware/authRequired');

// Sistem durumu
router.get('/status', adminController.getStatus);

// Modül listesi
router.get('/modules', adminController.getModules);

// Genel overview
router.get('/overview', adminController.getOverview);

// Config & feature flags
router.get('/config', adminController.getConfig);

module.exports = {
  adminRouter: router,
};