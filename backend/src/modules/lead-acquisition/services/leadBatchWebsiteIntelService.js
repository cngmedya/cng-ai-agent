// backend/src/modules/lead-acquisition/services/leadBatchWebsiteIntelService.js

const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");
const { enrichWebsiteFromUrl } = require("./websiteIntelService");

/**
 * Website kalite skorunu ve basit kalite etiketini çıkar
 *  - strong / weak / no_site / error
 */
function classifyWebsiteQualityFromIntel(intel) {
  if (!intel) {
    return {
      websiteQuality: "error",
      websiteScore: 0,
      websiteQualityNotes: ["Website intel bulunamadı."],
    };
  }

  const httpStatus = intel.httpStatus ?? null;
  const meta = intel.meta || {};
  const seo = meta.seo || {};
  const structure = meta.structure || {};
  const performance = meta.performance || {};

  const score = typeof meta.score === "number" ? meta.score : 0;
  const notes = [];

  // HTTP hata / erişilemiyor
  if (!httpStatus || httpStatus >= 400) {
    notes.push("Website'e erişilemedi veya HTTP hatası alındı.");
    return {
      websiteQuality: "no_site",
      websiteScore: 0,
      websiteQualityNotes: notes,
    };
  }

  // Çok küçük / boş sayfa
  const contentLength =
    performance.contentLength || meta.contentLength || 0;
  if (contentLength > 0 && contentLength < 2000) {
    notes.push("Sayfa neredeyse boş görünüyor (çok az içerik).");
  }

  // SEO issues
  if (seo.issues && Array.isArray(seo.issues) && seo.issues.length) {
    notes.push(...seo.issues.slice(0, 3));
  }

  let websiteQuality = "weak";

  if (score >= 80) {
    websiteQuality = "strong";
    if (!notes.length) {
      notes.push(
        "Başlık ve açıklama mevcut.",
        "SEO ve içerik seviyesi makul veya iyi."
      );
    }
  } else if (score >= 50) {
    websiteQuality = "weak";
    if (!notes.length) {
      notes.push("SEO skoru orta seviyede, iyileştirme fırsatı var.");
    }
  } else {
    websiteQuality = "no_site";
    notes.push("Website çok zayıf veya neredeyse boş.");
  }

  return {
    websiteQuality,
    websiteScore: score,
    websiteQualityNotes: notes,
  };
}

/**
 * Website opportunity (satılabilir fırsat) sınıflandırması
 *
 * type:
 *  - brand_new_website  → domain var ama site yok / boş / parked / coming soon
 *  - website_rebuild    → site var ama kötü / zayıf / güncellenmeye muhtaç
 *  - seo_content_upgrade→ site iyi ama SEO & içerik tarafında upgrade fırsatı
 *  - high_quality       → çok iyi site (daha çok reklam / scale fırsatı)
 */
function classifyWebsiteOpportunityFromIntel(intel, websiteQuality) {
  const notes = [];

  if (!intel) {
    return {
      opportunityType: "brand_new_website",
      opportunityNotes: [
        "Website bulunamadı, domain veya hosting tarafında sorun olabilir.",
      ],
    };
  }

  const httpStatus = intel.httpStatus ?? null;
  const meta = intel.meta || {};
  const seo = meta.seo || {};
  const structure = meta.structure || {};
  const performance = meta.performance || {};

  const title = (intel.title || "").toLowerCase();
  const desc = (intel.description || "").toLowerCase();
  const fullText = `${title} ${desc}`;

  const contentLength =
    performance.contentLength || meta.contentLength || 0;

  // 1) HTTP erişim hatası → brand_new_website fırsatı
  if (!httpStatus || httpStatus >= 400) {
    notes.push(
      "Website şu an erişilemiyor veya HTTP hatası veriyor. Domain aktif ama site çalışmıyor olabilir."
    );
    return {
      opportunityType: "brand_new_website",
      opportunityNotes: notes,
    };
  }

  // 2) Domain parked / for sale
  if (
    /domain for sale|this domain is for sale|professional domain sales|satılık domain|satilik domain/.test(
      fullText
    )
  ) {
    notes.push(
      "Domain satış sayfası görünüyor. Aktif website tasarımı yok."
    );
    return {
      opportunityType: "brand_new_website",
      opportunityNotes: notes,
    };
  }

  // 3) Coming soon / yapım aşamasında
  if (
    /coming soon|under construction|yapım aşamasında|yapim aşamasinda|hazırlanıyor|hazirlaniyor|construction/.test(
      fullText
    )
  ) {
    notes.push(
      "Website 'coming soon' / 'yapım aşamasında' gibi görünüyor."
    );
    return {
      opportunityType: "brand_new_website",
      opportunityNotes: notes,
    };
  }

  // 4) Çok az içerik → brand_new_website fırsatı
  if (contentLength > 0 && contentLength < 1000) {
    notes.push(
      "Domain var ama sayfa neredeyse boş. Yeni website tasarımı için güçlü fırsat."
    );
    return {
      opportunityType: "brand_new_website",
      opportunityNotes: notes,
    };
  }

  // 5) Website quality'e göre fırsat türü
  if (websiteQuality === "no_site") {
    notes.push(
      "Website çok zayıf veya yok gibi. Baştan web sitesi tasarımı için uygun aday."
    );
    return {
      opportunityType: "brand_new_website",
      opportunityNotes: notes,
    };
  }

  if (websiteQuality === "weak") {
    // zayıf site → rebuild fırsatı
    if (!structure.hasTitle || !structure.hasDescription) {
      notes.push(
        "Başlık / açıklama eksik, tasarım & içerik tarafında ciddi iyileştirme fırsatı var."
      );
    }
    if (seo.issues && seo.issues.length) {
      notes.push("SEO tarafında önemli eksikler mevcut.");
    }
    if (!notes.length) {
      notes.push(
        "Website var ama zayıf görünüyor. Baştan tasarım / revizyon için uygun aday."
      );
    }

    return {
      opportunityType: "website_rebuild",
      opportunityNotes: notes,
    };
  }

  // websiteQuality === "strong"
  if (websiteQuality === "strong") {
    if (seo.issues && seo.issues.length) {
      notes.push(
        "Website iyi durumda fakat SEO & içerik tarafında upgrade fırsatları var."
      );
      notes.push(...seo.issues.slice(0, 3));
      return {
        opportunityType: "seo_content_upgrade",
        opportunityNotes: notes,
      };
    }

    notes.push(
      "Website güçlü görünüyor. Reklam, performans ve ölçeklendirme odaklı teklif için uygun."
    );
    return {
      opportunityType: "high_quality",
      opportunityNotes: notes,
    };
  }

  // Fallback
  notes.push("Website iyileştirme potansiyeli taşıyor.");
  return {
    opportunityType: "website_rebuild",
    opportunityNotes: notes,
  };
}

/**
 * WEBSITE INTEL BATCH
 *  - potential_leads tablosunda website'i olan lead'leri alır
 *  - enrichWebsiteFromUrl ile website intel çeker + DB'ye kaydeder
 *  - kalite (websiteQuality) + fırsat (websiteOpportunity) üretir
 */
async function runWebsiteIntelBatch({ limit = 10 } = {}) {
  const db = await getCrmDb();

  const leads = db
    .prepare(
      `
      SELECT id, company_name, website
      FROM potential_leads
      WHERE website IS NOT NULL AND website != ''
      ORDER BY id ASC
      LIMIT ?
    `
    )
    .all(limit);

  if (!leads.length) {
    return {
      ok: true,
      processedCount: 0,
      items: [],
    };
  }

  const items = [];

  for (const lead of leads) {
    const website = (lead.website || "").trim();

    if (!website) {
      items.push({
        leadId: lead.id,
        companyName: lead.company_name,
        website: null,
        status: "no_website",
        httpStatus: null,
        websiteQuality: "no_site",
        websiteScore: 0,
        websiteQualityNotes: ["Lead kaydında website alanı boş."],
        websiteOpportunityType: "brand_new_website",
        websiteOpportunityNotes: [
          "Website alanı boş. Sıfırdan web sitesi tasarımı için ideal aday.",
        ],
        intel: null,
      });
      continue;
    }

    try {
      const intel = await enrichWebsiteFromUrl({
        url: website,
        leadId: lead.id,
      });

      const {
        websiteQuality,
        websiteScore,
        websiteQualityNotes,
      } = classifyWebsiteQualityFromIntel(intel);

      const {
        opportunityType,
        opportunityNotes,
      } = classifyWebsiteOpportunityFromIntel(intel, websiteQuality);

      const status =
        typeof intel.httpStatus === "number" &&
        intel.httpStatus >= 200 &&
        intel.httpStatus < 400
          ? "ok"
          : "error_status";

      items.push({
        leadId: lead.id,
        companyName: lead.company_name,
        website,
        status,
        httpStatus: intel.httpStatus ?? null,
        websiteQuality,
        websiteScore,
        websiteQualityNotes,
        websiteOpportunityType: opportunityType,
        websiteOpportunityNotes: opportunityNotes,
        intel,
      });
    } catch (err) {
      log.warn("[WebIntelBatch] Website intel hata", {
        leadId: lead.id,
        companyName: lead.company_name,
        website,
        error: err.message,
      });

      items.push({
        leadId: lead.id,
        companyName: lead.company_name,
        website,
        status: "error_fetch",
        httpStatus: null,
        websiteQuality: "error",
        websiteScore: 0,
        websiteQualityNotes: [
          "Website taranırken teknik bir hata oluştu.",
        ],
        websiteOpportunityType: "brand_new_website",
        websiteOpportunityNotes: [
          "Website'e erişilemedi, domain veya hosting problemi olabilir.",
        ],
        intel: {
          url: website,
          httpStatus: null,
          title: null,
          description: null,
          meta: null,
          error: err.message,
        },
      });
    }
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