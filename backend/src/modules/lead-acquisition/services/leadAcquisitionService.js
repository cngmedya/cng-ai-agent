// backend/src/modules/lead-acquisition/services/leadAcquisitionService.js

const { log } = require("../../../lib/logger");
const { getCrmDb } = require("../../../db/db");
const { searchPlacesWithText } = require("./googlePlacesService");
const { normalizePlaceToLead } = require("../utils/normalizeLead");

// SQL string içinde güvenli şekilde kullanmak için basit escape helper
function sqlValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  const str = String(value);
  // Tek tırnakları SQLite uyumlu hale getirelim
  const escaped = str.replace(/'/g, "''");
  return `'${escaped}'`;
}

async function acquireFromGooglePlaces({ location, keyword, radius }) {
  // 1) Google Places sonuçlarını çek
  const { places, raw } = await searchPlacesWithText({
    location,
    keyword,
    radius,
  });

  log.info("[LeadAcq] Google Places sonuç sayısı", {
    count: places.length,
  });

  const db = await getCrmDb();

  // 2) SQL batch string hazırlayalım
  let sqlBatch = "BEGIN;\n";

  // lead_sources kaydı
  const queryLabel = `${keyword} @ ${location}`;
  const rawJson = JSON.stringify(raw);

  sqlBatch += `
    INSERT INTO lead_sources (query, source_type, raw_payload_json, created_at)
    VALUES (${sqlValue(queryLabel)}, 'google_places', ${sqlValue(
    rawJson
  )}, datetime('now'));
  `;

  let inserted = 0;
  let duplicates = 0;

  // Aynı batch içindeki duplicate'leri engellemek için (company_name + city)
  const seenKeys = new Set();

  for (const place of places) {
    const lead = normalizePlaceToLead(place, {
      keyword,
      sourceType: "google_places",
      location,
    });

    if (!lead.company_name) {
      continue;
    }

    const key = `${lead.company_name}||${lead.city || ""}`;
    if (seenKeys.has(key)) {
      duplicates++;
      continue;
    }
    seenKeys.add(key);
    inserted++;

    sqlBatch += `
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
      )
      VALUES (
        ${sqlValue(lead.company_name)},
        ${sqlValue(lead.category)},
        ${sqlValue(lead.website)},
        ${sqlValue(lead.phone)},
        ${sqlValue(lead.address)},
        ${sqlValue(lead.city)},
        ${sqlValue(lead.country)},
        ${sqlValue(lead.source)},
        'found',
        datetime('now'),
        datetime('now')
      );
    `;
  }

  sqlBatch += "\nCOMMIT;";

  // 3) Tek seferde tüm batch'i çalıştır
  await db.exec(sqlBatch);

  log.info("[LeadAcq] Google Places taraması tamamlandı", {
    inserted,
    duplicates,
  });

  return {
    sourceId: null, // V1: last_insert_rowid kullanmıyoruz, gerekirse V2'de ekleriz
    foundCount: places.length,
    insertedCount: inserted,
    duplicateCount: duplicates,
  };
}

module.exports = {
  acquireFromGooglePlaces,
};