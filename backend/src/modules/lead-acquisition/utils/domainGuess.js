const STOPWORDS = [
    "istanbul","ankara","izmir","bursa","antalya","adana","konya",
    "ataşehir","besiktas","sisli","kadikoy","uskudar","34750","34700","34000",
    "mimarlikofisi","ofisi","proje","tasarim","dekorasyon"
  ];
  
  function cleanCompanyName(name = "") {
    if (!name) return "";
  
    let s = name.toLowerCase();
  
    const map = { ç:"c", ğ:"g", ı:"i", ö:"o", ş:"s", ü:"u" };
    s = s.split("").map(ch => map[ch] || ch).join("");
  
    // kelimelere ayır
    let words = s.split(/[^a-z0-9]+/g).filter(Boolean);
  
    // stopword, ilçe, posta kodu vs. temizle
    words = words.filter(w => !STOPWORDS.includes(w));
  
    // sadece ilk 1–2 kelimeyi al
    const core = words.slice(0, 2).join("");
  
    // max 12 karakter
    return core.slice(0, 12);
  }
  
  function guessDomainsForLead(company_name) {
    const slug = cleanCompanyName(company_name);
  
    if (!slug) return [];
  
    const domains = [
      `https://www.${slug}.com`,
      `https://www.${slug}.com.tr`,
      `https://${slug}.com`
    ];
  
    return domains.slice(0, 3);
  }
  
  module.exports = { cleanCompanyName, guessDomainsForLead };