// backend/src/services/campaignService.js

const path = require("path");
const Database = require("better-sqlite3");
const { log } = require("../lib/logger");

// Aynı CRM veritabanını kullanıyoruz
const dbFile = path.join(__dirname, "..", "data", "crm.sqlite");
const db = new Database(dbFile);

// TABLOLAR
db.exec(`
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,              -- seo | ads | social | outreach | support | mixed
  lead_id INTEGER,                 -- opsiyonel: varsa leads tablosuna referans
  sector TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | active | paused | completed
  meta_json TEXT,                  -- strateji, notlar, extra config
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS campaign_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  campaign_id INTEGER NOT NULL,
  channel TEXT NOT NULL,           -- whatsapp | email | ads_google | ads_meta | social | internal
  action_type TEXT NOT NULL,       -- send_message | launch_ad | schedule_call | generate_doc | note
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | done | failed
  scheduled_at TEXT,               -- null ise hemen
  executed_at TEXT,
  payload_json TEXT,               -- hedef, mesaj, kreatif vs.
  result_json TEXT,                -- execution sonucu / log
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
`);

log.info("[Campaigns] Campaign & actions tabloları hazır:", dbFile);

function nowIso() {
  return new Date().toISOString();
}

// Hazır statement'lar
const insertCampaignStmt = db.prepare(`
  INSERT INTO campaigns (
    created_at,
    updated_at,
    name,
    type,
    lead_id,
    sector,
    location,
    status,
    meta_json
  ) VALUES (
    @created_at,
    @updated_at,
    @name,
    @type,
    @lead_id,
    @sector,
    @location,
    @status,
    @meta_json
  )
`);

const updateCampaignStatusStmt = db.prepare(`
  UPDATE campaigns
  SET status = @status,
      updated_at = @updated_at
  WHERE id = @id
`);

const getCampaignByIdStmt = db.prepare(`
  SELECT *
  FROM campaigns
  WHERE id = ?
`);

const listCampaignsBaseSql = `
  SELECT *
  FROM campaigns
`;

const insertActionStmt = db.prepare(`
  INSERT INTO campaign_actions (
    created_at,
    updated_at,
    campaign_id,
    channel,
    action_type,
    status,
    scheduled_at,
    payload_json,
    result_json
  ) VALUES (
    @created_at,
    @updated_at,
    @campaign_id,
    @channel,
    @action_type,
    @status,
    @scheduled_at,
    @payload_json,
    @result_json
  )
`);

const updateActionStatusStmt = db.prepare(`
  UPDATE campaign_actions
  SET status = @status,
      updated_at = @updated_at,
      executed_at = @executed_at,
      result_json = @result_json
  WHERE id = @id
`);

const getActionByIdStmt = db.prepare(`
  SELECT *
  FROM campaign_actions
  WHERE id = ?
`);

const listActionsByCampaignStmt = db.prepare(`
  SELECT *
  FROM campaign_actions
  WHERE campaign_id = ?
  ORDER BY created_at ASC
`);

const findPendingActionsStmt = db.prepare(`
  SELECT *
  FROM campaign_actions
  WHERE status = 'pending'
    AND (scheduled_at IS NULL OR scheduled_at <= @now)
  ORDER BY created_at ASC
  LIMIT @limit
`);

// -------------------------------------------------------------
// PUBLIC API
// -------------------------------------------------------------

/**
 * Yeni campaign oluşturur.
 *  - opsiyonel olarak belirli bir lead'e bağlı olabilir
 */
function createCampaign({
  name,
  type,
  leadId = null,
  sector = null,
  location = null,
  status = "draft",
  meta = null,
}) {
  const now = nowIso();

  const data = {
    created_at: now,
    updated_at: now,
    name,
    type,
    lead_id: leadId,
    sector,
    location,
    status,
    meta_json: meta ? JSON.stringify(meta) : null,
  };

  const result = insertCampaignStmt.run(data);
  const id = result.lastInsertRowid;

  log.info(`[Campaigns] Yeni campaign oluşturuldu #${id} (${name})`);

  return {
    id,
    ...data,
  };
}

/**
 * Campaign status güncelle
 */
function updateCampaignStatus({ id, status }) {
  const now = nowIso();

  const result = updateCampaignStatusStmt.run({
    id,
    status,
    updated_at: now,
  });

  if (result.changes === 0) return null;

  const updated = getCampaignByIdStmt.get(id);
  log.info(`[Campaigns] Campaign #${id} status güncellendi: ${status}`);
  return updated;
}

/**
 * Campaign listesi – filtre + sayfalama
 */
function listCampaigns({ page = 1, pageSize = 20, status, type } = {}) {
  const offset = (page - 1) * pageSize;

  let sql = listCampaignsBaseSql;
  const params = [];

  const filters = [];
  if (status) {
    filters.push("status = ?");
    params.push(status);
  }
  if (type) {
    filters.push("type = ?");
    params.push(type);
  }

  if (filters.length > 0) {
    sql += " WHERE " + filters.join(" AND ");
  }

  sql += " ORDER BY created_at DESC ";
  sql += " LIMIT ? OFFSET ? ";
  params.push(pageSize, offset);

  const items = db.prepare(sql).all(...params);

  const countSql = `
    SELECT COUNT(*) AS cnt
    FROM campaigns
    ${filters.length ? "WHERE " + filters.join(" AND ") : ""}
  `;

  const totalRow = db.prepare(countSql).get(
    ...(filters.length ? params.slice(0, filters.length) : [])
  );

  return {
    items,
    page,
    pageSize,
    total: totalRow.cnt,
  };
}

/**
 * Tekil campaign + actions döndür
 */
function getCampaignDetail(id) {
  const campaign = getCampaignByIdStmt.get(id);
  if (!campaign) return null;

  const actions = listActionsByCampaignStmt.all(id);

  return {
    campaign,
    actions,
  };
}

/**
 * Campaign'e action ekler.
 *  - şimdilik default status: pending
 */
function addCampaignAction({
  campaignId,
  channel,
  actionType,
  scheduledAt = null,
  payload = null,
}) {
  const now = nowIso();

  const data = {
    created_at: now,
    updated_at: now,
    campaign_id: campaignId,
    channel,
    action_type: actionType,
    status: "pending",
    scheduled_at: scheduledAt,
    payload_json: payload ? JSON.stringify(payload) : null,
    result_json: null,
  };

  const result = insertActionStmt.run(data);
  const id = result.lastInsertRowid;

  log.info(
    `[Campaigns] Campaign #${campaignId} için yeni action oluşturuldu #${id} (${channel}/${actionType})`
  );

  return {
    id,
    ...data,
  };
}

/**
 * Action status güncelleme (worker tarafından kullanılacak)
 */
function updateActionStatus({
  id,
  status,
  executedAt = null,
  result = null,
}) {
  const now = nowIso();

  const resultDb = updateActionStatusStmt.run({
    id,
    status,
    updated_at: now,
    executed_at: executedAt,
    result_json: result ? JSON.stringify(result) : null,
  });

  if (resultDb.changes === 0) return null;

  const updated = getActionByIdStmt.get(id);
  log.info(`[Campaigns] Action #${id} status: ${status}`);
  return updated;
}

/**
 * Worker için bekleyen action'ları getirir
 */
function findPendingActionsForWorker({ limit = 20 } = {}) {
  const now = nowIso();
  const actions = findPendingActionsStmt.all({ now, limit });
  return actions;
}

module.exports = {
  createCampaign,
  updateCampaignStatus,
  listCampaigns,
  getCampaignDetail,
  addCampaignAction,
  updateActionStatus,
  findPendingActionsForWorker,
};