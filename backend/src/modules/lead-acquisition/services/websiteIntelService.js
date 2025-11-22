// backend/src/modules/lead-acquisition/services/websiteIntelService.js

const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");
const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");

// --------------------------------------------------------
// Helper: URL normalize
// --------------------------------------------------------
function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;

  let url = rawUrl.trim();

  // Eğer protokol yoksa https varsay
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  try {
    const u = new URL(url);
    // Trailing slash normalize et
    u.pathname = u.pathname || "/";
    return u.toString();
  } catch (_) {
    return null;
  }
}

// --------------------------------------------------------
// Helper: content size
// --------------------------------------------------------
function classifyContentSize(contentLength) {
  if (!contentLength || typeof contentLength !== "number") return "unknown";
  if (contentLength < 50_000) return "small";
  if (contentLength < 250_000) return "medium";
  if (contentLength < 1_000_000) return "large";
  return "huge";
}

// --------------------------------------------------------
// Helper: basic tech detection (çok hafif heuristics)
// --------------------------------------------------------
function detectTech($, html) {
  const lowerHtml = html.toLowerCase();

  const isWordPress =
    lowerHtml.includes("wp-content") ||
    lowerHtml.includes("wp-includes") ||
    $('meta[name="generator"][content*="wordpress"]').length > 0;

  const isShopify =
    lowerHtml.includes("cdn.shopify.com") ||
    lowerHtml.includes("x-shopify-stage");

  const isWix = lowerHtml.includes("wix.com") || lowerHtml.includes("wix-static");

  const isWebflow =
    lowerHtml.includes("webflow.io") ||
    $('meta[name="generator"][content*="webflow"]').length > 0;

  const isSquarespace = lowerHtml.includes("squarespace.com");

  return {
    isWordPress,
    isShopify,
    isWix,
    isWebflow,
    isSquarespace,
  };
}

// --------------------------------------------------------
// Helper: SEO analizi
// --------------------------------------------------------
function analyzeSeo($) {
  const title = $("title").first().text().trim() || null;
  const description =
    $('meta[name="description"]').attr("content")?.trim() || null;

  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const robotsMeta = $('meta[name="robots"]').attr("content") || null;

  const ogTags = [
    "og:title",
    "og:description",
    "og:image",
    "og:url",
    "og:type",
  ];
  const hasOgTags = ogTags.some(
    (p) => $(`meta[property="${p}"]`).length > 0
  );

  const twitterTags = [
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
  ];
  const hasTwitterCard = twitterTags.some(
    (n) => $(`meta[name="${n}"]`).length > 0
  );

  const h1Count = $("h1").length;
  const h2Count = $("h2").length;

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
  if (!canonical) {
    issues.push("Canonical URL etiketi eksik.");
  }
  if (!robotsMeta) {
    issues.push("Robots meta etiketi eksik.");
  }

  // Basit SEO skoru (0–100)
  let score = 100;
  // Başlık / description yoksa ciddi düşür
  if (!title) score -= 25;
  if (!description) score -= 20;
  if (!canonical) score -= 10;
  if (!robotsMeta) score -= 5;
  if (!hasOgTags) score -= 10;
  if (!hasTwitterCard) score -= 5;

  // Çok az heading → biraz kırp
  if (h1Count === 0) score -= 5;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return {
    score,
    issues,
    h1Count,
    h2Count,
    hasCanonical: !!canonical,
    hasRobotsMeta: !!robotsMeta,
    hasOgTags,
    hasTwitterCard,
    canonical,
    robotsMeta,
  };
}

// --------------------------------------------------------
// Helper: Yapısal analiz (UX / content light)
// --------------------------------------------------------
function analyzeStructure($, html) {
  const title = $("title").first().text().trim() || null;
  const description =
    $('meta[name="description"]').attr("content")?.trim() || null;

  const imagesCount = $("img").length;
  const links = $("a[href]");
  const totalLinks = links.length;

  let internalLinks = 0;
  let externalLinks = 0;
  links.each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) {
      return;
    }
    if (/^https?:\/\//i.test(href)) {
      externalLinks += 1;
    } else {
      internalLinks += 1;
    }
  });

  const cssAssetsCount = $('link[rel="stylesheet"]').length;
  const jsAssetsCount = $('script[src]').length;

  const faviconCount = $(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  ).length;

  const structuredDataScripts = $('script[type="application/ld+json"]');
  const structuredDataCount = structuredDataScripts.length;

  // Kabaca içerik uzunluğu (kelime)
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(" ").length : 0;

  return {
    hasTitle: !!title,
    hasDescription: !!description,
    imagesCount,
    totalLinks,
    internalLinks,
    externalLinks,
    cssAssetsCount,
    jsAssetsCount,
    hasFavicon: faviconCount > 0,
    structuredDataCount,
    wordCount,
  };
}

// --------------------------------------------------------
// Helper: Performans analizi (çok basit)
// --------------------------------------------------------
function analyzePerformance({ responseTimeMs, contentLength }) {
  const sizeCategory = classifyContentSize(contentLength);

  const perf = {
    responseTimeMs,
    contentLength,
    contentSizeCategory: sizeCategory,
  };

  // Basit skor
  let score = 100;

  if (!responseTimeMs || responseTimeMs > 4000) score -= 30;
  else if (responseTimeMs > 2500) score -= 20;
  else if (responseTimeMs > 1500) score -= 10;

  if (!contentLength) {
    score -= 10;
  } else if (contentLength > 1_500_000) {
    score -= 30;
  } else if (contentLength > 800_000) {
    score -= 20;
  } else if (contentLength > 300_000) {
    score -= 10;
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return {
    ...perf,
    performanceScore: score,
  };
}

// --------------------------------------------------------
// Helper: Toplam website skor ve kalite sınıfı
// --------------------------------------------------------
function computeWebsiteScore(meta) {
  if (!meta) return 0;

  const seoScore = meta.seo?.score ?? 0;
  const perfScore = meta.performance?.performanceScore ?? 0;
  const hasTitle = !!meta.structure?.hasTitle;
  const hasDescription = !!meta.structure?.hasDescription;
  const wordCount = meta.structure?.wordCount ?? 0;

  // Tech basit bonus
  const tech = meta.tech || {};
  let techScore = 0;
  if (tech.isWordPress) techScore += 10;
  if (tech.isShopify || tech.isWix || tech.isWebflow || tech.isSquarespace)
    techScore += 5;

  // Content depth
  let contentScore = 0;
  if (wordCount > 200) contentScore += 10;
  if (wordCount > 800) contentScore += 10;

  // Structure
  let structureScore = 0;
  if (hasTitle) structureScore += 10;
  if (hasDescription) structureScore += 10;

  // Ağırlıklandırma
  const total =
    seoScore * 0.35 +
    perfScore * 0.25 +
    techScore * 0.15 +
    contentScore * 0.15 +
    structureScore * 0.10;

  let score = Math.round(total);
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return score;
}

function classifyWebsiteQuality(score, httpStatus, hasTitle, hasDescription) {
  if (!httpStatus || httpStatus < 200 || httpStatus >= 400) {
    return "no_site";
  }

  if (!hasTitle && !hasDescription) {
    return "weak";
  }

  if (score >= 80) return "strong";
  if (score >= 55) return "medium";
  return "weak";
}

function classifyWebsiteOpportunity(intel) {
  const httpStatus = intel.httpStatus;
  const meta = intel.meta || {};
  const seoScore = meta.seo?.score ?? 0;
  const perfScore = meta.performance?.performanceScore ?? 0;
  const hasTitle = !!meta.structure?.hasTitle;
  const hasDescription = !!meta.structure?.hasDescription;

  const notes = [];

  if (!httpStatus || httpStatus < 200 || httpStatus >= 400) {
    notes.push(
      "Website şu an erişilemiyor veya HTTP hatası veriyor. Domain aktif ama site çalışmıyor olabilir."
    );
    return {
      type: "brand_new_website",
      notes,
    };
  }

  // Domain var ama içerik yok / forsale / çok zayıf
  const wordCount = meta.structure?.wordCount ?? 0;
  if (wordCount < 50) {
    notes.push(
      "Website çok düşük içerik seviyesine sahip. Neredeyse boş bir sayfa gibi görünüyor."
    );
    return {
      type: "website_rebuild",
      notes,
    };
  }

  if (!hasTitle || !hasDescription || seoScore < 55) {
    notes.push(
      "Başlık / açıklama eksik, tasarım & içerik tarafında ciddi iyileştirme fırsatı var."
    );
    notes.push("SEO tarafında önemli eksikler mevcut.");
    return {
      type: "website_rebuild",
      notes,
    };
  }

  if (seoScore < 75) {
    notes.push(
      "Website iyi durumda fakat SEO & içerik tarafında upgrade fırsatları var."
    );
    return {
      type: "seo_content_upgrade",
      notes,
    };
  }

  if (perfScore < 70) {
    notes.push("Website performansı / hız tarafında iyileştirme fırsatları var.");
    return {
      type: "performance_optimization",
      notes,
    };
  }

  notes.push(
    "Website güçlü görünüyor. Reklam, performans ve ölçeklendirme odaklı teklif için uygun."
  );

  return {
    type: "high_quality",
    notes,
  };
}

// --------------------------------------------------------
// Ana fonksiyon: Website'i fetch + analiz + DB kaydı
// --------------------------------------------------------
async function fetchWebsiteHtml(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    throw new Error("Geçersiz URL");
  }

  const start = Date.now();
  let response;
  try {
    response = await axios.get(normalized, {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CNG-AgentBot/1.0; +https://cngmedya.com)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });
  } catch (err) {
    const duration = Date.now() - start;
    return {
      url: normalized,
      httpStatus: null,
      html: null,
      responseTimeMs: duration,
      error: err.message,
    };
  }

  const duration = Date.now() - start;
  const httpStatus = response.status || null;
  const html = typeof response.data === "string" ? response.data : "";

  return {
    url: normalized,
    httpStatus,
    html,
    responseTimeMs: duration,
    error: null,
  };
}

async function enrichWebsiteFromUrl({ url, leadId = null }) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return {
      url,
      httpStatus: null,
      title: null,
      description: null,
      meta: null,
      error: "Geçersiz URL",
    };
  }

  log.info("[WebIntel] Website analiz başlıyor", { url: normalized });

  const fetchResult = await fetchWebsiteHtml(normalized);
  const { httpStatus, html, responseTimeMs, error: fetchError } = fetchResult;

  // HTML yoksa → sadece hata kaydet
  if (!html || fetchError) {
    const intel = {
      url: normalized,
      httpStatus,
      title: null,
      description: null,
      meta: null,
      error: fetchError || "HTML getirilemedi.",
    };

    // DB'ye kaydet
    await saveWebsiteIntelToDb({ leadId, intel });

    log.warn("[WebIntel] Website fetch hatası", {
      url: normalized,
      httpStatus,
      error: intel.error,
    });

    log.info("[WebIntel] Website intel kaydedildi", {
      url: normalized,
      httpStatus,
    });

    return intel;
  }

  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;
  const description =
    $('meta[name="description"]').attr("content")?.trim() || null;

  const tech = detectTech($, html);
  const seo = analyzeSeo($);
  const structure = analyzeStructure($, html);
  const performance = analyzePerformance({
    responseTimeMs,
    contentLength: Buffer.byteLength(html, "utf8"),
  });

  const meta = {
    tech,
    seo,
    structure,
    performance,
    score: null, // aşağıda set edeceğiz
    hasTitle: structure.hasTitle,
    hasDescription: structure.hasDescription,
    contentLength: performance.contentLength,
    fetchedAt: new Date().toISOString(),
  };

  const websiteScore = computeWebsiteScore(meta);
  meta.score = websiteScore;

  const quality = classifyWebsiteQuality(
    websiteScore,
    httpStatus,
    structure.hasTitle,
    structure.hasDescription
  );
  const opportunity = classifyWebsiteOpportunity({
    url: normalized,
    httpStatus,
    meta,
  });

  const intel = {
    url: normalized,
    httpStatus,
    title,
    description,
    meta,
    websiteScore,
    websiteQuality: quality,
    websiteQualityNotes: buildWebsiteQualityNotes(quality, meta),
    websiteOpportunityType: opportunity.type,
    websiteOpportunityNotes: opportunity.notes,
    error: null,
  };

  // DB'ye kaydet
  await saveWebsiteIntelToDb({ leadId, intel });

  log.info("[WebIntel] Website intel kaydedildi", {
    url: normalized,
    httpStatus,
  });

  return intel;
}

// --------------------------------------------------------
// WebsiteQuality için kısa açıklama notları
// --------------------------------------------------------
function buildWebsiteQualityNotes(quality, meta) {
  const notes = [];

  if (quality === "no_site") {
    notes.push("Website'e erişilemedi veya HTTP hatası alındı.");
    return notes;
  }

  if (quality === "strong") {
    notes.push("Başlık ve açıklama mevcut.");
    notes.push("SEO ve içerik seviyesi makul veya iyi.");
  } else if (quality === "medium") {
    notes.push("Website ortalama kalitede, birkaç iyileştirme fırsatı mevcut.");
  } else if (quality === "weak") {
    if (!meta.structure?.hasTitle || !meta.structure?.hasDescription) {
      notes.push("Başlık veya açıklama eksik.");
    }
    if ((meta.seo?.issues || []).length) {
      notes.push("SEO tarafında belirgin eksikler mevcut.");
    }
  }

  return notes;
}

// --------------------------------------------------------
// DB kayıt / update
// --------------------------------------------------------
async function saveWebsiteIntelToDb({ leadId, intel }) {
  const db = await getCrmDb();

  const now = new Date().toISOString();

  const metaJson = intel.meta ? JSON.stringify(intel.meta) : null;

  // Aynı URL için var mı bak (leadId eşleştirme opsiyonel)
  const existing = db
    .prepare(
      `
      SELECT id
      FROM website_intel
      WHERE url = ?
      ORDER BY id DESC
      LIMIT 1
    `
    )
    .get(intel.url);

  if (existing && existing.id) {
    db.prepare(
      `
      UPDATE website_intel
      SET
        lead_id = COALESCE(?, lead_id),
        http_status = ?,
        title = ?,
        description = ?,
        meta_json = ?,
        last_checked_at = ?,
        error_message = ?
      WHERE id = ?
    `
    ).run(
      leadId || null,
      intel.httpStatus,
      intel.title,
      intel.description,
      metaJson,
      now,
      intel.error || null,
      existing.id
    );
  } else {
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      leadId || null,
      intel.url,
      intel.httpStatus,
      intel.title,
      intel.description,
      metaJson,
      now,
      intel.error || null
    );
  }
}

// --------------------------------------------------------
// Export
// --------------------------------------------------------
module.exports = {
  enrichWebsiteFromUrl,
};