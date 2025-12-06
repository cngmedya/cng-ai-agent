
# CHANGELOG – Research Module (CIR)

## [1.3.0] – 2025-12-05
- Yeni `competitorsService.js` eklendi:
  - `potential_leads` tablosundan aynı şehir ve kategoriye göre rakip tespiti.
  - Her rakip için 0–100 arası `competitor_strength_score` hesaplanması.
  - Skor bileşenleri: web sitesi varlığı, AI skoru, kategorik eşleşme, şehir eşleşmesi, OSINT yoğunluğu.
- Yeni `benchmarkService.js` eklendi:
  - Rakip skorlarından pazar benchmark skoru üretimi.
  - `benchmark_score`, `strengths_vs_market`, `weaknesses_vs_market` alanlarının oluşturulması.
- `researchService.generateFullResearch`:
  - `findCompetitors(lead, web_presence)` ve `benchmarkLead(lead, competitors)` ile entegre edildi.
  - `raw.competitors` ve `raw.benchmark` alanları LLM’e giden payload’a eklendi.

## [1.2.0] – 2025-12-05
- `socialsService.js` tamamen yenilendi:
  - Lead websitesinden HTML tarayıp sosyal medya linkleri çıkarma.
  - `web_presence.third_party_profiles` ile OSINT tabanlı sosyal link birleştirme.
  - Instagram, Facebook, LinkedIn, YouTube, TikTok için URL tespiti.
  - Bulunan platform sayısına göre `activity_score` (0–100) üretimi.
- `adsService.js` modülü tanımlandı:
  - Temel pixel / analytics sinyallerinin tespiti (Facebook Pixel, Google Analytics vb.).
  - `ad_intel` objesi ile CIR içine özet aktarma.
- `RESEARCH.md` modül dokümantasyonu sosyal medya ve reklam istihbaratı akışını içerecek şekilde güncellendi.

## [1.1.0] – 2025-12-04
- CIR raporları için `lead_intel_reports` tablosu eklendi.
- Her `full-report` çağrısında CIR sonucu DB’ye yazılmaya başlandı.
- `GET /api/research/history/:leadId` endpoint’i eklendi.
- `potential_leads` tablosuna `last_cir_score` ve `last_cir_created_at` alanları eklendi.

## [1.0.0] – 2025-12-03
- Temel CIR pipeline kuruldu:
  - intel_basic + intel_deep + web_search + basit social/ad/competitor/benchmark iskeleti.
  - LLM ile tek JSON rapor üretimi.