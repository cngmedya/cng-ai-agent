// backend/src/modules/lead-acquisition/utils/domainGuess.js

// Şehir, posta kodu vb. olarak elemek istediğimiz sık geçen kelimeler
const STOPWORDS = [
    // şehirler / ilçeler (normalize edilmiş halleri)
    "istanbul",
    "ankara",
    "izmir",
    "bursa",
    "antalya",
    "adana",
    "konya",
    "gaziantep",
    "kocaeli",
    "kayseri",
    "eskisehir",
    "mersin",
    "diyarbakir",
    "trabzon",
    "hatay",
    "samsun",
    "balikesir",
    "karşıyaka",
    "karsiyaka",
    "atakum",
  
    // İstanbul ilçeleri yaygın örnekler
    "atasehir",
    "besiktas",
    "sisli",
    "kadikoy",
    "uskudar",
    "umraniye",
    "kartal",
    "maltepe",
    "pendik",
    "bakirkoy",
    "bahcelievler",
    "bagcilar",
    "kucukcekmece",
    "avcilar",
    "sariyer",
    "eyupsultan",
    "eyup",
  
    // generic kelimeler
    "turkiye",
    "istanbultr",
    "company",
    "co",
    "ticaret",
    "sanayi",
    "sanayiiticaret",
    "sanayiotic",
    "ve",
    "limited",
    "ltd",
    "sti",
    "st",
    "as",
    "sirketi",
    "kurumsal",
  
    // sektör bağımsız generic
    "ofisi",
    "ofis",
    "merkez",
    "sube",
    "subesi",
    "ny",
    "tr",
  
    // mimarlık/benzeri fazlalıklar (çok genel)
    "mimarlikofisi",
    "proje",
    "tasarim",
    "dekorasyon"
  ];
  
  // Türkçe karakterleri sadeleştirip kelime listesi çıkarır
  function normalizeToWords(name = "") {
    if (!name) return [];
  
    let s = name.toLowerCase();
  
    const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
    s = s
      .split("")
      .map((ch) => map[ch] || ch)
      .join("");
  
    // kelimelere böl
    let words = s.split(/[^a-z0-9]+/g).filter(Boolean);
  
    // stopword ve tamamen sayısal token'ları ele
    words = words.filter((w) => {
      if (!w) return false;
      if (/^\d+$/.test(w)) return false; // sadece rakam ise at
      if (STOPWORDS.includes(w)) return false;
      return true;
    });
  
    return words;
  }
  
  /**
   * Şirket adını temizleyip kısa bir "core" slug üretir.
   * Örn: "Onallar Mimarlık 34750 Ataşehir İstanbul"
   *  -> "onallarmimarlik" (max 12 karaktere kırpılmış)
   */
  function cleanCompanyName(name = "") {
    const words = normalizeToWords(name);
  
    if (!words.length) return "";
  
    // sadece ilk 1–2 kelimeyi kullan
    const core = words.slice(0, 2).join("");
  
    // max 12 karaktere düşür
    const MAX_LEN = 12;
    return core.slice(0, MAX_LEN);
  }
  
  /**
   * Firma adı üzerinden domain tahmini yapar.
   * - Çok kısa ve gerçekçi slug üretir
   * - Max 3 domain URL döner
   * - city parametresi şimdilik kullanılmıyor (API uyumluluğu için tutuluyor)
   *
   * @param {string} company_name
   * @param {string} [city] - şu an kullanılmıyor, ileride istenirse eklenebilir
   * @returns {string[]} URL listesi (https://... formatında)
   */
  function guessDomainsForLead(company_name, city) {
    const slug = cleanCompanyName(company_name || "");
  
    if (!slug) return [];
  
    const urls = [];
  
    // temel, gerçekçi varyantlar
    urls.push(`https://www.${slug}.com`);
    urls.push(`https://www.${slug}.com.tr`);
    urls.push(`https://${slug}.com`);
  
    // max 3 adet garanti
    return urls.slice(0, 3);
  }
  
  module.exports = {
    normalizeToWords,
    cleanCompanyName,
    guessDomainsForLead,
  };