// backend/src/modules/lead-acquisition/services/leadScoreService.js

/**
 * Küçük helper: URL'den hostname ve “root” domain çıkar
 * Örn: https://www.dominand.com -> { host: "www.dominand.com", root: "dominand" }
 */
function extractDomainInfo(website) {
    if (!website) {
      return { host: null, root: null };
    }
  
    try {
      const url = new URL(website);
      const host = url.hostname.toLowerCase(); // örn: www.dominand.com
      let root = host;
  
      // www. prefixini at
      if (root.startsWith("www.")) {
        root = root.slice(4);
      }
  
      // sondaki .com, .com.tr, .net, .org vs'yi atmak için ilk parçayı al
      const parts = root.split(".");
      if (parts.length > 1) {
        root = parts[0]; // dominand
      }
  
      return { host, root };
    } catch (_) {
      return { host: null, root: null };
    }
  }
  
  /**
   * Domain markalaşma kalitesini değerlendir
   * - 3–15 karakter arası kök isim iyi
   * - Çok uzun, sayılı veya garip karakterliyse ceza
   */
  function scoreDomainBrandQuality(website, notes) {
    const { root } = extractDomainInfo(website);
    if (!root) {
      notes.push("Domain çözümlenemedi.");
      return 0;
    }
  
    const len = root.length;
  
    // tamamen sayısal domainler pek sevilmez
    const isNumeric = /^[0-9]+$/.test(root);
  
    if (len >= 3 && len <= 15 && !isNumeric) {
      notes.push(`Domain markalaşmaya uygun: ${root}`);
      return 15;
    }
  
    if (len > 20 || isNumeric) {
      notes.push(`Domain ismi zayıf / spam hissi veriyor: ${root}`);
      return 2;
    }
  
    notes.push(`Orta seviye domain kalitesi: ${root}`);
    return 8;
  }
  
  /**
   * Website Intel V2 skor katkısı
   */
  function scoreWebsiteIntel(websiteIntel, notes) {
    if (!websiteIntel) {
      return 0;
    }
  
    const { httpStatus, meta } = websiteIntel;
    let score = 0;
  
    if (typeof httpStatus === "number") {
      if (httpStatus >= 200 && httpStatus < 300) {
        notes.push(`Website erişilebilir (HTTP ${httpStatus}).`);
        score += 15;
      } else if (httpStatus >= 300 && httpStatus < 400) {
        notes.push(`Website yönlendirme yapıyor (HTTP ${httpStatus}).`);
        score += 8;
      } else {
        notes.push(`Website HTTP durumu zayıf: ${httpStatus}.`);
        score += 0;
      }
    } else {
      notes.push("Website HTTP durumu tespit edilemedi.");
    }
  
    if (meta && meta.seo && typeof meta.seo.score === "number") {
      const seoScore = meta.seo.score; // 0–100
      const seoBonus = Math.round((seoScore / 100) * 10); // max +10
      score += seoBonus;
      notes.push(`SEO skoru ~${seoScore}/100 → +${seoBonus} puan.`);
    }
  
    return score;
  }
  
  /**
   * Reputation / dijital itibar skor katkısı
   */
  function scoreReputation(reputation, notes) {
    if (!reputation) {
      notes.push("Dijital itibar analizi (reputation) henüz yok.");
      return 0;
    }
  
    const { reputation_score, risk_level } = reputation;
    if (typeof reputation_score !== "number") {
      notes.push("Reputation skor formatı eksik.");
      return 0;
    }
  
    // 0–100 → max +15 puan
    let base = Math.round((reputation_score / 100) * 15);
  
    if (risk_level === "high") {
      notes.push(
        `Reputation skoru ${reputation_score}, risk seviyesi HIGH → ceza.`
      );
      base = Math.max(base - 5, 0);
    } else if (risk_level === "medium") {
      notes.push(
        `Reputation skoru ${reputation_score}, risk seviyesi MEDIUM.`
      );
    } else if (risk_level === "low") {
      notes.push(
        `Reputation skoru ${reputation_score}, risk seviyesi LOW → bonus.`
      );
      base += 2;
    }
  
    return base;
  }
  
  /**
   * V2 Lead Score hesaplayıcı
   *
   * Input:
   *  - lead: potential_leads satırı (company_name, website, phone, address, city, category)
   *  - options.websiteIntel: (opsiyonel) website_intel kaydı
   *  - options.reputation: (opsiyonel) lead_reputation_insights kaydı
   *  - options.searchIntel: (opsiyonel) lead_search_intel kaydı (şimdilik bilgi için)
   *
   * Output:
   *  {
   *    score: 0–100,
   *    notes: [ ...madde madde açıklamalar... ]
   *  }
   */
  function computeLeadScore(lead, options = {}) {
    const {
      websiteIntel = null,
      reputation = null,
      searchIntel = null, // ileride kullanırız
    } = options;
  
    const notes = [];
    let score = 0;
  
    if (!lead) {
      return { score: 0, notes: ["Lead verisi yok."] };
    }
  
    const {
      company_name,
      website,
      phone,
      address,
      city,
      category,
    } = lead;
  
    // 1) Veri tamlığı (max ~40 puan)
    if (website) {
      score += 10;
      notes.push("Website mevcut.");
    } else {
      notes.push("Website alanı boş → büyük eksi.");
    }
  
    if (phone) {
      score += 10;
      notes.push("Telefon bilgisi var.");
    } else {
      notes.push("Telefon bilgisi eksik.");
    }
  
    if (address && city) {
      score += 10;
      notes.push("Adres + şehir bilgisi var.");
    } else if (address || city) {
      score += 5;
      notes.push("Adres/şehir kısmen mevcut.");
    } else {
      notes.push("Adres ve şehir bilgisi eksik.");
    }
  
    if (category) {
      score += 5;
      notes.push("Kategori bilgisi var.");
    } else {
      notes.push("Kategori bilgisi eksik.");
    }
  
    if (company_name) {
      const len = company_name.length;
      if (len >= 3 && len <= 70) {
        score += 5;
        notes.push("Firma adı okunabilir uzunlukta.");
      } else {
        notes.push("Firma adı çok kısa/uzun, okunabilirliği zayıf.");
      }
    }
  
    // 2) Domain markalaşma kalitesi (max 15)
    if (website) {
      score += scoreDomainBrandQuality(website, notes);
    }
  
    // 3) Website Intel katkısı (max ~25)
    score += scoreWebsiteIntel(websiteIntel, notes);
  
    // 4) Reputation katkısı (max ~15)
    score += scoreReputation(reputation, notes);
  
    // 5) Search intel varsa (şimdilik sadece not düşelim)
    if (searchIntel) {
      const { mentions_count, complaints_count } = searchIntel;
      if (typeof mentions_count === "number") {
        notes.push(`Google arama görünürlüğü: ~${mentions_count} sonuç.`);
      }
      if (typeof complaints_count === "number" && complaints_count > 0) {
        notes.push(
          `Şikayet kaydı tespit edildi: ${complaints_count} adet (reputation skoruna zaten yansıyor).`
        );
      }
    }
  
    // Clamp 0–100
    if (score < 0) score = 0;
    if (score > 100) score = 100;
  
    return { score, notes };
  }
  
  module.exports = {
    computeLeadScore,
  };