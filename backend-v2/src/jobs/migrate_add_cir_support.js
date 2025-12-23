/**
 * MIGRATION: CIR Destek Tablosu + Lead Metadata
 * 
 * Tablo ekler:
 *   - lead_cir_reports
 * 
 * potential_leads tablosuna ekler:
 *   - last_cir_score
 *   - last_cir_created_at
 */

const Database = require('better-sqlite3');
const path = require('path');

console.log("\n[migrate:cirsupport] Migration başladı...\n");

const dbPath = path.join(__dirname, '../..', 'data/crm.sqlite');

let db;
try {
  db = new Database(dbPath);
} catch (err) {
  console.error("❌ DB açılamadı:", err.message);
  process.exit(1);
}

// 1) lead_cir_reports tablosu
db.exec(`
  CREATE TABLE IF NOT EXISTS lead_cir_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    report_json TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES potential_leads(id)
  );
`);

console.log("[migrate:cirsupport] lead_cir_reports oluşturuldu veya zaten mevcut.");

// 2) potential_leads metadata ekle
try {
  db.exec(`ALTER TABLE potential_leads ADD COLUMN last_cir_score INTEGER;`);
  console.log("[migrate:cirsupport] last_cir_score eklendi.");
} catch (e) {
  console.log("[migrate:cirsupport] last_cir_score zaten mevcut.");
}

try {
  db.exec(`ALTER TABLE potential_leads ADD COLUMN last_cir_created_at TEXT;`);
  console.log("[migrate:cirsupport] last_cir_created_at eklendi.");
} catch (e) {
  console.log("[migrate:cirsupport] last_cir_created_at zaten mevcut.");
}

console.log("\n✅ [migrate:cirsupport] Migration başarıyla tamamlandı.\n");
db.close();