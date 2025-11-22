// backend/src/modules/lead-acquisition/services/leadBatchWebsiteIntelService.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");
const { enrichWebsiteFromUrl } = require("./websiteIntelService");

/**
 * Website kalitesini sınıflandır:
 *  - none        → site yok / ulaşılamıyor / ağır hata
 *  - placeholder → domain satış / parked / çok boş sayfa
 *  - weak        → zayıf yapı, eksik SEO / içerik
 *  - strong      → iyi yapılandırılmış, içerik ve SEO fena değil
 */
function classifyWebsiteQuality(intel) {
  if (!intel) {
    return {
      quality: "none",
      score: 0,
      reasons: ["Website intel alınamadı."],
    };
  }

  const { httpStatus, title, description, meta } = intel;

  // HTTP hata / ulaşılamıyor
  if (!httpStatus || httpStatus >= 400) {
    return {
      quality: "none",
      score: 0,
      reasons: [
        "Siteye ulaşılamadı veya HTTP hatası var.",
        httpStatus ? `HTTP status: ${httpStatus}` : "HTTP status yok",
      ],
    };
  }

  const reasons = [];
  const score =
    meta && typeof meta.score === "number" ? meta.score : null;

  const contentLength =
    meta?.performance?.contentLength ??
    meta?.contentLength ??
    0;

  const hasTitle =
    meta?.structure?.hasTitle ??
    meta?.hasTitle ??
    Boolean(title);

  const hasDescription =
    meta?.structure?.hasDescription ??
    meta?.hasDescription ??
    Boolean(description);

  const seoScore =
    meta?.seo && typeof meta.seo.score === "number"
      ? meta.seo.score
      : null;

  const titleLower = (title || "").toLowerCase();
  const descLower = (description || "").toLowerCase();

  // 1) Placeholder / domain satış / çok boş sayfa
  if (contentLength && contentLength < 2000) {
    if (
      titleLower.includes("domain") ||
      titleLower.includes("for sale") ||
      titleLower.includes("satılık") ||
      descLower.includes("domain") ||
      descLower.includes("satılık")
    ) {
      reasons.push("Domain satış / parked sayfa gibi görünüyor.");
      return {
        quality: "placeholder",
        score: score ?? seoScore ?? 30,
        reasons,
      };
    }

    if (!hasDescription) {
      reasons.push("İçerik çok kısa ve açıklama yok.");
      return {
        quality: "weak",
        score: score ?? seoScore ?? 40,
        reasons,
      };
    }
  }

  // 2) SEO / içerik zayıf ise
  if (seoScore !== null && seoScore < 60) {
    reasons.push("SEO skoru düşük.");
  }
  if (!hasDescription) {
    reasons.push("Meta description eksik.");
  }

  if (
    (seoScore !== null && seoScore < 60) ||
    !hasDescription ||
    contentLength < 10000
  ) {
    return {
      quality: "weak",
      score: score ?? seoScore ?? 55,
      reasons: reasons.length
        ? reasons
        : ["Yapı ve içerik zayıf görünüyor."],
    };
  }

  // 3) Güçlü site
  reasons.push("Başlık ve açıklama mevcut.");
  reasons.push("SEO ve içerik seviyesi makul veya iyi.");

  return {
    quality: "strong",
    score: score ?? seoScore ?? 80,
    reasons,
  };
}

/**
 * Tek bir lead için website intel çalıştır
 *  - potential_leads.website alanındaki URL'i kullanır
 *  - enrichWebsiteFromUrl ile intel alır
 *  - website_intel tablosuna yazma işlemi enrichWebsiteFromUrl içinde
 */
async function runWebsiteIntelForLead(lead) {
  const { id, company_name, website } = lead;

  if (!website) {
    log.warn("[WebIntelBatch] Website boş, lead atlandı", {
      id,
      company_name,
    });
    return {
      leadId: id,
      companyName: company_name,
      website: null,
      status: "no_website",
      httpStatus: null,
      websiteQuality: "none",
      websiteScore: 0,
      websiteQualityNotes: ["Lead kaydında website bulunmuyor."],
      intel: null,
    };
  }

  // Website alanı http(s) ile başlamıyorsa başına https:// ekleyelim
  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url.replace(/^\/+/, "")}`;
  }

  log.info("[WebIntelBatch] Website analiz başlıyor", {
    leadId: id,
    companyName: company_name,
    url,
  });

  try {
    const intel = await enrichWebsiteFromUrl({
      url,
      leadId: id,
    });

    const httpStatus =
      intel && typeof intel.httpStatus === "number"
        ? intel.httpStatus
        : intel?.httpStatus ?? null;

    let status = "ok";

    if (!intel) {
      status = "error_unknown";
    } else if (!httpStatus || httpStatus >= 400) {
      status = "error_status";
    }

    const { quality, score, reasons } = classifyWebsiteQuality(intel);

    return {
      leadId: id,
      companyName: company_name,
      website: intel?.url || url,
      status,
      httpStatus,
      websiteQuality: quality,
      websiteScore: score,
      websiteQualityNotes: reasons,
      intel,
    };
  } catch (err) {
    log.warn("[WebIntelBatch] Website intel hatası", {
      leadId: id,
      companyName: company_name,
      url,
      error: err.message,
    });

    return {
      leadId: id,
      companyName: company_name,
      website: url,
      status: "error_exception",
      httpStatus: null,
      websiteQuality: "none",
      websiteScore: 0,
      websiteQualityNotes: [
        "Website intel sırasında exception oluştu.",
        err.message,
      ],
      intel: null,
    };
  }
}

/**
 * Batch website intel:
 *  - website alanı dolu olan
 *  - ve henüz website_intel kaydı olmayan lead'leri seçer
 *  - her biri için runWebsiteIntelForLead çalıştırır
 */
async function runWebsiteIntelBatch({ limit = 10 } = {}) {
  const db = await getCrmDb();

  // Henüz website_intel çalışmamış lead'ler
  const leads = db
    .prepare(
      `
      SELECT pl.id, pl.company_name, pl.website
      FROM potential_leads pl
      LEFT JOIN website_intel wi ON wi.lead_id = pl.id
      WHERE pl.website IS NOT NULL
        AND pl.website != ''
        AND wi.id IS NULL
      ORDER BY pl.id ASC
      LIMIT ?
    `
    )
    .all(limit);

  if (!leads.length) {
    log.info("[WebIntelBatch] İşlenecek lead bulunamadı.");
    return {
      ok: true,
      processedCount: 0,
      items: [],
    };
  }

  log.info("[WebIntelBatch] Batch website intel başlıyor", {
    count: leads.length,
    limit,
  });

  const items = [];

  for (const lead of leads) {
    const item = await runWebsiteIntelForLead(lead);
    items.push(item);
  }

  log.info("[WebIntelBatch] Batch tamamlandı", {
    processedCount: items.length,
  });

  return {
    ok: true,
    processedCount: items.length,
    items,
  };
}

module.exports = {
  runWebsiteIntelBatch,
};