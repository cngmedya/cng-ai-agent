# Discovery Module – CHANGELOG

## v2.0.1 (2025-12-03)
### Fixed
- discovery/repo import path sorunları düzeltildi (research modülü entegrasyonu için).
- Module path normalization yapıldı.

### Notes
Discovery modülünde core fonksiyonel değişiklik yapılmamış, yalnızca stabilite arttırılmıştır.


---

## v1.1.0 – Lead erişimi ve Research entegrasyonu
- `repo.js` içine `getLeadById(id)` fonksiyonu eklendi.
- Research modülünün, discovery veritabanındaki `potential_leads` üzerinden tekil lead okuması sağlandı.
- Discovery modülü artık sadece lead arama/çekme değil, aynı zamanda Research Engine için merkezi lead kaynağı olarak konumlandı.
- Mevcut fonksiyonların davranışı değiştirilmedi (`listLeads`, `countLeads`, `findLeadsWithoutAI`, `findRecentLeads`, `updateLeadAIFields`, `upsertLeadFromPlace`); sadece yeni, güvenli bir okuma fonksiyonu eklendi.

---

## v1.0.0 – İlk sürüm
- Google Places verilerinden `potential_leads` tablosuna kayıt alımı.
- AI alanları (`ai_category`, `ai_score`, `ai_notes`) için temel alan yapısı.
- Lead listeleme, sayma ve en son eklenenleri çekme için repository fonksiyonları.

---

## v1.0.0 — 2025-12-02
### 🎉 Initial Release
- Google Places discovery pipeline tamamlandı.
- Lead DB kayıt sistemi kuruldu.
- AI kategori + score ön değerlendirme sistemi eklendi.
- Eksik AI ranking tamamlayıcı fonksiyon (rank-missing) eklendi.
- Pagination sistemi uygulandı.
- Health endpoint ile modül monitoring eklendi.
- Modül dökümantasyonu & bağımsız versiyonlama aktif edildi.