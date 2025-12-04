# Research Module – CHANGELOG

## v1.1.0 (2025-12-03)
### Added
- lead_cir_reports tablosu eklendi.
- CIR raporlarının otomatik DB'ye kaydedilmesi eklendi.
- /api/research/history/:leadId endpoint’i eklendi.
- Hem basic intel hem deep intel hem OSINT hem Ads hem Social hem Benchmark birleşimiyle full "CNG Intelligence Report" üretimi stabil hale getirildi.
- research_master_prompt sistem içine taşındı (fs bağımlılığı kaldırıldı).

### Fixed
- Wrong import path for discovery repo resolved.
- API route’da “router not defined” hatası düzeltildi.

### Notes
Research modülü artık uçtan uca çalışan tam bir “premium intelligence engine” durumundadır.
---

## v1.1.0 — 2025-12-03
### Premium Web Search (OSINT) Engine
- websearchService.js tamamen yeniden tasarlandı.
- SerpAPI + Bing entegrasyonuna hazır hale getirildi.
- Sonuç normalizasyonu, URL deduplication ve type classification eklendi.
- Sosyal medya ve platform tespiti (Instagram, Facebook, LinkedIn, YouTube, TikTok, Behance, Dribbble, Archilovers, Houzz, Pinterest) entegre edildi.
- Risk & reputasyon scanner (şikayet, scam, dava vb.) eklendi.
- CIR için “web_presence” çıktısı zenginleştirildi:
  - directories
  - news_mentions
  - blog_mentions
  - third_party_profiles
  - search_keywords_detected
  - risk_or_reputation_flags

---

## v1.0.0 — 2025-12-02
### 🎉 Initial Release (CIR v1 Engine)
- Research modülü tamamen oluşturuldu.
- Klasör mimarisi kuruldu (api, controller, service, repo, ai, docs).
- CNG Intelligence Report (CIR) resmi formatı tanımlandı.
- Master prompt: research_master_prompt.md oluşturuldu.
- `/api/research/full-report` endpoint’i eklendi.
- Web search, sosyal medya, reklam, rakip analizi ve benchmark için servis iskeletleri kuruldu.
- CIR JSON yapısı zorunlu format olarak tanımlandı.
- Modül bağımsız versionlama sistemine alındı.
- RESEARCH.md (tam dokümantasyon) hazırlandı.