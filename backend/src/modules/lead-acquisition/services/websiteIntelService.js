// backend/src/modules/lead-acquisition/services/websiteIntelService.js

const axios = require("axios");
const cheerio = require("cheerio");
const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

/**
 * URL normalize:
 * - başında http/https yoksa https:// ekler
 */
function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  return url;
}

/**
 * Basit teknoloji tespiti
 */
function buildTechInsights(html = "") {
  const lowered = html.toLowerCase();

  const isWordPress =
    lowered.includes("wp-content") ||
    lowered.includes("wp-includes") ||
    lowered.includes("wordpress");
  const isShopify = lowered.includes("cdn.shopify.com") || lowered.includes("x-shopify-stage");
  const isWix = lowered.includes("wix.com") || lowered.includes("X-Wix-Request-Id".toLowerCase());
  const isWebflow = lowered.includes("webflow") || lowered.includes("data-wf-page");
  const isSquarespace =
    lowered.includes("squarespace") || lowered.includes("static1.squarespace.com");

  return {
    isWordPress,
    isShopify,
    isWix,
    isWebflow,
    isSquarespace,
  };
}

/**
 * SEO insight:
 * - H1 / H2 sayıları
 * - Canonical
 * - Robots meta
 * - OG / Twitter card
 * - Basit SEO skoru
 */
function buildSeoInsights($, html, url, title, description) {
  if (!$) {
    return {
      score: 0,
      issues: ["HTML parse edilemedi."],
      h1Count: 0,
      h2Count: 0,
      hasCanonical: false,
      hasRobotsMeta: false,
      hasOgTags: false,
      hasTwitterCard: false,
      canonical: null,
      robotsMeta: null,
    };
  }

  const h1Count = $("h1").length;
  const h2Count = $("h2").length;

  const canonicalTag = $('link[rel="canonical"]').attr("href") || null;
  const robotsMeta = $('meta[name="robots"]').attr("content") || null;

  const hasCanonical = !!canonicalTag;
  const hasRobotsMeta = !!robotsMeta;

  const hasOgTags =
    $('meta[property^="og:"], meta[name^="og:"]').length > 0;
  const hasTwitterCard =
    $('meta[name^="twitter:"], meta[property^="twitter:"]').length > 0;

  const issues = [];

  if (!description) {
    issues.push("Meta description eksik.");
  }

  if (!hasOgTags) {
    issues.push("Open Graph (og:) etiketleri eksik.");
  }

  if (!hasTwitterCard) {
    issues.push("Twitter Card etiketleri eksik.");
  }

  if (!hasCanonical) {
    issues.push("Canonical URL etiketi eksik.");
  }

  if (!hasRobotsMeta) {
    issues.push("Robots meta etiketi eksik.");
  }

  // Basit skor hesaplama: 100 üzerinden
  let score = 100;

  if (!title) score -= 10;
  if (!description) score -= 15;
  if (!hasCanonical) score -= 10;
  if (!hasOgTags) score -= 10;
  if (!hasTwitterCard) score -= 5;
  if (!hasRobotsMeta) score -= 5;

  // Aşırı h1 sayısı ufak eksi (ama kritik değil)
  if (h1Count === 0) score -= 10;
  if (h1Count > 3) score -= 5;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return {
    score,
    issues,
    h1Count,
    h2Count,
    hasCanonical,
    hasRobotsMeta,
    hasOgTags,
    hasTwitterCard,
    canonical: canonicalTag,
    robotsMeta,
  };
}

/**
 * Basit performans / içerik analizi:
 * - responseTimeMs
 * - contentLength
 * - kategori (small/medium/large/huge)
 */
function buildPerformanceInsights(startMs, html) {
  const endMs = Date.now();
  const responseTimeMs = endMs - startMs;
  const contentLength = html ? Buffer.byteLength(html, "utf8") : 0;

  let contentSizeCategory = "small";
  if (contentLength > 200_000) contentSizeCategory = "medium";
  if (contentLength > 800_000) contentSizeCategory = "large";
  if (contentLength > 2_000_000) contentSizeCategory = "huge";

  return {
    responseTimeMs,
    contentLength,
    contentSizeCategory,
  };
}

/**
 * Website intel ana fonksiyon:
 *  - URL normalize edilir
 *  - axios ile HTML çekilir
 *  - cheerio ile parse edilir
 *  - tech + seo + performans + yapı + skor üretilir
 *  - website_intel tablosuna kaydedilir
 *  - intel objesi döndürülür
 *
 * Input: { url, leadId? }
 */
async function enrichWebsiteFromUrl({ url, leadId = null }) {
  const normalizedUrl = normalizeUrl(url);
  const fetchedAt = new Date().toISOString();

  if (!normalizedUrl) {
    throw new Error("Geçerli bir URL gerekli.");
  }

  const db = await getCrmDb();

  let httpStatus = null;
  let title = null;
  let description = null;
  let meta = null;
  let errorMessage = null;

  let html = "";
  let response = null;

  const startedAt = Date.now();

  try {
    log.info("[WebIntel] Website analiz başlıyor", { url: normalizedUrl });

    response = await axios.get(normalizedUrl, {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true, // 200–500 arası hepsini al
    });

    httpStatus = response.status || null;
    html = typeof response.data === "string" ? response.data : "";

    const $ = cheerio.load(html);

    title = $("title").first().text() || null;
    description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      null;

    const tech = buildTechInsights(html);
    const seo = buildSeoInsights($, html, normalizedUrl, title, description);
    const performance = buildPerformanceInsights(startedAt, html);

    // Genel kalite skoru (SEO + performans kombosu)
    let combinedScore = Math.round(
      0.6 * seo.score +
        0.4 *
          (performance.responseTimeMs <= 1000
            ? 100
            : performance.responseTimeMs <= 3000
            ? 80
            : performance.responseTimeMs <= 7000
            ? 60
            : 40)
    );
    if (combinedScore > 100) combinedScore = 100;
    if (combinedScore < 0) combinedScore = 0;

    meta = {
      tech,
      seo,
      structure: {
        hasTitle: !!title,
        hasDescription: !!description,
      },
      performance,
      score: combinedScore,
      hasTitle: !!title,
      hasDescription: !!description,
      contentLength: performance.contentLength,
      fetchedAt,
    };

    const intel = {
      url: normalizedUrl,
      httpStatus,
      title,
      description,
      meta,
      error: null,
    };

    // DB kaydı
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
      normalizedUrl,
      httpStatus,
      title,
      description,
      JSON.stringify(meta),
      fetchedAt,
      null
    );

    log.info("[WebIntel] Website intel kaydedildi", {
      url: normalizedUrl,
      httpStatus,
    });

    return intel;
  } catch (err) {
    errorMessage = err.message || "Unknown error";

    log.warn("[WebIntel] Website fetch hatası", {
      url: normalizedUrl,
      httpStatus,
      error: errorMessage,
    });

    // Hatalı durumlarda da DB’ye kaydedelim ki geçmişte ne denemişiz görelim
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
      normalizedUrl,
      httpStatus,
      null,
      null,
      null,
      fetchedAt,
      errorMessage
    );

    return {
      url: normalizedUrl,
      httpStatus,
      title: null,
      description: null,
      meta: null,
      error: errorMessage,
    };
  }
}

module.exports = {
  enrichWebsiteFromUrl,
};