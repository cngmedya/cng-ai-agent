// src/modules/admin/repo/adminRepo.js
const db = require('../../../core/db');

function safeCount(table) {
  try {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    return row.count;
  } catch (err) {
    // Tablo yoksa veya başka bir sorun varsa backend'i kırma
    return null;
  }
}

function getDbSnapshot() {
  return {
    leads: safeCount('leads'),
    research_cir: safeCount('research_cir'),
    email_logs: safeCount('email_logs'),
    whatsapp_logs: safeCount('whatsapp_logs'),
    outreach_sequences: safeCount('outreach_sequences'),
    users: safeCount('users'),
  };
}

// Backend-v2 güncel modül state’inizden gelen tablo:
const MODULES = [
  { key: 'discovery',     version: 'v2.x', status: 'ready',        kind: 'core',      description: 'Google Places → lead discovery + AI scoring.' },
  { key: 'intel',         version: 'v5.x', status: 'ready',        kind: 'core',      description: 'Lead dijital intel + SWOT + SEO / UX analiz.' },
  { key: 'research',      version: 'v1.3', status: 'ready',        kind: 'core',      description: 'CIR – derin web/sosyal/ads araştırma & history.' },
  { key: 'crmBrain',      version: 'v1.0', status: 'ready',        kind: 'brain',     description: 'Lead beynı: ai_score_band + CIR özet + sales notes.' },
  { key: 'outreach',      version: 'v1.2', status: 'ready',        kind: 'outreach',  description: 'İlk temas mesajı + sequence generator.' },
  { key: 'leadDashboard', version: 'v1.1', status: 'ready',        kind: 'ui-backend',description: 'Lead AI dashboard API (tek lead görünümü).' },

  { key: 'email',         version: 'v0.1', status: 'stub',         kind: 'channel',   description: 'Email log + future SMTP integration.' },
  { key: 'whatsapp',      version: 'v0.1', status: 'stub',         kind: 'channel',   description: 'WhatsApp log + future Cloud API integration.' },
  { key: 'outreachScheduler', version: 'v0.1', status: 'experimental', kind: 'automation', description: 'Outreach sequence enqueue + future worker.' },

  { key: 'auth',          version: 'v0.1', status: 'ready',        kind: 'infra',     description: 'User register/login (email + password + role).' },
  { key: 'admin',         version: 'v0.1', status: 'ready',        kind: 'infra',     description: 'Bu admin overview API modülü.' },

  { key: 'brain',         version: 'planned', status: 'empty',     kind: 'brain',     description: 'Global Brain – multi-lead & sektör insight.' },
];

function getModuleList() {
  return MODULES;
}

function getConfigSnapshot() {
  return {
    app: {
      name: 'CNG AI Agent Backend V2',
      node_env: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
    },
    flags: {
      OUTREACH_SCHEDULER_ENABLED: true,
      EMAIL_CHANNEL_ENABLED: true,
      WHATSAPP_CHANNEL_ENABLED: true,
    },
    security: {
      AUTH_ENABLED: true,
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
    },
  };
}

module.exports = {
  getDbSnapshot,
  getModuleList,
  getConfigSnapshot,
};