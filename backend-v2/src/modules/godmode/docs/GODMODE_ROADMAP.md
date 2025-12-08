# GODMODE Discovery Engine — ROADMAP (v1.0)

Bu dosya, CNG AI Agent içerisinde yer alan **GODMODE Discovery Engine** modülünün full gelişim yol haritasıdır.  
Her aşama Production seviyesine uygun şekilde tasarlanmıştır ve tamamlanan maddeler işaretlenerek ilerleme takip edilir.

---

# 🟩 FAZ 1 — CORE DISCOVERY ENGINE (MVP → STABLE)

GODMODE'un temel iskeletinin kurulduğu fazdır. Bu faz tamamlandığında:

- Discovery işlerini başlatabilen
- İş durumlarını yöneten
- Mock ve gerçek veri arasında geçiş yapabilen
- Manual-run destekleyen
- Tek provider (Google Places) çalışan

tam bir MVP hazır olur.

---

## **1.A — CORE MODULE BOOTSTRAP**
Temel klasör, routing, servis ve controller yapıları.

### Görevler:
- [x] `modules/godmode/` klasör ağacı kuruldu
- [x] API → `/api/godmode/*` routing sistemi tamamlandı
- [x] Controller → temel endpointler oluşturuldu
- [x] Service → temel job yönetimi iskeleti yazıldı
- [x] Workers → 3 temel worker dosyası oluşturuldu  
  (`dataFeederWorker`, `entityResolverWorker`, `economicAnalyzerWorker`)
- [x] GODMODE.md ve ROADMAP.md oluşturuldu

---

## **1.B — JOB MANAGEMENT SYSTEM (Memory Store v1)**

Discovery işlerini memory üzerinde tutan prototip job sistemi.

### Görevler:
- [x] In-memory JOB STORE yazıldı
- [x] `/jobs` → tüm işlerin listesi
- [x] `/jobs/:id` → tek işin detayları
- [x] `/jobs/discovery-scan` → yeni discovery job oluşturma
- [x] Job creation → UUID + criteria snapshot
- [x] Job status: `queued`, `running`, `completed`, `failed`
- [x] Job progress alanları:  
  - percent  
  - found_leads  
  - enriched_leads  

---

## **1.C — MOCK DISCOVERY ENGINE → ÇALIŞIR HALE GETİRME**

Mock data ile çalışan discovery süreci.

### Görevler:
- [x] Mock provider oluşturuldu
- [x] Fake discovery sonuçları generate ediliyor
- [x] Fake enrichment hesaplaması yapılıyor
- [x] Job progress %100’e tamamlanıyor
- [x] Örnek lead listesi result_summary içerisine yazıldı
- [x] Manual run endpoint’i:  
  - `POST /jobs/:id/run`

---

## **1.D — REAL DISCOVERY (Google Places API v1)**

Mock discovery → Gerçek Google Places API entegrasyonuna taşındı.

### Görevler:
- [x] Provider: `google_places` eklendi
- [x] `live` / `mock` switch sistemi eklendi  
      Env: `GODMODE_PROVIDER_MODE=mock|live`
- [x] Places Text Search → gerçek data alınıyor
- [x] Place Detail → detaylı enrichment
- [x] Real sample leads → job summary içine yazıldı
- [x] Manual run gerçek data ile çalışıyor

---

## **1.E — CONFIGURATION SYSTEM (ENV + FLAGS)**

Discovery engine’in hem geliştirme hem prod ortamında yönetilebilmesi.

### Görevler:
- [x] `GODMODE_MAX_RESULTS`
- [x] `GODMODE_PROVIDER_MODE` (mock/live)
- [x] `GOOGLE_PLACES_API_KEY`
- [x] “provider info” admin paneline eklendi (backend endpoint)

---

## ❗ FAZ 1'DE KALAN SON BÜYÜK AŞAMA

# **1.F — JOB PERSISTENCE SYSTEM (SQLite v1.0)**  
🔴 *ŞU ANKİ DURUM: BAŞLAMADI — SIRADAKİ ADIM*

GODMODE, şu an memory store üzerinde çalışıyor.  
Bu kabul edilemez çünkü:

- Backend restart → tüm kayıtlar uçuyor  
- Discovery işleri 1–10 dakika sürebilir  
- Data analizi için geçmiş joblara ihtiyaç var  
- Faz 2’nin Data Orkestrasyon Sistemi için zorunlu

### Yapılacaklar:

#### **DB Şeması**
- [ ] `godmode_jobs`  
- [ ] `godmode_job_progress`  
- [ ] `godmode_job_results`

#### **Repo Layer**
- [ ] Job create → DB insert  
- [ ] Job update → DB update  
- [ ] Job load → DB’den tüm jobları memory'e hydrate et  
- [ ] Restart sonrası otomatik job reload

#### **Service Layer**
- [ ] In-memory → DB store hibrit modele geçiş  
- [ ] Yarım kalan jobları “failed” olarak işaretle  
- [ ] Summary / result yazma mekanizması

#### **Controller**
- [ ] Endpoint’ler DB ile tam entegre hale getirilecek

---

# 🟦 FAZ 2 — OMNI-DATA FEEDER (MULTI PROVIDER DISCOVERY ENGINE)

Bu faz ile GODMODE gerçek bir veri avlama motoruna dönüşür.

## **2.A — PROVIDER ABSTRACTION LAYER (PAL)**
- [ ] Unified provider interface  
- [ ] Provider health check sistemi  
- [ ] Rate limit balancing

## **2.B — 5+ Discovery Provider Integration**
Providers:

- [ ] Google Places (mevcut → finalize edilmesi gerek)
- [ ] LinkedIn Company Finder  
- [ ] Instagram Business Search  
- [ ] Facebook Business  
- [ ] Yelp / Foursquare  
- [ ] Gov / Chamber of Commerce (MERSİS vb.)

## **2.C — Parallel Discovery Engine**
- [ ] Aynı anda 5 provider taraması  
- [ ] Duplicate merging system  
- [ ] Source confidence score

## **2.D — Deep Enrichment**
- [ ] Website scraping (cheerio)  
- [ ] Tech stack detection (Wappalyzer Lite)  
- [ ] SEO signals  
- [ ] Social presence  
- [ ] Ad intelligence (Meta Ads / Google Ads tags)

---

# 🟧 FAZ 3 — BRAIN INTEGRATION (AI DECISION PIPELINE)

Discovery sonuçlarının otomatik analiz edilmesi.

## **3.A — AI Lead Ranking**
- [ ] Lead AI Score v2  
- [ ] Opportunity score  
- [ ] Risk score  
- [ ] Category positioning

## **3.B — Auto-SWOT**
- [ ] Her lead için instant SWOT  
- [ ] Pazar karşılaştırmalı SWOT  
- [ ] Industry-fit değerlendirmesi

## **3.C — Auto-Sales Entry Strategy**
- [ ] Entry channel önerisi  
- [ ] Açılış cümlesi  
- [ ] Hızlı kazanım önerileri  
- [ ] Red flag’lere göre uyarılar

---

# 🟥 FAZ 4 — FULL AUTOMATION & OUTREACH ECOSYSTEM (ENTERPRISE MODE)

## **4.A — Autonomous Scanning**
- [ ] Şehir / ülke bazlı otomatik discovery  
- [ ] Sektör bazlı günlük taramalar  
- [ ] Trend alert sistemi

## **4.B — Auto-Enrichment Workers**
- [ ] Queue-based worker cluster  
- [ ] Çok aşamalı enrichment pipeline  
- [ ] Retry & error recovery mekanizması

## **4.C — Outreach Auto-Trigger**
- [ ] Lead threshold > 80 ise otomatik outreach  
- [ ] Outreach Scheduler entegrasyonu  
- [ ] AI tarafından seçilen hedef setleri

---

# 🟪 FAZ 5 — ANALYTICS & INSIGHT HUB (GODMODE DASHBOARD)

## **5.A — Discovery Metrics**
- [ ] Provider-based accuracy  
- [ ] Lead volume heatmap  
- [ ] Günlük/haftalık tarama trendleri

## **5.B — Lead Intelligence Reports**
- [ ] Otomatik PDF raporları  
- [ ] Sektörel raporlar  
- [ ] Bölgesel fırsat haritaları

---

# 📌 NOTLAR
- Bu roadmap her sprint sonunda güncellenecektir.
- Yeni fazlar eklenebilir.
- Öncelik her zaman Faz 1 → Faz 2 şeklinde ilerler.

---