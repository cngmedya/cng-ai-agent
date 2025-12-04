// backend-v2/src/core/config.js
const path = require('path');
require('dotenv').config();

const rootDir = path.join(__dirname, '..', '..');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4100,
  // Yeni v2 DB: backend-v2/data/app.sqlite
  dbPath: process.env.DB_PATH || path.join(rootDir, 'data', 'app.sqlite')
};

module.exports = { config };