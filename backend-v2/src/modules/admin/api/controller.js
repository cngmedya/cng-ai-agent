// src/modules/admin/api/controller.js
const adminService = require('../service/adminService');

async function getStatus(req, res, next) {
  try {
    const data = adminService.getSystemStatus();
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

async function getModules(req, res, next) {
  try {
    const data = await adminService.getAdminModules();
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

async function getOverview(req, res, next) {
  try {
    const data = await adminService.getAdminOverview();
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

async function getConfig(req, res, next) {
  try {
    const data = await adminService.getAdminConfig();
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatus,
  getModules,
  getOverview,
  getConfig,
};