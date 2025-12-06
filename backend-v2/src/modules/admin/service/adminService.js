// backend-v2/src/modules/admin/service/adminService.js
const os = require('os');
const packageJson = require('../../../../package.json');

/**
 * Sistem / runtime durumu
 */
function getSystemStatus() {
  return {
    app: {
      name: 'cng-ai-agent-backend-v2',
      version: packageJson.version,
      env: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '4000',
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
    },
    node: {
      version: process.version,
      platform: process.platform,
      pid: process.pid,
    },
    host: {
      hostname: os.hostname(),
      loadavg: os.loadavg(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
    },
    memory: process.memoryUsage(),
  };
}

/**
 * Modül versiyon / durum tablosu (objektif kaynak)
 */
function getModuleStatus() {
  return {
    discovery: 'v2.x — OK',
    intel: 'v5.x — OK',
    research: 'v1.3 — OK',
    crm: 'v1.0 — OK',
    leadDashboard: 'v1.1 — OK',
    outreach: 'v2.0 — OK',
    outreachScheduler: 'v0.1 — OK',
    email: 'v0.1 — OK',
    whatsapp: 'v0.1 — OK',
    auth: 'v1.0 — OK',
    admin: 'v1.0 — OK',
    brain: 'pending',
  };
}

/**
 * /api/admin/modules → array formatında dönüş
 */
function getAdminModules() {
  const modules = getModuleStatus();
  return Object.entries(modules).map(([key, status]) => ({
    key,
    status,
  }));
}

/**
 * /api/admin/config → env + feature flags
 */
function getAdminConfig() {
  return {
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '4000',
      OPENAI_MODEL: process.env.OPENAI_MODEL || null,
      GOOGLE_PLACES_ENABLED: process.env.GOOGLE_PLACES_ENABLED || 'false',
    },
    feature_flags: {
      outreachScheduler: true,
      crmBrain: true,
      emailLogging: true,
      whatsappLogging: true,
    },
  };
}

/**
 * /api/admin/overview → sistem + modüller + db health (şimdilik stub)
 */
function getAdminOverview() {
  return {
    system: getSystemStatus(),
    modules: getModuleStatus(),
    // İleride gerçek health check ekleriz; şimdilik stub
    db: {
      ok: false,
      error: 'db health check not implemented',
    },
  };
}

module.exports = {
  getSystemStatus,
  getModuleStatus,
  getAdminModules,
  getAdminConfig,
  getAdminOverview,
};