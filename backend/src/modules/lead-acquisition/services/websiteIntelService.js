// backend/src/modules/lead-acquisition/services/websiteIntelService.js

const axios = require("axios");
const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

/**
 * Basit HTML helper'lar
 */
function extractTitle(html) {
  if (!html) return null;
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractMetaDescription(html) {
  if (!html) return null;
  const match = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );
  return match ? match[1].trim() : null;
}

function extractMetaRobots(html) {
  if (!html) return null;
  const match = html.match(
    /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );
  return match ? match[1].trim().toLowerCase() : null;
}

function extractCanonical(html) {
  if (!html) return null;
  const match = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i
  );
  return match ? match[1].trim() : null;
}

function countTag(html, tagName) {
  if (!html) return 0;
  const regex = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  const matches = html.match(regex);
  return matches ? matches.length : 0;
}

function hasOgTags(html) {
  if (!html) return false;
  return /<meta[^>]+property=["']og:/i.test(html);
}

function hasTwitterCard(html) {
  if (!html) return false;
  return /<meta[^>]+name=["']twitter:/i.test(html);
}

/**
 * Çok basit teknoloji tespiti
 */
function detectTech(html) {
  const text = (html || "").toLowerCase();

  const isWordPress =
    text.includes("wp-content") ||
    text.includes("wp-includes") ||
    /<meta[^>]+name=["']generator["'][^>]+wordpress/i.test(text);

  const isShopify =
    text.includes("cdn.shopify.com") ||
    text.includes("myshopify.com") ||
    /<meta[^>]+name=["']shopify/i.test(text);

  const isWix =
    text.includes("wix-static") ||
    text.includes("wix.com") ||
    /<meta[^>]+name=["']generator["'][^>]+wix/i.test(text);

  const isWebflow =
    text.includes("webflow.io") ||
    text.includes("webflow.js") ||
    /<meta[^>]+name=["']generator["'][^>]+webflow/i.test(text);

  const isSquarespace =
    text.includes("squarespace.com") ||
    /<meta[^>]+name=["']generator["'][^>]+squarespace/i.test(text);

  return {
    isWordPress,
    isShopify,
    isWix,
    isWebflow,
    isSquarespace,
  };
}

/**
 * SEO & yapı skorları
 */
function computeSeoScore({
  hasTitle,
  hasDescription,
  h1Count,
  h2Count,
  hasCanonical,
  hasOg,
  hasTwitter,
  robots,
}) {
  let score = 0;
  const issues = [];

  // Title
  if (hasTitle) {
    score += 15;
  } else {
    issues.push("Title etiketi eksik.");
  }

  // Description
  if (hasDescription) {
    score += 15;
  } else {
    issues.push("Meta description eksik.");
  }

  // H1
  if (h1Count === 1) {
    score += 15;
  } else if (h1Count === 0) {
    issues.push("Hiç H1 başlığı yok.");
  } else if (h1Count > 1) {
    issues.push("Birden fazla H1 başlığı var.");
  }

  // H2
  if (h2Count >= 1) {
    score += 10;
  } else {
    issues.push("H2 başlık yapısı zayıf.");
  }

  // Canonical
  if (hasCanonical) {
    score += 10;
  } else {
    issues.push("Canonical link tanımlanmamış.");
  }

  // OG
  if (hasOg) {
    score += 10;
  } else {
    issues.push("Open Graph (og:) etiketleri eksik.");
  }

  // Twitter
  if (hasTwitter) {
    score += 5;
  } else {
    issues.push("Twitter Card etiketleri eksik.");
  }

  // Robots
  if (robots) {
    if (robots.includes("noindex")) {
      issues.push("Robots meta'da noindex var (dikkat).");
      score -= 20;
    }
    if (robots.includes("nofollow")) {
      issues.push("Robots meta'da nofollow var (dikkat).");
      score -= 10;
    }
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return { seoScore: score, issues };
}

/**
 * Genel kalite skoru
 *  - SEO skorunu, içerik uzunluğunu ve title/description durumunu harmanlar
 */
function computeOverallScore({
  seoScore,
  contentLength,
  hasTitle,
  hasDescription,
}) {
  let score = 40;

  // SEO temel skoru
  score += seoScore * 0.4; // max +40

  // İçerik uzunluğuna göre
  if (contentLength > 0 && contentLength < 10_000) {
    score += 0; // çok zayıf içerik
  } else if (contentLength >= 10_000 && contentLength < 80_000) {
    score += 10;
  } else if (contentLength >= 80_000 && contentLength < 300_000) {
    score += 20;
  } else if (contentLength >= 300_000) {
    score += 15; // çok büyük HTML → hafif kırp
  }

  // Title / description ekstra
  if (hasTitle) score += 5;
  if (hasDescription) score += 5;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return Math.round(score);
}

/**
 * Website intel ana fonksiyonu (V2)
 *
 * Input: { url, leadId? }
 * Output:
 *  {
 *    url,
 *    httpStatus,
 *    title,
 *    description,
 *    meta: {
 *      tech: {...},
 *      seo: {
 *        score: number,
 *        issues: string[],
 *        h1Count,
 *        h2Count,
 *        hasCanonical,
 *        hasRobotsMeta,
 *        hasOgTags,
 *        hasTwitterCard
 *      },
 *      structure: {
 *        hasTitle,
 *        hasDescription
 *      },
 *      score,           // overall score (0–100)
 *      hasTitle,
 *      hasDescription,
 *      contentLength,
 *      fetchedAt
 *    },
 *    error: null | string
 *  }
 */
async function enrichWebsiteFromUrl({ url, leadId = null }) {
  const db = await getCrmDb();

  let httpStatus = null;
  let title = null;
  let description = null;
  let html = null;
  let errorMessage = null;

  try {
    log.info("[WebIntel] Website analiz başlıyor", { url });

    const response = await axios.get(url, {
      timeout: 15000,
      validateStatus: () => true, // 4xx/5xx olsa bile içeriği al
    });

    httpStatus = response.status || null;
    html = typeof response.data === "string" ? response.data : "";

    title = extractTitle(html);
    description = extractMetaDescription(html);
  } catch (err) {
    errorMessage = err.message;
    log.warn("[WebIntel] Website fetch hatası", {
      url,
      httpStatus,
      error: err.message,
    });
  }

  const contentLength = html ? html.length : 0;

  // Yapı analizi
  const h1Count = countTag(html, "h1");
  const h2Count = countTag(html, "h2");
  const canonical = extractCanonical(html);
  const robotsMeta = extractMetaRobots(html);
  const og = hasOgTags(html);
  const twitter = hasTwitterCard(html);

  const hasTitle = !!title;
  const hasDescription = !!description;

  // Tech analizi
  const tech = detectTech(html);

  // SEO ve genel skorlar
  const { seoScore, issues } = computeSeoScore({
    hasTitle,
    hasDescription,
    h1Count,
    h2Count,
    hasCanonical: !!canonical,
    hasOg: og,
    hasTwitter: twitter,
    robots: robotsMeta,
  });

  const overallScore = computeOverallScore({
    seoScore,
    contentLength,
    hasTitle,
    hasDescription,
  });

  const fetchedAt = new Date().toISOString();

  const meta = {
    tech,
    seo: {
      score: seoScore,
      issues,
      h1Count,
      h2Count,
      hasCanonical: !!canonical,
      hasRobotsMeta: !!robotsMeta,
      hasOgTags: og,
      hasTwitterCard: twitter,
      canonical,
      robotsMeta,
    },
    structure: {
      hasTitle,
      hasDescription,
    },
    score: overallScore, // 🔹 overall kalite skoru
    hasTitle,
    hasDescription,
    contentLength,
    fetchedAt,
  };

  // DB'ye yaz
  try {
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
      VALUES (
        @lead_id,
        @url,
        @http_status,
        @title,
        @description,
        @meta_json,
        datetime('now'),
        @error_message
      );
    `
    ).run({
      lead_id: leadId || null,
      url,
      http_status: httpStatus,
      title,
      description,
      meta_json: JSON.stringify(meta),
      error_message: errorMessage,
    });

    log.info("[WebIntel] Website intel kaydedildi", {
      url,
      httpStatus,
    });
  } catch (dbErr) {
    log.error("[WebIntel] DB yazma hatası", {
      url,
      error: dbErr.message,
    });
  }

  return {
    url,
    httpStatus,
    title,
    description,
    meta,
    error: errorMessage,
  };
}

module.exports = {
  enrichWebsiteFromUrl,
};