

# Changelog
All notable changes to this repository will be documented in this file.

## [2025-12-19]

### Yapılanlar
- Godmode FAZ 2 kapsamındaki discovery pipeline ve provider akışı stabilize edildi.
- Google Places üzerinden live veri erişimi doğrulandı, güvenli test stratejisi netleştirildi.
- `providersRunner` ve provider katmanlarında kontrollü çalışma disiplini sağlandı.
- Smoke test uçtan uca başarıyla tamamlandı:
  - Discovery
  - Research
  - Outreach v2
  - CIR (CNG Intelligence Report)
- Outreach v2 ve CIR üretiminde yaşanan hatalar giderildi.
- Veritabanı path tutarsızlıkları tamamen temizlendi:
  - Canonical DB yapısı netleştirildi: `data/app.sqlite` ve `data/crm.sqlite`
  - `src/data` altındaki eski referanslar yalnızca symlink/legacy uyumluluk amacıyla bırakıldı.
- Migration ve eski lead taşıma scriptleri kontrol edildi ve doğrulandı.
- Master doküman ve Godmode roadmap, sistemin güncel gerçekliğiyle senkronize edildi.

### Teknik Notlar
- DB erişimiyle ilgili olası future sorunlar için çözüm yolu artık net.
- Smoke test yeşil olmadan yeni faza geçilmeyeceği kuralı tekrar teyit edildi.
- FAZ 2’de bir sonraki adım: **Deduplication & Freshness Policy**.