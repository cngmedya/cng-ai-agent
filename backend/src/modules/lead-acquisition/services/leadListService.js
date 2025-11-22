// backend/src/modules/lead-acquisition/services/leadListService.js

const { getCrmDb } = require("../../../db/db");

/**
 * Basit normalizasyon
 */
function normalizeText(str) {
  if (!str) return "";
  return String(str).toLowerCase().trim();
}

/**
 * Lead kalite skor sistemi (V2)
 */
function computeLeadQualityScore(lead) {
  let score = 0;
  const notes = [];

  if (lead.website) {
    score += 10;
    notes.push("Website mevcut");
  }

  if (lead.phone) {
    score += 10;
    notes.push("Telefon bilgisi var");
  }

  if (lead.address) {
    score += 10;
    notes.push("Adres bilgisi var");
  }

  if (lead.city) {
    score += 10;
    notes.push("Şehir bilgisi var");
  }

  if (lead.company_name && lead.company_name.length < 40) {
    score += 10;
    notes.push("Firma adı okunabilir uzunlukta");
  }

  return { score, notes };
}

/**
 * Lead list (paged)
 */
async function getLeadList({ page = 1, limit = 20 } = {}) {
  const db = await getCrmDb();

  const offset = (page - 1) * limit;

  const rows = db
    .prepare(
      `
      SELECT *
      FROM potential_leads
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset);

  const countRow = db
    .prepare(`SELECT COUNT(*) as c FROM potential_leads`)
    .get();

  const items = rows.map((row) => {
    const normalized_name = normalizeText(row.company_name);
    const normalized_category = normalizeText(row.category);
    const normalized_city = normalizeText(row.city);

    const q = computeLeadQualityScore(row);

    return {
      ...row,
      normalized_name,
      normalized_category,
      normalized_city,
      lead_quality_score: q.score,
      lead_quality_notes: JSON.stringify(q.notes),
    };
  });

  return {
    items,
    total: countRow.c,
    page,
    limit,
  };
}

module.exports = {
  getLeadList,
};