// backend/src/modules/lead-acquisition/utils/domainGuess.js

// Türkçe karakterleri sadeleştirip sade bir slug üretir
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
  
    // çok genel kelimeleri ayıklayalım
    s = s.replace(/mimarlık ofisi/g, "mimarlık");
    s = s.replace(/mimarlik ofisi/g, "mimarlik");
    s = s.replace(/iç mimarlık/g, "ic mimarlik");
    s = s.replace(/ic mimarlık/g, "ic mimarlik");
    s = s.replace(/icmimarlık/g, "icmimarlik");
    s = s.replace(/istanbul/g, "");
    s = s.replace(/proje tasarım ve uygulama/g, "");
    s = s.replace(/proje tasarim ve uygulama/g, "");
    s = s.replace(/proje tasarım/g, "");
    s = s.replace(/proje tasarim/g, "");
    s = s.replace(/tasarım/g, "");
    s = s.replace(/tasarim/g, "");
    s = s.replace(/ofisi/g, "");
    s = s.replace(/sanayi ve ticaret a\.?ş\.?/g, "as");
    s = s.replace(/a\.?ş\.?/g, "as");
    s = s.replace(/limited şirketi/g, "ltd");
    s = s.replace(/ltd ?şti/g, "ltd");
  
    // harf ve rakam dışı her şeyi boşluk yap
    s = s.replace(/[^a-z0-9\s]/g, " ");
    // birden fazla boşluğu tek boşluğa indir
    s = s.replace(/\s+/g, " ").trim();
    // boşlukları tamamen kaldır
    s = s.replace(/\s+/g, "");
  
    return s;
  }
  
  /**
   * Firma adı (ve opsiyonel şehir) üzerinden domain tahminleri üretir.
   * V1 mantığı: slug.com, slug.com.tr, slugmimarlik.com(.tr), slug+city.com(.tr)
   *
   * @param {string} company_name
   * @param {string} [city]
   * @returns {string[]} URL listesi (https://... formatında)
   */
  function guessDomainsForLead(company_name, city) {
    const baseSlug = slugifyName(company_name || "");
  
    if (!baseSlug) return [];
  
    const domains = new Set();
  
    // temel varyantlar
    domains.add(`${baseSlug}.com`);
    domains.add(`${baseSlug}.com.tr`);
  
    // "mimarlik" içermiyorsa ekstra mimarlik eklemeyi dene
    if (!baseSlug.includes("mimarlik")) {
      domains.add(`${baseSlug}mimarlik.com`);
      domains.add(`${baseSlug}mimarlik.com.tr`);
    }
  
    // şehir varsa şehirle kombine et (çok agresif değiliz şimdilik)
    if (city) {
      const citySlug = slugifyName(city);
      if (citySlug) {
        domains.add(`${baseSlug}${citySlug}.com`);
        domains.add(`${baseSlug}${citySlug}.com.tr`);
      }
    }
  
    // domain → URL
    const urls = new Set();
    for (const d of domains) {
      urls.add(`https://www.${d}`);
      urls.add(`https://${d}`);
    }
  
    return Array.from(urls);
  }
  
  module.exports = {
    slugifyName,
    guessDomainsForLead,
  };