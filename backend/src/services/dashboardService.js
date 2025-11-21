// backend/src/services/dashboardService.js

const path = require("path");
const Database = require("better-sqlite3");
const { log } = require("../lib/logger");

// Aynı CRM veritabanını kullanıyoruz
const dbFile = path.join(__dirname, "..", "data", "crm.sqlite");
const db = new Database(dbFile);

log.info("[Dashboard] Dashboard service veritabanı bağlı:", dbFile);

function getSummary() {
  // ---- LEADS ----
  let totalLeads = 0;
  let leadsToday = 0;

  try {
    totalLeads = db.prepare("SELECT COUNT(*) AS c FROM leads").get().c || 0;

    leadsToday = db
      .prepare(
        "SELECT COUNT(*) AS c FROM leads WHERE DATE(created_at) = DATE('now','localtime')"
      )
      .get().c || 0;
  } catch (err) {
    log.error("[Dashboard] leads query error:", err);
  }

  // ---- CAMPAIGNS ----
  let totalCampaigns = 0;
  let campaignsLast7 = 0;
  let campaignTypeDistribution = [];

  try {
    totalCampaigns =
      db.prepare("SELECT COUNT(*) AS c FROM campaigns").get().c || 0;

    campaignsLast7 =
      db
        .prepare(
          "SELECT COUNT(*) AS c FROM campaigns WHERE created_at >= DATETIME('now','-7 days')"
        )
        .get().c || 0;

    campaignTypeDistribution = db
      .prepare(
        "SELECT type, COUNT(*) AS count FROM campaigns GROUP BY type"
      )
      .all();
  } catch (err) {
    log.error("[Dashboard] campaigns query error:", err);
  }

  // ---- ACTIONS ----
  let pendingActions = 0;
  let completedActions = 0;
  let channelBreakdown = [];
  let nextActions = [];

  try {
    pendingActions =
      db
        .prepare(
          "SELECT COUNT(*) AS c FROM campaign_actions WHERE status = 'pending'"
        )
        .get().c || 0;

    completedActions =
      db
        .prepare(
          "SELECT COUNT(*) AS c FROM campaign_actions WHERE status = 'completed'"
        )
        .get().c || 0;

    channelBreakdown = db
      .prepare(
        "SELECT channel, COUNT(*) AS count FROM campaign_actions GROUP BY channel"
      )
      .all();

    nextActions = db
      .prepare(
        `SELECT id, campaign_id, action_type, channel, status, created_at, scheduled_at
         FROM campaign_actions
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT 5`
      )
      .all();
  } catch (err) {
    log.error("[Dashboard] actions query error:", err);
  }

  return {
    leads: {
      totalLeads,
      leadsToday,
      // ileride geliştirilebilir alanlar:
      // sectorDistribution, avgLeadScore, vs.
    },
    campaigns: {
      totalCampaigns,
      campaignsLast7,
      campaignTypeDistribution,
    },
    actions: {
      pendingActions,
      completedActions,
      channelBreakdown,
      nextActions,
    },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getSummary,
};