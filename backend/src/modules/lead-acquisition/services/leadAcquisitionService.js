// backend/src/modules/lead-acquisition/services/leadAcquisitionService.js

const { log } = require("../../../lib/logger");
const { getCrmDb } = require("../../../db/db");
const { searchPlacesWithText } = require("./googlePlacesService");
const { normalizePlaceToLead } = require("../utils/normalizeLead");

async function acquireFromGooglePlaces({ location, keyword, radius }) {
  // 1) Google Places'ten ham sonuçları çek
  const { places, raw } = await searchPlacesWithText({
    location,
    keyword,
    radius,
  });

  log("INFO", "[LeadAcq] Google Places sonuç sayısı", {
    count: places.length,
  });

  const db = await getCrmDb();

  // 2) lead_sources kaydı
  const sourceStmt = await db.prepare(`
    INSERT INTO lead_sources (query, source_type, raw_payload_json, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  const sourceJson = JSON.stringify(raw);
  await sourceStmt.run(`${keyword} @ ${location}`, "google_places", sourceJson);
  const sourceId = sourceStmt.lastID;
  await sourceStmt.finalize();

  let inserted = 0;
  let duplicates = 0;

  // 3) her place için potential_leads tablosuna yaz
  const insertStmt = await db.prepare(`
    INSERT INTO potential_leads (
      company_name,
      category,
      website,
      phone,
      address,
      city,
      country,
      source,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  for (const place of places) {
    const lead = normalizePlaceToLead(place, {
      keyword,
      sourceType: "google_places",
      location,
    });

    if (!lead.company_name) {
      continue;
    }

    // basit duplicate kontrolü (company_name + city)
    const existing = await db.get(
      `SELECT id FROM potential_leads WHERE company_name = ? AND city = ?`,
      [lead.company_name, lead.city]
    );

    if (existing) {
      duplicates++;
      continue;
    }

    await insertStmt.run(
      lead.company_name,
      lead.category,
      lead.website,
      lead.phone,
      lead.address,
      lead.city,
      lead.country,
      lead.source,
      "found"
    );
    inserted++;
  }

  await insertStmt.finalize();

  log("INFO", "[LeadAcq] Google Places taraması tamamlandı", {
    inserted,
    duplicates,
  });

  return {
    sourceId,
    foundCount: places.length,
    insertedCount: inserted,
    duplicateCount: duplicates,
  };
}

module.exports = {
  acquireFromGooglePlaces,
};