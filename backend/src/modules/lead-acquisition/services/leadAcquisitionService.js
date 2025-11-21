// backend/src/modules/lead-acquisition/services/leadAcquisitionService.js

const { log } = require("../../../lib/logger");
const { getCrmDb } = require("../../../db/db");

// 🔹 V2 – Hem Text Search hem Place Details kullanıyoruz
const { searchPlacesWithTextAndDetails } = require("./googlePlacesService");

// 🔹 Lead normalizasyon helper
const { normalizePlaceToLead } = require("../utils/normalizeLead");

// SQL string içinde güvenli şekilde kullanmak için
function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  const str = String(value);
  const escaped = str.replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Google Places → Text Search + Place Details kombinasyonu ile lead toplama
 * Çoğu işletmede website, telefon ve adres bilgisi direkt Place Details'ten gelir.
 */
async function acquireFromGooglePlaces({ location, keyword, radius }) {
  // 1) Google Places (Text Search + Place Details) → tam veri çek
  const { places, raw } = await searchPlacesWithTextAndDetails({
    location,
    keyword,
    radius,
  });

  log.info("[LeadAcq] Google Places sonuç sayısı (details ile)", {
    count: places.length,
  });

  const db = await getCrmDb();

  // 2) SQL batch hazırlığı
  let sqlBatch = "BEGIN;\n";

  const queryLabel = `${keyword} @ ${location}`;
  const rawPayload = JSON.stringify(raw);

  sqlBatch += `
    INSERT INTO lead_sources (
      query,
      source_type,
      raw_payload_json,
      created_at
    )
    VALUES (
      ${sqlValue(queryLabel)},
      'google_places',
      ${sqlValue(rawPayload)},
      datetime('now')
    );
  `;

  let inserted = 0;
  let duplicates = 0;

  // Aynı batch içinde duplicate engelleme
  const seenKeys = new Set();

  // 3) Her place → normalize → potential_leads içine yaz
  for (const place of places) {
    const lead = normalizePlaceToLead(place, {
      keyword,
      sourceType: "google_places",
      location,
    });

    if (!lead.company_name) continue;

    // duplicate check (V2)
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
        ${sqlValue(lead.website)},      -- 🔥 Place Details varsa gerçek website burada!
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

  // 4) Tek seferlik batch insert
  await db.exec(sqlBatch);

  log.info("[LeadAcq] Google Places taraması tamamlandı", {
    inserted,
    duplicates,
  });

  return {
    ok: true,
    foundCount: places.length,
    insertedCount: inserted,
    duplicateCount: duplicates,
  };
}

module.exports = {
  acquireFromGooglePlaces,
};