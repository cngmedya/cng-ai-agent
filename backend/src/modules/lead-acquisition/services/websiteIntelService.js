// backend/src/modules/lead-acquisition/services/websiteIntelService.js

const axios = require("axios");
const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

/**
 * Basit HTML içinden <title> çek
 */
function extractTitle(html) {
  if (!html) return null;
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Basit HTML içinden meta description çek
 */
function extractMetaDescription(html) {
  if (!html) return null;

  const metaRegex =
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i;

  const match = html.match(metaRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Çok basit bir "tech / CMS" tespiti
 */
function detectTech(html) {
  if (!html) return null;
  const lower = html.toLowerCase();

  const tech = {
    isWordPress: lower.includes("wp-content") || lower.includes("wordpress"),
    isShopify: lower.includes("cdn.shopify.com") || lower.includes("shopify"),
    isWix: lower.includes("wixstatic.com") || lower.includes("wix.com"),
    isWebflow: lower.includes("webflow.io") || lower.includes("webflow.com"),
    isSquarespace: lower.includes("squarespace.com"),
  };

  return tech;
}

/**
 * Website kalite skoruna zemin hazırlayan basit bir değerlendirme
 */
function buildWebsiteScore({ httpStatus, title, description, html }) {
  let score = 0;

  if (httpStatus && httpStatus >= 200 && httpStatus < 400) {
    score += 40;
  }

  if (title && title.length >= 3) {
    score += 20;
  }

  if (description && description.length >= 20) {
    score += 20;
  }

  if (html && html.length > 5000) {
    // Biraz içerik doluluğu
    score += 20;
  }

  if (score > 100) score = 100;

  return score;
}

/**
 * URL normalize:
 * - boşsa null
 * - protokol yoksa https:// ekle
 */
function normalizeUrl(url) {
  if (!url) return null;
  let u = String(url).trim();
  if (!u) return null;

  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    u = "https://" + u;
  }

  return u;
}

/**
 * Website Intel V2
 *
 * Input:
 *  - url (zorunlu)
 *  - leadId (opsiyonel)
 *
 * Davranış:
 *  - URL'ye HTTP isteği atar
 *  - Durum kodunu alır
 *  - HTML'den title + meta description çeker
 *  - Basit tech / CMS bilgisi çıkarır
 *  - website_intel tablosuna kayıt yazar
 *  - Sonuç objesini geri döner
 */
async function enrichWebsiteFromUrl({ url, leadId = null }) {
  const finalUrl = normalizeUrl(url);

  if (!finalUrl) {
    throw new Error("URL zorunludur.");
  }

  log.info("[WebIntel] Website analiz başlıyor", { url: finalUrl });

  const db = await getCrmDb();

  let httpStatus = null;
  let title = null;
  let description = null;
  let metaJson = null;
  let errorMessage = null;
  let html = null;

  try {
    const resp = await axios.get(finalUrl, {
      timeout: 10000,
      maxRedirects: 5,
      // Her HTTP kodunda hata fırlatma yerine status'u kendimiz yorumlayalım
      validateStatus: () => true,
    });

    httpStatus = resp.status;
    html = typeof resp.data === "string" ? resp.data : null;

    title = extractTitle(html);
    description = extractMetaDescription(html);
    const tech = detectTech(html);

    const score = buildWebsiteScore({
      httpStatus,
      title,
      description,
      html,
    });

    metaJson = {
      tech,
      score,
      hasTitle: !!title,
      hasDescription: !!description,
      contentLength: html ? html.length : 0,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    errorMessage = err.message;
    log.warn("[WebIntel] Website fetch hatası", {
      url: finalUrl,
      httpStatus,
      error: err.message,
    });
  }

  // DB'ye yaz
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO website_intel (
      lead_id,
      url,
      http_status,
      title,
      description,
      meta_json,
      last_checked_at,
      error_message
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    leadId || null,
    finalUrl,
    httpStatus,
    title,
    description,
    metaJson ? JSON.stringify(metaJson) : null,
    now,
    errorMessage
  );

  log.info("[WebIntel] Website intel kaydedildi", {
    url: finalUrl,
    httpStatus,
  });

  return {
    url: finalUrl,
    httpStatus,
    title,
    description,
    meta: metaJson,
    error: errorMessage,
  };
}

module.exports = {
  enrichWebsiteFromUrl,
};