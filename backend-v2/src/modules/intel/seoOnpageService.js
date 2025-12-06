// backend-v2/src/modules/intel/seoOnpageService.js
//
// SEO On-Page Analyzer v1.0
// - Website snapshot üzerinden basit teknik SEO skoru üretir
// - ÇIKTI formatı lead_deep_website_analysis.md ile uyumlu:
//   {
//     onpage_score: 0-100,
//     issues: [...],
//     suggestions: [...],
//     raw: {
//       hasTitle: bool,
//       titleLength: number,
//       hasMetaDescription: bool,
//       headingCount: number
//     }
//   }

function analyzeOnpage(websiteSnapshot) {
    const snapshot = websiteSnapshot || {};
  
    // Website hiç yok veya fetch hata verdiyse
    if (snapshot.error) {
      return {
        onpage_score: 0,
        issues: [
          'Website içeriğine erişilemedi, teknik SEO analizi yapılamadı.'
        ],
        suggestions: [
          'Önce web sitesinin erişilebilir olduğundan emin olun (SSL, hosting, yönlendirmeler).',
          'Ardından temel SEO için title, meta description ve başlık yapısını kontrol edin.'
        ],
        raw: {
          hasTitle: false,
          titleLength: 0,
          hasMetaDescription: false,
          headingCount: 0
        }
      };
    }
  
    const title = (snapshot.title || '').trim();
    const metaDescription =
      (snapshot.metaDescription ||
        snapshot.meta_description ||
        '').trim();
    const headings = Array.isArray(snapshot.headings)
      ? snapshot.headings
      : [];
  
    const raw = {
      hasTitle: !!title,
      titleLength: title.length,
      hasMetaDescription: !!metaDescription,
      headingCount: headings.length
    };
  
    const issues = [];
    const suggestions = [];
  
    let score = 80; // nötr bir başlangıç noktasından
  
    // Title kontrolü
    if (!raw.hasTitle) {
      score -= 25;
      issues.push('Sayfada title etiketi bulunmuyor.');
      suggestions.push(
        'Her sayfa için marka + ana hizmeti içeren özgün bir title etiketi ekleyin.'
      );
    } else {
      if (raw.titleLength < 20) {
        score -= 10;
        issues.push('Title çok kısa, arama sonuçlarında yeterince açıklayıcı değil.');
        suggestions.push(
          'Title uzunluğunu yaklaşık 40–60 karakter aralığında, hem marka hem anahtar kelimeyi içerecek şekilde güncelleyin.'
        );
      } else if (raw.titleLength > 70) {
        score -= 5;
        issues.push('Title çok uzun, arama sonuçlarında kesilebilir.');
        suggestions.push(
          'Title’ı 60–70 karakter bandında tutarak en kritik mesajı öne çıkarın.'
        );
      } else {
        score += 5; // ideal band
      }
    }
  
    // Meta description kontrolü
    if (!raw.hasMetaDescription) {
      score -= 20;
      issues.push('Meta description eksik.');
      suggestions.push(
        'Her önemli sayfa için 120–160 karakter arası, CTA içeren ve hedef anahtar kelimeleri barındıran bir meta description yazın.'
      );
    }
  
    // Heading yapısı kontrolü
    if (raw.headingCount === 0) {
      score -= 10;
      issues.push('Sayfada hiç başlık etiketi (H1–H6) tespit edilmedi.');
      suggestions.push(
        'İçeriği H1–H2–H3 hiyerarşisiyle bölümlere ayırın; H1’de ana konu, alt başlıklarda detaylar olsun.'
      );
    } else if (raw.headingCount < 3) {
      score -= 5;
      issues.push('Başlık yapısı zayıf, az sayıda başlık kullanılmış.');
      suggestions.push(
        'Uzun içerikleri daha fazla H2/H3 başlıkla bölerek hem okunabilirliği hem SEO performansını artırın.'
      );
    } else {
      score += 5;
    }
  
    // Minimum / maksimum clamp
    if (score < 0) score = 0;
    if (score > 100) score = 100;
  
    // Teknik issue çıkmadıysa bile en az bir “iyileştirme” önerisi verelim
    if (issues.length === 0) {
      suggestions.push(
        'Mevcut teknik yapı fena değil, şimdi odağı içerik kalitesi ve kullanıcı niyetine uygun anahtar kelime optimizasyonuna kaydırabilirsiniz.'
      );
    }
  
    return {
      onpage_score: score,
      issues,
      suggestions,
      raw
    };
  }
  
  module.exports = {
    analyzeOnpage
  };