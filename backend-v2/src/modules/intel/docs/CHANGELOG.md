# Intel Module – CHANGELOG

## v1.3.0 – 2025-12-04
- Yeni `seoOnpageService.js` eklendi:
  - Website snapshot üzerinden basit teknik on-page SEO skoru (`onpage_score`) üretir.
  - Title, meta description ve heading sayısına göre issue/suggestion listesi oluşturur.
  - Çıktı formatı `seo_onpage` nesnesiyle standardize edildi.
- `analyzeLeadDeep` fonksiyonu güncellendi:
  - `seo_onpage` verisini hem AI prompt’una hem de API cevabına ekliyor.
  - Website erişim hatalarında SEO skoru 0 ve anlamlı issue/suggestion seti üretilecek şekilde güvenli hale getirildi.

## v5.1.0 (2025-12-03)
### Added
- Deep website analizi için "seo_onpage" desteği eklendi.
- lead_deep_website_analysis.md promptu tamamen yeniden tasarlandı.
- Website snapshot → title, meta description, headings, text, errors yapısı güncellendi.

### Improved
- Deep intel raporu içine SEO değerlendirmesi, eksikler, öneriler, keyword önerileri dahil edildi.
- Website-based SWOT iyileştirildi.
- Intel çıktısı Research pipeline ile tam uyumlu hale getirildi.

### Fixed
- fetchWebsiteSnapshot hata yakalama ve error forward mekanizması iyileştirildi.

---

## v1.0.0 — 2025-12-02
### 🎉 Initial Release
- Quick intel pipeline tamamlandı.
- Deep intel framework kuruldu.
- fetchWebsiteSnapshot entegre edildi.
- On-page SEO rule-based analiz eklendi.
- lead_deep_website_analysis.md tamamen yeniden tasarlandı.
- JSON zorunluluğu olan AI output pipeline eklendi.
- Ajans fırsatları + satış notları + stratejik rapor sistemi tamamlandı.
- İlk sürüm dokümantasyonu oluşturuldu.