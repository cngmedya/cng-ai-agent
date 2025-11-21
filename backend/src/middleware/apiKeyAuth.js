// backend/src/middleware/apiKeyAuth.js

const { config } = require("../config/env");
const { log } = require("../lib/logger");

function apiKeyAuth(req, res, next) {
  const headerKey = req.headers["x-cng-api-key"];

  // Eğer env'de key tanımlı değilse, şimdilik korumayı pasif hale getiriyoruz
  if (!config.internalApiKey) {
    log.warn("[API KEY] internalApiKey tanımlı değil, koruma pasif.");
    return next();
  }

  if (!headerKey || headerKey !== config.internalApiKey) {
    log.warn("[API KEY] Geçersiz veya eksik API anahtarı denemesi.");
    return res.status(401).json({
      ok: false,
      error: "Yetkisiz erişim. Geçerli API anahtarı (x-cng-api-key) gerekli.",
    });
  }

  return next();
}

module.exports = { apiKeyAuth };