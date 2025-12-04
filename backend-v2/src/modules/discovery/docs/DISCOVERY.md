
# Discovery Module — v2.1.0

Discovery modülü, CNG AI Agent’ın potansiyel firma bulma ve temel zenginleştirme motorudur.

---

## 🎯 Amaç
Google Places ve ek veri kaynaklarından sektör bağımsız potansiyel firmaları toplayarak:
- Normalize eder
- AI analizine hazır hale getirir
- Lead tablosuna kaydeder
- Eksik AI alanlarını tamamlamak için `aiRanker` pipeline’ını tetikler

---

## 🔧 Teknik Yapı
**Ana bileşenler:**

### 1) `placesClient.js`
Google Places API istemcisi.  
Firmaları arar, normalize eder ve discovery pipeline’a döner.

### 2) `repo.js`
DB erişim katmanı.

Fonksiyonlar:
- `listLeads()`
- `findRecentLeads()`
- `findLeadsWithoutAI()`
- `updateLeadAIFields()`
- `upsertLeadFromPlace()`

### 3) `aiRanker.js`
Lider AI sınıflandırma motoru.  
Firmayı kategorize eder, skorlar ve notlar üretir.

### 4) `service.js`
Operasyon akışının ana merkezi.

### 5) `routes.js`
REST API:
- `/scan-places`
- `/missing-ai`
- `/recent`

---

## 🔗 Research Modülü ile Entegrasyon
Discovery → Research veri akışı tamamen optimize edildi.  
Research artık `getLeadById()` yerine discovery repository’i merkezde kullanıyor.

---

## 🔥 Son Güncellemeler
Discovery modülü artık Research ile tam entegre:
- Lead verileri Research’ün yeni CIR pipeline’ına doğru biçimde taşınıyor
- Repo yapısı Research tarafından kullanılabilir hale getirildi
- Eski backend ile uyum katmanı eklendi

---

# 📌 CHANGELOG (v2.1.0)

## Added
- Research modülü ile entegre lead getter
- Repo yapısında küçük düzeltmeler
- CIR pipeline uyumluluğu sağlandı

## Updated
- AI ranker daha tutarlı hale getirildi
- Discovery response formatı genişletildi

## Version
```
v2.1.0
```

------------

# DISCOVERY MODULE – Full Technical Documentation
**Module Version:** v1.0.0  
**Last Update:** 2025-12-02  
**Maintainer:** CNG AI Agent Backend Team

---

# 📌 1. Purpose (Modülün Amacı)

Discovery modülü, sistemin **potansiyel müşteri keşif motorudur**.  
Görevi:

- Google Places ve diğer kaynaklardan *firma adaylarını bulmak*  
- Bu firmaları normalize ederek **lead** tablosuna kaydetmek  
- Eksik bilgileri AI ile tamamlamak  
- Aday firmaları *ajans için iş potansiyeli taşıyan müşterilere dönüştürecek* ön analizleri yapmak

Discovery modülü, satış funnel’ının **en üst aşaması**dır (TOFU – Top of Funnel).

---

# 📌 2. Responsibilities (Sorumluluklar)

Discovery modülü şu görevleri üstlenir:

### ✔ 1. Firma Keşfi  
- Google Places API üzerinden sektör, kategori, konum bazlı tarama  
- Binlerce firmanın otomatik olarak bulunması

### ✔ 2. Veri Normalize Etme  
- Name, address, city parsing  
- Category → AI destekli sınıflandırma  
- Rating, review count, website bilgileri

### ✔ 3. Lead DB Yönetimi  
- Yeni lead ekleme  
- Var olanı güncelleme  
- Duplicate engelleme (place_id veya website bazlı)

### ✔ 4. AI Destekli Önişleme  
- Firma türü sınıflandırması: *mimarlık, inşaat, güzellik, restoran, ofis, hizmet sektörü…*  
- Potansiyel tahmini → ai_score  
- AI açıklaması → ai_notes

### ✔ 5. Yönetimsel Özellikler  
- Pagination  
- Health check  
- Eksik AI bilgilerini toplu işleme

---

# 📌 3. Technical Architecture

```
/api
  discoveryRoutes.js        → Endpoint tanımları

/controller
  discoveryController.js    → Input parsing, hata yönetimi

/service
  discoveryService.js       → Google import, pagination, AI ranking

/repo
  leadRepository.js         → SQLite DB işlemleri (CRUD)

/ai
  prompts/                  → AI için kullanılan discovery promptları

/docs
  DISCOVERY.md              → Modül dokümanı  
  CHANGELOG.md              → Sürüm geçmişi
```

---

# 📌 4. Data Flow (İş Akışı)

```
Google API → discoveryService.import → leadRepository.save →  
AI category/ranking → DB → /api/discovery/leads → Client
```

---

# 📌 5. Core Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|-----------|
| **POST** | `/api/discovery/import-google` | Google Places üzerinden lead keşfi |
| **GET** | `/api/discovery/leads?page=&pageSize=` | Lead listeleme |
| **POST** | `/api/discovery/ai-rank-missing` | Eksik AI skorlarını tamamlar |
| **GET** | `/api/discovery/health` | Sistem durumu |

---

# 📌 6. Dependencies

- `shared/db/sqlite.js`
- `shared/ai/llmClient.js`
- `shared/web/googlePlacesClient.js`
- `shared/utils/pagination.js`

---

# 📌 7. AI Prompts

### `prompts/discovery/rank_by_metadata.md`
- Google verilerinden (rating, category, review count, address) anlamlı skor üretir.
- AI Category belirler.
- Ajans için potansiyel analizini çıkarır.

---

# 📌 8. Known Limitations

- Google Places bulk limits → 60 saniyelik kotalar
- Bazı firmalarda website olmayabilir
- Kategori eşleşmeleri ülkeden ülkeye değişebilir
- Çok büyük veri setlerinde pagination yavaşlayabilir

---

# 📌 9. Future Improvements

- LinkedIn / Yandex / Bing Places desteği  
- Sektör bazlı otomatik keşif profilleri  
- Batch discovery scheduler (cron jobs)  
- Multi-region discovery (İstanbul, Ankara, İzmir otomatik)  
- “Lead Quality Score v2” çok değişkenli AI modeli

---

# 📌 10. Versioning History
(Bkz. CHANGELOG.md)