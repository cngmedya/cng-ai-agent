const { getCrmDb } = require("../../../db/db");
const { log } = require("../../../lib/logger");
const { enrichWebsiteFromUrl } = require("./websiteIntelService");

/**
 * Tek bir lead için website intel çalıştır
 */
async function runWebsiteIntelForLead(lead) {
  const { id, company_name, website } = lead;

  if (!website) {
    return {
      leadId: id,
      companyName: company_name,
      website: null,
      status: "skipped_no_website",
      intel: null,
    };
  }

  // URL http ile başlamıyorsa düzelt
  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    log.info("[WebIntelBatch] Website intel başlıyor", {
      leadId: id,
      companyName: company_name,
      url,
    });

    const intel = await enrichWebsiteFromUrl({
      url,
      leadId: id,
    });

    const ok =
      typeof intel.httpStatus === "number" &&
      intel.httpStatus >= 200 &&
      intel.httpStatus < 400;

    log.info("[WebIntelBatch] Website intel tamamlandı", {
      leadId: id,
      companyName: company_name,
      url: intel.url,
      httpStatus: intel.httpStatus,
      ok,
    });

    return {
      leadId: id,
      companyName: company_name,
      website: intel.url,
      status: ok ? "ok" : "error_status",
      httpStatus: intel.httpStatus ?? null,
      intel,
    };
  } catch (err) {
    log.warn("[WebIntelBatch] Website intel hata", {
      leadId: id,
      companyName: company_name,
      url,
      error: err.message,
    });

    return {
      leadId: id,
      companyName: company_name,
      website: url,
      status: "error",
      httpStatus: null,
      error: err.message,
      intel: null,
    };
  }
}

/**
 * Batch website intel:
 *  - website'i dolu olan lead'leri seç
 *  - website_intel tablosunda henüz kaydı OLMAYAN lead'ler
 *  - her biri için runWebsiteIntelForLead
 */
async function runWebsiteIntelBatch({ limit = 10 } = {}) {
  const db = await getCrmDb();

  // website dolu + website_intel kaydı olmayan lead'ler
  const leads = db
    .prepare(
      `
      SELECT pl.id,
             pl.company_name,
             pl.website
      FROM potential_leads pl
      LEFT JOIN website_intel wi
        ON wi.lead_id = pl.id
      WHERE pl.website IS NOT NULL
        AND pl.website != ''
        AND wi.id IS NULL
      ORDER BY pl.id ASC
      LIMIT ?
    `
    )
    .all(limit);

  if (!leads.length) {
    log.info("[WebIntelBatch] İşlenecek lead bulunamadı");
    return {
      ok: true,
      processedCount: 0,
      items: [],
      note: "Website'i dolu olup website_intel kaydı olmayan lead bulunamadı.",
    };
  }

  const items = [];
  for (const lead of leads) {
    const result = await runWebsiteIntelForLead(lead);
    items.push(result);
  }

  const processedCount = items.length;

  log.info("[WebIntelBatch] Batch tamamlandı", {
    processedCount,
  });

  return {
    ok: true,
    processedCount,
    items,
  };
}

module.exports = {
  runWebsiteIntelBatch,
  runWebsiteIntelForLead,
};