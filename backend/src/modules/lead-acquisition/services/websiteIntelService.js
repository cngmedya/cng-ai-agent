// backend/src/modules/lead-acquisition/services/websiteIntelService.js

const axios = require("axios");
const { log } = require("../../../lib/logger");
const { getCrmDb } = require("../../../db/db");

// SQL injection'a karşı basit escape helper
function sqlValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  const str = String(value);
  const escaped = str.replace(/'/g, "''");
  return `'${escaped}'`;
}

// HTML içinden basit title + description çıkartma
function parseHtmlMeta(html) {
  if (!html || typeof html !== "string") {
    return { title: null, description: null, meta: {} };
  }

  let title = null;
  let description = null;

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }

  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
  );
  if (descMatch && descMatch[1]) {
    description = descMatch[1].trim();
  }

  const meta = {
    title,
    description,
  };

  return { title, description, meta };
}

async function enrichWebsiteFromUrl({ url }) {
  if (!url) {
    throw new Error("URL zorunludur.");
  }

  log.info("[WebIntel] Website analiz başlıyor", { url });

  let httpStatus = null;
  let html = null;
  let errorMessage = null;

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      // headers: { "User-Agent": "CNG-Medya-AI-Agent/1.0" } // istersen ekleyebiliriz
    });
    httpStatus = response.status;
    html = response.data;
  } catch (err) {
    httpStatus = err.response ? err.response.status : null;
    errorMessage = err.message;
    log.warn("[WebIntel] Website fetch hatası", {
      url,
      httpStatus,
      error: err.message,
    });
  }

  const { title, description, meta } = parseHtmlMeta(html || "");

  const db = await getCrmDb();
  const now = "datetime('now')";

  const metaJson = JSON.stringify(meta);
  const errorText = errorMessage || null;

  const sql = `
    INSERT INTO website_intel (
      url,
      http_status,
      title,
      description,
      meta_json,
      error,
      created_at,
      updated_at
    ) VALUES (
      ${sqlValue(url)},
      ${httpStatus !== null ? httpStatus : "NULL"},
      ${sqlValue(title)},
      ${sqlValue(description)},
      ${sqlValue(metaJson)},
      ${sqlValue(errorText)},
      ${now},
      ${now}
    );
  `;

  await db.exec(`BEGIN; ${sql} COMMIT;`);

  log.info("[WebIntel] Website intel kaydedildi", {
    url,
    httpStatus,
  });

  return {
    url,
    httpStatus,
    title,
    description,
    meta,
    error: errorMessage || null,
  };
}

module.exports = {
  enrichWebsiteFromUrl,
};