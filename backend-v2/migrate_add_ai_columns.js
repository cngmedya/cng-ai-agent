// backend-v2/migrate_add_ai_columns.js
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data', 'app.sqlite');
console.log('[MIGRATE AI] DB:', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function columnExists(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table});`).all();
  return rows.some((r) => r.name === column);
}

function ensureColumn(table, column, type) {
  if (columnExists(table, column)) {
    console.log(`[MIGRATE AI] Column already exists: ${table}.${column}`);
    return;
  }
  const sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${type};`;
  console.log('[MIGRATE AI] Adding column:', sql);
  db.exec(sql);
}

db.transaction(() => {
  ensureColumn('potential_leads', 'ai_category', 'TEXT');
  ensureColumn('potential_leads', 'ai_score', 'INTEGER');
  ensureColumn('potential_leads', 'ai_notes', 'TEXT');
})();

db.close();
console.log('[MIGRATE AI] Done.');