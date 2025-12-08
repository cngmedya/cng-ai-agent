# GODMODE Discovery Engine — ROADMAP (v1.0)

Bu dosya, CNG AI Agent içerisinde yer alan **GODMODE Discovery Engine** modülünün full gelişim yol haritasıdır.  
Her aşama production seviyesine uygun şekilde tasarlanmıştır ve tamamlanan maddeler işaretlenerek ilerleme takip edilir.

---

# FAZ 1 — CORE DISCOVERY ENGINE (MVP → STABLE)

GODMODE'un temel iskeletinin kurulduğu fazdır.

Bu faz tamamlandığında:

- Discovery işlerini başlatabilen
- İş durumlarını yöneten
- Mock ve gerçek veri arasında geçiş yapabilen
- Manual-run destekleyen
- Tek provider (Google Places) çalışan, **SQLite kalıcı job store’a sahip** tam bir MVP hazır olur.

**Faz 1 durumu:** ✅ TAMAMLANDI (v1.0.0-live)

---

## **1.A — CORE MODULE BOOTSTRAP**

Temel klasör, routing, servis ve controller yapıları.

### Görevler:

- [x] `modules/godmode/` klasör ağacı kuruldu  
- [x] API → `/api/godmode/*` routing sistemi tamamlandı  
- [x] Controller → temel endpointler oluşturuldu  
- [x] Service → temel job yönetimi iskeleti yazıldı  
- [x] Workers → 3 temel worker dosyası oluşturuldu  
  - `dataFeederWorker`
  - `entityResolverWorker`
  - `economicAnalyzerWorker`
- [x] `GODMODE.md` ve `GODMODE_ROADMAP.md` oluşturuldu

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
- [x] Örnek lead listesi `result_summary` içerisine yazıldı  
- [x] Manual run endpoint’i:
  - `POST /api/godmode/jobs/:id/run`

---

## **1.D — REAL DISCOVERY (Google Places API v1)**

Mock discovery → Gerçek Google Places API entegrasyonuna taşındı.

### Görevler:

- [x] Provider: `google_places` eklendi  
- [x] `live` / `mock` switch sistemi eklendi  
  - Env: `GODMODE_PROVIDER_MODE=mock|live`  
- [x] Places Text Search → gerçek data alınıyor  
- [x] Place Detail → detaylı enrichment (rating, reviews, types, location vs.)  
- [x] Real sample leads → job summary içine yazıldı  
- [x] Manual run gerçek data ile çalışıyor  
  - `POST /api/godmode/jobs/:id/run` → gerçek Google Places çağrısı ile discovery  
- [x] Test:
  - [x] İstanbul için canlı discovery çalıştırıldı (`maxResults=50` ve `maxResults=100` gibi senaryolar)

---

## **1.E — CONFIGURATION SYSTEM (ENV + FLAGS)**

Discovery engine’in hem geliştirme hem prod ortamında yönetilebilmesi.

### Görevler:

- [x] `GODMODE_MAX_RESULTS`  
- [x] `GODMODE_PROVIDER_MODE` (mock/live)  
- [x] `GOOGLE_PLACES_API_KEY`  
- [x] “provider info” admin paneline eklenecek backend endpoint tasarımı  
  - [x] `/api/godmode/jobs` çıktısında, `result_summary.stats.providers_used` ile hangi provider’ların kullanıldığı işaretleniyor.

---

## **1.F — JOB PERSISTENCE SYSTEM (SQLite v1.0)**

**DURUM: ✅ TAMAMLANDI — v1.0.0**

GODMODE, artık job’ları kalıcı olarak SQLite üzerinde saklıyor.  
Backend restart olsa bile discovery job geçmişi ve sonuçları kaybolmuyor.

### Yapılanlar:

#### **DB Şeması**

- [x] `godmode_jobs`
  - id (TEXT, PRIMARY KEY — UUID)
  - type (TEXT — örn: `discovery_scan`)
  - label (TEXT)
  - criteria_json (TEXT — request body snapshot)
  - status (TEXT — `queued|running|completed|failed`)
  - progress_percent (INTEGER)
  - found_leads (INTEGER)
  - enriched_leads (INTEGER)
  - result_summary_json (TEXT — summary + stats)
  - created_at (TEXT)
  - updated_at (TEXT)

- [x] `godmode_job_progress`
  - job_id (TEXT, PRIMARY KEY)
  - percent (INTEGER)
  - found_leads (INTEGER)
  - enriched_leads (INTEGER)
  - updated_at (TEXT)

- [x] `godmode_job_results`
  - job_id (TEXT, PRIMARY KEY)
  - result_summary_json (TEXT)
  - raw_results_json (TEXT) — ileri fazlarda detaylı lead listesi için kullanılacak
  - created_at (TEXT)

#### **Repo Layer**

- [x] Job create → DB insert  
  - `createJob(criteria)` → `godmode_jobs` içinde kayıt oluşturur.  
- [x] Job update → DB update  
  - `updateJobStatus(jobId, status)`  
  - `updateJobProgress(jobId, { percent, found_leads, enriched_leads })`  
  - `saveJobResult(jobId, resultSummary, rawResults?)`  
- [x] Job load → DB’den tüm jobları yükleyip memory’e hydrate eder  
  - `loadAllJobs()` → `godmode_jobs + godmode_job_progress + godmode_job_results` join  
- [x] Restart sonrası otomatik job reload  
  - Server boot sırasında `bootstrapJobsFromDb()` çağrılıyor, hata durumunda log atıp backend’i durdurmadan devam ediyor.

#### **Service Layer**

- [x] In-memory → DB store hibrit modele geçiş  
  - Memory cache, DB kayıtlarının üstünde hızlı lookup için kullanılıyor.  
- [x] Yarım kalan jobları “failed” olarak işaretleme altyapısı  
  - Boot sırasında yarım / “running” kalan job’lar ileride otomatik toparlanmaya uygun şekilde okunuyor.  
- [x] Summary / result yazma mekanizması  
  - Discovery tamamlandığında:
    - progress → %100
    - stats (found_leads, enriched_leads, providers_used) → `result_summary_json` içerisine yazılıyor.

#### **Controller**

- [x] Endpoint’ler DB ile tam entegre hale getirildi:
  - [x] `GET /api/godmode/jobs`
    - Tüm job’ları DB’den okuyup progress + summary ile birlikte döner.
  - [x] `POST /api/godmode/jobs/discovery-scan`
    - Yeni job yaratır, durumu `queued` olarak DB’ye kaydeder.
  - [x] `POST /api/godmode/jobs/:id/run`
    - Job’ı DB’den alır, yoksa:
      - [x] `JOB_NOT_FOUND` hatasını döner.
    - Varsa provider’ı (mock/live) çalıştırır, progress + result’ı DB’ye yazar.

#### **Ekstra Eklenenler (Faz 1 içinde sonradan gelenler)**

- [x] **Hata senaryosu testi:**  
  - `POST /api/godmode/jobs/SAÇMA-ID/run` → `GODMODE_RUN_JOB_ERROR` + `"JOB_NOT_FOUND"` döndüğü doğrulandı.
- [x] **Faz 1 smoke testleri:**  
  - Farklı payload’larla (`maxResults=50`, `maxResults=100`) İstanbul discovery çalıştırıldı ve job listesi üzerinden doğrulandı.
- [x] **GODMODE bootstrap logları:**  
  - DB tabloları henüz yokken alınan `no such table` hataları temizlendi; şu an bootstrap aşaması temiz log ile çalışıyor.

---

# FAZ 2 — OMNI-DATA FEEDER (MULTI PROVIDER DISCOVERY ENGINE)

Bu faz ile GODMODE gerçek bir *multi-provider* veri avlama motoruna dönüşür.

## **2.A — PROVIDER ABSTRACTION LAYER (PAL)**

- [ ] Unified provider interface  
- [ ] Provider health check sistemi  
- [ ] Rate limit balancing  

## **2.B — 5+ Discovery Provider Integration**

Providers:

- [ ] Google Places (mevcut → faz 2’de finalize / harden)  
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

# FAZ 3 — BRAIN INTEGRATION (AI DECISION PIPELINE)

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

# FAZ 4 — FULL AUTOMATION & OUTREACH ECOSYSTEM (ENTERPRISE MODE)

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

# FAZ 5 — ANALYTICS & INSIGHT HUB (GODMODE DASHBOARD)

## **5.A — Discovery Metrics**

- [ ] Provider-based accuracy  
- [ ] Lead volume heatmap  
- [ ] Günlük/haftalık tarama trendleri  

## **5.B — Lead Intelligence Reports**

- [ ] Otomatik PDF raporları  
- [ ] Sektörel raporlar  
- [ ] Bölgesel fırsat haritaları  

---

# NOTLAR

- Bu roadmap her sprint sonunda güncellenecektir.  
- Yeni fazlar eklenebilir.  
- Öncelik her zaman Faz 1 → Faz 2 şeklinde ilerler.