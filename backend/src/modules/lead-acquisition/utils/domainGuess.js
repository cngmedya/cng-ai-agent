// backend/src/modules/lead-acquisition/utils/domainGuess.js

// Türkçe karakterleri sadeleştirip slug oluşturma
function slugifyName(name = "") {
    if (!name) return "";
  
    let s = name.toLowerCase();
  
    const map = {
      ç: "c",
      ğ: "g",
      ı: "i",
      ö: "o",
      ş: "s",
      ü: "u",
    };
  
    s = s
      .split("")
      .map((ch) => map[ch] || ch)
      .join("");
  
    // "mimarlık ofisi", "mimarlık & iç mimarlık" gibi şeyleri sadeleştir
    s = s.replace(/mimarlik ofisi/g, "mimarlik");
    s = s.replace(/iç mimarlik/g, "icmimarlik");
    s = s.replace(/&/g, " ");
    s = s.replace(/[^a-z0-9\s]/g, " ");
    s = s.replace(/\s+/g, " ").trim();
  
    // boşlukları kaldır
    s = s.replace(/\s+/g, "");
  
    return s;
  }
  
  /**
   * Firma adı (ve opsiyonel şehir) üzerinden domain tahminleri üretir.
   * En basit V1 mantığı: slug.com, slug.com.tr, slugmimarlik.com.tr vs.
   */
  function guessDomainsForLead({ company_name, city }) {
    const baseSlug = slugifyName(company_name || "");
  
    if (!baseSlug) return [];
  
    const candidates = new Set();
  
    // temel varyantlar
    candidates.add(`${baseSlug}.com`);
    candidates.add(`${baseSlug}.com.tr`);
  
    // "mimarlik" içermiyorsa ek varyant
    if (!baseSlug.includes("mimarlik")) {
      candidates.add(`${baseSlug}mimarlik.com`);
      candidates.add(`${baseSlug}mimarlik.com.tr`);
    }
  
    // şehir bazlı varyant (çok agresif değiliz, sadece 1–2 örnek)
    if (city) {
      const citySlug = slugifyName(city);
      if (citySlug) {
        candidates.add(`${baseSlug}${citySlug}.com`);
        candidates.add(`${baseSlug}${citySlug}.com.tr`);
      }
    }
  
    // URL formatına çevir (https:// + www. / çıplak)
    const urls = new Set();
    for (const domain of candidates) {
      urls.add(`https://www.${domain}`);
      urls.add(`https://${domain}`);
    }
  
    return Array.from(urls);
  }
  
  module.exports = {
    slugifyName,
    guessDomainsForLead,
  };