// backend/src/modules/lead-acquisition/services/leadQualityService.js

const { log } = require("../../../lib/logger");

/**
 * Türkçe karakter normalize + sadeleştirme
 */
function normalizeText(value) {
  if (!value) return null;

  const map = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  };

  let s = String(value)
    .split("")
    .map((ch) => map[ch] || ch)
    .join("");

  s = s.toLowerCase();
  s = s.replace(/\s+/g, " ").trim();

  return s || null;
}

/**
 * Şehir alanından posta kodu vs. at -> sade şehir ismi
 * Örn: "34750 Ataşehir/İstanbul" -> "atasehir istanbul"
 */
function normalizeCity(city) {
  if (!city) return null;
  // rakamları kaldır, böl / , - /
  let s = city.replace(/[0-9]/g, " ");
  s = s.replace(/[\/,\-]/g, " ");
  return normalizeText(s);
}

/**
 * Website URL'den root domain çıkar
 * Örn: https://www.mimaristudio.com/tr -> mimaristudio.com
 */
function extractDomainFromUrl(url) {
  if (!url) return null;
  try {
    let clean = url.trim();
    if (!/^https?:\/\//i.test(clean)) {
      clean = "https://" + clean;
    }
    const u = new URL(clean);
    return u.hostname.replace(/^www\./, "");
  } catch (e) {
    return null;
  }
}

/**
 * Domain "brandable" mı? (örnek bir heuristic)
 * - max 20 char
 * - çok rakam yok
 * - çok generic değil
 */
function isBrandableDomain(domain) {
  if (!domain) return false;
  const core = domain.split(".")[0]; // mimaristudio
  if (core.length === 0 || core.length > 20) return false;
  const digits = (core.match(/[0-9]/g) || []).length;
  if (digits > 2) return false;

  const genericWords = ["mimarlik", "insaat", "gayrimenkul", "icmimarlik", "tasarim"];
  // tamamen generic ise brandable sayma
  if (genericWords.includes(core)) return false;

  return true;
}

/**
 * Lead quality score hesaplayıcı
 *  - 0–100 arası skor
 *  - notlar JSON array olarak döner
 */
function computeLeadQuality(lead) {
  let score = 0;
  const notes = [];

  const hasWebsite = !!lead.website;
  const hasPhone = !!lead.phone;
  const hasAddress = !!lead.address;
  const hasCity = !!lead.city;
  const hasCategory = !!lead.category;

  if (hasWebsite) {
    score += 30;
    notes.push("Website mevcut");
  } else {
    notes.push("Website eksik");
  }

  if (hasPhone) {
    score += 20;
    notes.push("Telefon bilgisi var");
  } else {
    notes.push("Telefon bilgisi eksik");
  }

  if (hasAddress || hasCity) {
    score += 10;
    notes.push("Adres / şehir bilgisi var");
  } else {
    notes.push("Adres / şehir bilgisi eksik");
  }

  if (hasCategory) {
    score += 10;
    notes.push("Kategori bilgisi var");
  }

  // Firma adı uzunluğu
  if (lead.company_name) {
    const len = lead.company_name.length;
    if (len >= 3 && len <= 60) {
      score += 10;
      notes.push("Firma adı okunabilir uzunlukta");
    }
  }

  // Domain kalitesi
  const domain = extractDomainFromUrl(lead.website);
  if (domain) {
    if (isBrandableDomain(domain)) {
      score += 20;
      notes.push(`Domain markalaşmaya uygun: ${domain}`);
    } else {
      notes.push(`Domain daha generik görünüyor: ${domain}`);
    }
  }

  // Skoru 0–100 arası sabitle
  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return {
    lead_quality_score: score,
    lead_quality_notes: JSON.stringify(notes),
  };
}

/**
 * Lead normalizer:
 *  - normalized_name, normalized_category, normalized_city üretir
 */
function normalizeLeadFields(lead) {
  return {
    normalized_name: normalizeText(lead.company_name),
    normalized_category: normalizeText(lead.category),
    normalized_city: normalizeCity(lead.city),
  };
}

/**
 * Dışarıya tek entry point:
 *  - normalize + score hesaplanmış objeyi döner
 */
function buildNormalizedLeadMeta(lead) {
  const norm = normalizeLeadFields(lead);
  const quality = computeLeadQuality(lead);

  const meta = {
    ...norm,
    ...quality,
  };

  log.info("[LeadQuality] Lead normalize + score hesaplandı", {
    company: lead.company_name,
    score: quality.lead_quality_score,
  });

  return meta;
}

module.exports = {
  normalizeText,
  normalizeCity,
  computeLeadQuality,
  normalizeLeadFields,
  buildNormalizedLeadMeta,
};