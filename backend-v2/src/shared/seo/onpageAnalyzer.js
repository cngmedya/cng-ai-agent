// backend-v2/src/shared/seo/onpageAnalyzer.js

/**
 * Basit on-page SEO analizi.
 * Girdi:
 *  - websiteSnapshot: fetchWebsiteSnapshot çıktısı
 *  - lead: DB'deki lead (kategori, adres vs.)
 */
function analyzeOnPageSeo({ websiteSnapshot, lead }) {
    const issues = [];
    const suggestions = [];
    let score = 100;
  
    const title = websiteSnapshot.title || '';
    const desc = websiteSnapshot.metaDescription || '';
    const headings = websiteSnapshot.headings || [];
    const text = websiteSnapshot.textSnippet || '';
  
    const hasTitle = title.length > 0;
    const hasDesc = desc.length > 0;
    const h1Count = headings.length; // çok kaba: h1/h2/h3 birlikte
  
    // Title kontrolleri
    if (!hasTitle) {
      score -= 25;
      issues.push('Title (sayfa başlığı) eksik.');
      suggestions.push('Sektör + şehir içeren, 40–60 karakter arası bir title yazılmalı.');
    } else {
      if (title.length < 30 || title.length > 65) {
        score -= 5;
        issues.push('Title uzunluğu ideal aralıkta değil.');
        suggestions.push('Title yaklaşık 40–60 karakter aralığında olacak şekilde güncellenmeli.');
      }
    }
  
    // Meta description
    if (!hasDesc) {
      score -= 15;
      issues.push('Meta description eksik.');
      suggestions.push('Arama sonuçlarında görünen açıklama metni (meta description) eklenmeli, 120–160 karakter arası olmalı.');
    }
  
    // Başlıklar
    if (h1Count === 0) {
      score -= 10;
      issues.push('Sayfada anlamlı başlık yapısı (H1/H2) görünmüyor.');
      suggestions.push('İçerik H1 ve H2 başlıklarıyla bölümlere ayrılmalı.');
    }
  
    // Sektör & şehir uyumu (çok basit heuristik)
    const sectorHint = lead.ai_category || lead.category || '';
    const cityHint = lead.city || '';
  
    const combinedText = (title + ' ' + desc + ' ' + headings.join(' ') + ' ' + text).toLowerCase();
    if (sectorHint && !combinedText.toLowerCase().includes(sectorHint.toLowerCase())) {
      score -= 10;
      issues.push('Site içeriği firmayı temsil eden sektör ifadesini yeterince vurgulamıyor gibi görünüyor.');
      suggestions.push(`İçerikte "${sectorHint}" ifadesi başlık ve metinlerde daha net yer almalı.`);
    }
  
    if (cityHint && !combinedText.toLowerCase().includes(cityHint.toLowerCase())) {
      // cityHint şu an "34758 Ataşehir/İstanbul" gibi olabilir; ileride normalize edebiliriz
      score -= 5;
      issues.push('Site içeriğinde lokasyon (şehir/ilçe) yeterince vurgulanmıyor.');
      suggestions.push('Title, description ve içerikte şehrin/ilçenin adı hedeflenmeli.');
    }
  
    if (score < 0) score = 0;
    if (score > 100) score = 100;
  
    return {
      onpage_score: score,
      issues,
      suggestions,
      raw: {
        hasTitle,
        titleLength: title.length,
        hasMetaDescription: hasDesc,
        headingCount: h1Count
      }
    };
  }
  
  module.exports = {
    analyzeOnPageSeo
  };