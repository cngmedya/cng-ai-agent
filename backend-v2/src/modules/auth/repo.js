// src/modules/auth/repo.js
// Auth repository – users tablosu için minimal repo + tablo bootstrap

const { getDb } = require('../../core/db');

// Bu fonksiyon bu modül her kullanıldığında users tablosunun varlığını garanti eder.
// İleride bunu core/migrations/00X_create_users.js içine taşıyabiliriz.
function ensureUsersTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sales',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function getDbWithUsers() {
  const db = getDb();
  ensureUsersTable(db);
  return db;
}

/**
 * Yeni kullanıcı oluşturur.
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.passwordHash - bcrypt ile hashlenmiş şifre
 * @param {string} params.role - ör: 'admin', 'sales'
 */
function createUser({ email, passwordHash, role }) {
  const db = getDbWithUsers();

  const stmt = db.prepare(`
    INSERT INTO users (email, password_hash, role)
    VALUES (@email, @passwordHash, @role)
  `);

  const info = stmt.run({ email, passwordHash, role });

  return {
    id: info.lastInsertRowid,
    email,
    role,
  };
}

/**
 * Email’e göre kullanıcı döner (yoksa undefined).
 * @param {string} email
 */
function findUserByEmail(email) {
  const db = getDbWithUsers();

  const stmt = db.prepare(`
    SELECT id, email, password_hash, role, created_at
    FROM users
    WHERE email = ?
    LIMIT 1
  `);

  return stmt.get(email);
}

module.exports = {
  createUser,
  findUserByEmail,
};