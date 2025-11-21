// backend/src/services/crmService.js

const path = require("path");
const Database = require("better-sqlite3");
const { log } = require("../lib/logger");

// -------------------------------------------------------------
// DB INIT
// -------------------------------------------------------------

// CRM veritabanı dosya yolu
const dbFile = path.join(__dirname, "..", "data", "crm.sqlite");

// DB bağlantısı
const db = new Database(dbFile);

// Tabloları oluştur
db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT,
  location TEXT,
  lead_score INTEGER NOT NULL DEFAULT 0,
  firmographic_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  lead_id INTEGER NOT NULL,
  package_level TEXT,
  tone TEXT,
  content TEXT,
  raw_json TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  lead_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
`);

log.info("[CRM] Veritabanı hazır:", dbFile);

// Hazır SQL statement'lar
const insertLeadStmt = db.prepare(`
  INSERT INTO leads (
    created_at,
    updated_at,
    name,
    sector,
    location,
    lead_score,
    firmographic_score,
    total_score,
    status
  ) VALUES (
    @created_at,
    @updated_at,
    @name,
    @sector,
    @location,
    @lead_score,
    @firmographic_score,
    @total_score,
    @status
  )
`);

const insertOfferStmt = db.prepare(`
  INSERT INTO offers (
    created_at,
    updated_at,
    lead_id,
    package_level,
    tone,
    content,
    raw_json
  ) VALUES (
    @created_at,
    @updated_at,
    @lead_id,
    @package_level,
    @tone,
    @content,
    @raw_json
  )
`);

const insertNoteStmt = db.prepare(`
  INSERT INTO notes (
    created_at,
    lead_id,
    type,
    content
  ) VALUES (
    @created_at,
    @lead_id,
    @type,
    @content
  )
`);

const updateLeadStatusStmt = db.prepare(`
  UPDATE leads
  SET status = @status,
      updated_at = @updated_at
  WHERE id = @id
`);

const getLeadByIdStmt = db.prepare(`
  SELECT *
  FROM leads
  WHERE id = ?
`);

const listLeadsStmtBase = `
  SELECT *
  FROM leads
`;

// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------

function nowIso() {
  return new Date().toISOString();
}

// Lead skorlarını ve firmographic skorunu normalize et
function extractScoresFromLead(lead) {
  const leadScore = lead?.scores?.totalScore ?? 0;
  const firmographicScore = lead?.firmographic?.scores?.totalScore ?? 0;
  const totalScore = leadScore + firmographicScore;
  return { leadScore, firmographicScore, totalScore };
}

// -------------------------------------------------------------
// PUBLIC API
// -------------------------------------------------------------

/**
 * Lead + offer pipeline sonucunu CRM'e kaydeder.
 *  - yeni lead kaydı
 *  - ilgili offer kaydı
 *
 * Dönüş: { leadId, offerId }
 */
function saveLeadAndOfferFromPipeline({ lead, offer, sector, location }) {
  if (!lead || !offer) {
    throw new Error("saveLeadAndOfferFromPipeline requires lead and offer");
  }

  const now = nowIso();
  const { leadScore, firmographicScore, totalScore } =
    extractScoresFromLead(lead);

  const leadData = {
    created_at: now,
    updated_at: now,
    name: lead.name || "Bilinmeyen Firma",
    sector: sector || null,
    location: location || null,
    lead_score: leadScore,
    firmographic_score: firmographicScore,
    total_score: totalScore,
    status: "new",
  };

  const tx = db.transaction(() => {
    const leadResult = insertLeadStmt.run(leadData);
    const leadId = leadResult.lastInsertRowid;

    const offerData = {
      created_at: now,
      updated_at: now,
      lead_id: leadId,
      package_level: offer.packageLevel || null,
      tone: offer.tone || null,
      content: offer.offerMarkdown || null,
      raw_json: JSON.stringify(offer),
    };

    const offerResult = insertOfferStmt.run(offerData);
    const offerId = offerResult.lastInsertRowid;

    log.info(
      `[CRM] Yeni lead oluşturuldu #${leadId} (${leadData.name})`
    );
    log.info(
      `[CRM] Lead #${leadId} için offer kaydedildi #${offerId}`
    );

    return { leadId, offerId };
  });

  return tx();
}

/**
 * Lead listesi (sayfalama + isteğe bağlı status filtresi)
 */
function listLeads({ page = 1, pageSize = 20, status } = {}) {
  const offset = (page - 1) * pageSize;

  let sql = listLeadsStmtBase;
  const params = [];

  if (status) {
    sql += " WHERE status = ? ";
    params.push(status);
  }

  sql += " ORDER BY total_score DESC, created_at DESC ";
  sql += " LIMIT ? OFFSET ? ";
  params.push(pageSize, offset);

  const items = db.prepare(sql).all(...params);

  // COUNT kısmını ayrı yazıyoruz ki parametre hizası bozulmasın
  let countSql = "SELECT COUNT(*) AS cnt FROM leads";
  const countParams = [];

  if (status) {
    countSql += " WHERE status = ?";
    countParams.push(status);
  }

  const totalRow = db.prepare(countSql).get(...countParams);

  return {
    items,
    page,
    pageSize,
    total: totalRow.cnt,
  };
}

/**
 * Tek bir lead + ona bağlı offer ve notları döndürür.
 */
function getLeadDetail(id) {
  const lead = getLeadByIdStmt.get(id);
  if (!lead) return null;

  const offers = db
    .prepare(
      `SELECT * FROM offers WHERE lead_id = ? ORDER BY created_at DESC`
    )
    .all(id);

  const notes = db
    .prepare(
      `SELECT * FROM notes WHERE lead_id = ? ORDER BY created_at DESC`
    )
    .all(id);

  return {
    lead,
    offers,
    notes,
  };
}

/**
 * Lead'e not ekler
 */
function addNote({ leadId, type = "note", content }) {
  const now = nowIso();

  const noteData = {
    created_at: now,
    lead_id: leadId,
    type,
    content,
  };

  const result = insertNoteStmt.run(noteData);
  const id = result.lastInsertRowid;

  log.info(`[CRM] Lead #${leadId} için yeni not eklendi #${id}`);

  return {
    id,
    ...noteData,
  };
}

/**
 * Lead status güncelleme
 */
function updateLeadStatus({ leadId, status }) {
  const now = nowIso();

  const result = updateLeadStatusStmt.run({
    id: leadId,
    status,
    updated_at: now,
  });

  if (result.changes === 0) {
    return null;
  }

  const updated = getLeadByIdStmt.get(leadId);
  log.info(`[CRM] Lead #${leadId} status güncellendi: ${status}`);

  return updated;
}

module.exports = {
  saveLeadAndOfferFromPipeline,
  listLeads,
  getLeadDetail,
  addNote,
  updateLeadStatus,
};