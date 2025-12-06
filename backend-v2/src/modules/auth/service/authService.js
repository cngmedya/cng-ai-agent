// src/modules/auth/service/authService.js
// Basit register/login servisi – bcrypt ile şifre hash + SQLite repo

const bcrypt = require('bcrypt');
const { createUser, findUserByEmail } = require('../repo');

const SALT_ROUNDS = 10;

/**
 * Yeni kullanıcı kaydı
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} [params.role] - default: 'sales'
 */
async function register({ email, password, role }) {
  if (!email || !password) {
    throw new Error('EMAIL_AND_PASSWORD_REQUIRED');
  }

  // Aynı email zaten var mı?
  const existing = findUserByEmail(email);
  if (existing) {
    const err = new Error('USER_ALREADY_EXISTS');
    err.code = 'USER_ALREADY_EXISTS';
    throw err;
  }

  // Şifreyi hashle
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = createUser({
    email,
    passwordHash,
    role: role || 'sales',
  });

  // Repo sadece temel bilgileri döndürsün
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  };
}

/**
 * Login – şimdilik sadece email + password doğrulama
 * İleride buraya JWT ekleyebiliriz.
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password
 */
async function login({ email, password }) {
  if (!email || !password) {
    throw new Error('EMAIL_AND_PASSWORD_REQUIRED');
  }

  const user = findUserByEmail(email);
  if (!user) {
    const err = new Error('INVALID_CREDENTIALS');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const err = new Error('INVALID_CREDENTIALS');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  // Şimdilik sadece basic user objesi döndürelim
  // (JWT entegrasyonunu bir sonraki adımda ekleyebiliriz)
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  };
}

module.exports = {
  register,
  login,
};