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
- Tek provider (Google Places) çalışan, **SQLite kalıcı job store’a sahip**
- Sağlam validation + provider error handling katmanına sahip
- Job event log sistemiyle izlenebilirliği yüksek

tam bir MVP hazır olur.

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
  - Env: `GODMODE_DISCOVERY_MODE=0|1` veya `mock|live|true`  
- [x] Places Text Search → gerçek data alınıyor  
- [x] Detay enrichment (rating, reviews, types, location vs.) için gerekli alanlar normalize edildi  
- [x] Real sample leads → job summary içine yazıldı  
- [x] Manual run gerçek data ile çalışıyor  
  - `POST /api/godmode/jobs/:id/run` → gerçek Google Places çağrısı ile discovery  
- [x] Test:
  - [x] İstanbul için canlı discovery çalıştırıldı (`maxResults=50` ve `maxResults=100` gibi senaryolar)

---

## **1.E — CONFIGURATION SYSTEM (ENV + FLAGS)**

Discovery engine’in hem geliştirme hem prod ortamında yönetilebilmesi.

### Görevler:

- [x] `GODMODE_DISCOVERY_MODE` (mock / live / 0 / 1 / true)
- [x] `GOOGLE_PLACES_API_KEY`  
- [x] `GODMODE_MAX_RESULTS` upper bound mantığı `createDiscoveryJob` içine alındı (max 250)  
- [x] “provider info” admin paneline eklenecek backend endpoint tasarımı  
  - [x] `/api/godmode/jobs` çıktısında, `result_summary.stats.providers_used` ile hangi provider’ların kullanıldığı işaretleniyor.

---

## **1.F — JOB PERSISTENCE SYSTEM (SQLite v1.0)**

**DURUM: ✅ TAMAMLANDI — v1.0.0**

GODMODE, job’ları kalıcı olarak SQLite üzerinde saklıyor.  
Backend restart olsa bile discovery job geçmişi ve sonuçları kaybolmuyor.

### Yapılanlar:

#### **DB Şeması (v1.0.0 canlı tasarım)**

- [x] `godmode_jobs`
  - id (TEXT, PRIMARY KEY — UUID)
  - type (TEXT — örn: `discovery_scan`)
  - label (TEXT)
  - criteria_json (TEXT — request body snapshot)
  - status (TEXT — `queued|running|completed|failed`)
  - progress_percent (INTEGER)
  - found_leads (INTEGER)
  - enriched_leads (INTEGER)
  - result_summary_json (TEXT — summary + stats + sample_leads + provider_errors)
  - created_at (TEXT)
  - updated_at (TEXT)

> Not: Başta planlanan ayrı tablolar (`godmode_job_progress`, `godmode_job_results`) Faz 1 yerine ilerideki fazlara taşındı.  
> Şu anda daha sade ve pratik olan **tek tablo modeli** kullanılıyor. İleride yüksek hacimli veri olduğunda bu iki tablo tekrar gündeme alınabilir.

#### **Repo Layer**

- [x] Job create → DB insert  
  - `insertJob(job)` → `godmode_jobs` içinde kayıt oluşturur.  
- [x] Job update → DB update  
  - `updateJob(job)` → status, progress, result_summary gibi alanları günceller.  
- [x] Job load → DB’den tüm jobları yükleyip memory’e hydrate eder  
  - `loadAllJobs()` → `godmode_jobs` üzerinden full job state’i okur.

#### **Service Layer**

- [x] In-memory → DB store hibrit model  
  - Memory cache, DB kayıtlarının üstünde hızlı lookup için kullanılıyor.  
- [x] Yarım kalan jobları “failed” olarak işaretleme altyapısı  
  - Boot sırasında status=`running` olan job’lar:
    - `failed` olarak işaretleniyor
    - `job.error = "Auto-recovery: previous run interrupted, job marked as failed."`
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
  - Farklı payload’larla (`maxResults=50`, `maxResults=100`, `maxResults=500`) İstanbul discovery çalıştırıldı ve job listesi üzerinden doğrulandı.
- [x] **GODMODE bootstrap logları:**  
  - DB tabloları henüz yokken alınan `no such table` hataları temizlendi; şu an bootstrap aşaması temiz log ile çalışıyor.
- [x] **DB path standardizasyonu:**  
  - Tüm GODMODE ve lead/CRM modülleri tek `src/data/app.sqlite` dosyasına taşındı; eski `data/app.sqlite` kaldırılarak legacy kalıntılar temizlendi.

---

## **1.G — Job Validation, Provider Error Handling & Orchestration (v1.0.0)**

Bu adımın amacı:

- Discovery job creation request’lerini sağlam bir validation katmanından geçirmek  
- Provider kaynaklı hataları normalize edip `result_summary` içine yazmak  
- Tüm provider’lar fail olduğunda bile hataları kaybetmeden job seviyesinde görmek  
- Discovery bittikten sonra ilerideki pipeline’lara (workers, enrichment vb.) hook atacak temel orkestrasyon iskeletini kurmak

### **1.G.1 — Job Validation Layer ✅**

- [x] `createDiscoveryJob` içinde zorunlu alan validasyonları:
  - [x] `city` + `country` zorunlu
  - [x] `categories` alanı varsa array olmalı, değilse `VALIDATION_ERROR`
  - [x] `minGoogleRating` 0–5 aralığında olmalı, aksi durumda `VALIDATION_ERROR`
  - [x] `maxResults` > 0 olmalı, 250’den büyükse otomatik `250`’ye clamp
- [x] Geçersiz input’larda:
  - [x] `err.code = "VALIDATION_ERROR"`
  - [x] Anlamlı Türkçe hata mesajları

---

### **1.G.2 — Provider Error Normalization (Normal Case) ✅**

- [x] `normalizeProviderError(provider, error)` helper’ı eklendi  
- [x] Başarılı discovery senaryosunda:
  - [x] `result_summary.provider_errors = []`
  - [x] `result_summary.stats.providers_used` alanı dolu (`["google_places"]`)
  - [x] `result_summary.sample_leads` içinde normalize edilmiş lead objeleri
- [x] Normal akış test edildi:
  - `POST /api/godmode/jobs/discovery-scan`  
  - `POST /api/godmode/jobs/:id/run`  
  - Çıktıda:
    - `progress.percent = 100`
    - `sample_leads` dolu
    - `provider_errors = []`

---

### **1.G.3 — Provider Error Handling (Failure Scenarios) ✅**

- [x] Her provider çağrısı `try/catch` ile sarıldı:
  - Hata durumunda `normalizeProviderError('google_places', err)` ile tek tipe indirgeniyor
  - Normalize hata objesi: `{ provider, error_code, error_message }`
- [x] Bilinen pattern’ler:
  - [x] `HTTP_ERROR` (HTTP status kodu kaynaklı)
  - [x] `STATUS_*` (Google Places `status` değerleri)
  - [x] `MISSING_API_KEY`
  - [x] `NETWORK_ERROR` (`ECONNRESET`, `ETIMEDOUT` vs.)
- [x] Tüm provider’lar fail olduğunda:
  - [x] `ALL_PROVIDERS_FAILED` hatası fırlatılıyor (`err.code = "ALL_PROVIDERS_FAILED"`)
  - [x] Job DB’de `status = "failed"` olarak işaretleniyor
  - [x] Hata detayları `result_summary.provider_errors` içinde tutuluyor

> Not: Bu flow, prod’da gerçek hata yaşandığında otomatik devreye girecek şekilde hazır.  
> Gerekirse ileride özel bir failure test senaryosu için geçici olarak yanlış API key ile manuel test yapılabilir.

---

### **1.G.4 — Provider Error Surfacing & Observability (v1.0.0) ✅**

- [x] Tüm provider hataları job bazında `result_summary.provider_errors` içinde tutuluyor  
- [x] Job’ın `error` alanı, genel hata kodunu içeriyor (örn: `ALL_PROVIDERS_FAILED`)  
- [x] Gelecekteki dashboard / analytics fazları için veri modeli hazır:
  - Hangi provider’ın ne sıklıkla hata verdiği
  - Hangi error code’ların öne çıktığı
- [x] Mock engine’de de `provider_errors: []` ile tutarlı response formatı sağlandı

---

### **1.G.5 — Job Event Log System (v1.0.0) ✅**

Amaç: Her job için adım adım event geçmişi tutmak (debug + izlenebilirlik).

- [x] Yeni tablo: `godmode_job_logs`
  - [x] Kolonlar:
    - `id` (INTEGER, PRIMARY KEY AUTOINCREMENT)
    - `job_id` (TEXT, INDEX)
    - `event_type` (TEXT) — örn: `QUEUED`, `RUN_START`, `PROVIDER_PAGE`, `COMPLETED`, `FAILED`
    - `payload_json` (TEXT) — isteğe bağlı detay (provider, hata objesi, vs.)
    - `created_at` (TEXT)
- [x] Repo fonksiyonları:
  - [x] `appendJobLog(jobId, eventType, payload?)`
  - [x] `getJobLogs(jobId)`
- [x] Service entegrasyonu:
  - [x] Job create aşamasında `QUEUED` log’u
  - [x] Run başında `RUN_START`
  - [x] Her provider sonuç sayfası okunduğunda `PROVIDER_PAGE`
  - [x] Success durumda `COMPLETED`
  - [x] Hata durumunda `FAILED` + error payload (ileride genişletmeye uygun)
- [x] Smoke test:
  - [x] Birden fazla job create + run
  - [x] `sqlite3 src/data/app.sqlite "SELECT id, job_id, event_type, substr(created_at,1,19) FROM godmode_job_logs ORDER BY id DESC LIMIT 20;"` ile log akışının doğru sırada ve doğru event tipleriyle kaydedildiği doğrulandı.

---

### **1.G.6 — Worker Orchestration Stub Integration (v1.0.0) ✅**

Amaç: Discovery tamamlandığında ilerideki worker pipeline’larına hook atacak temel iskeleti kurmak.

- [x] `dataFeederWorker` için stub entegrasyonu:
  - [x] `runDiscoveryJob` tamamlandıktan sonra, job `status = "completed"` olduğunda worker tetikleme noktası çalışıyor
  - [x] Şu an için log tabanlı stub:
    - `[GODMODE][WORKER_STUB] dataFeederWorker would be triggered for job <jobId>`
- [x] Lead pipeline entegrasyonu:
  - [x] Discovery sonucundan gelen normalize lead listesi `potential_leads` tablosuna upsert ediliyor
  - [x] Log:
    - `[GODMODE][PIPELINE] potential_leads upsert tamamlandı. affected=<N>`
- [x] Smoke test:
  - [x] Valid job create + run
  - [x] Console log’larda hem `WORKER_STUB` hem de `PIPELINE` mesajlarının görülmesi
- [x] Faz 2 için hazır hook noktası:
  - [x] `dataFeederWorker` ileride gerçek queue/worker sistemine (BullMQ, custom queue vs.) bağlanabilecek şekilde izole edildi.

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

## **2.E — Lead Freshness & Rescan Policy (New vs Known Leads)**

Amaç: Aynı firmayı gereksiz yere tekrar tekrar ağır analizden geçirmeden, “yeni lead” ile “zaten bildiğimiz lead” ayrımını netleştirmek ve discovery sonuçlarını daha akıllı şekilde sınıflandırmak.

- [ ] DB model geliştirmesi:
  - [ ] `first_seen_at` alanı (lead ilk ne zaman keşfedildi?)
  - [ ] `last_seen_at` alanı (en son hangi discovery job’ında görüldü?)
  - [ ] `scan_count` alanı (kaç farklı discovery run’ında yakalandı?)
  - [ ] `last_discovery_job_id` alanı (en son hangi job üzerinden geldi?)

- [ ] Discovery davranışı:
  - [ ] Yeni bir provider sonucu geldiğinde:
    - [ ] Aynı `provider + provider_id` (örn. `google_places + place_id`) varsa:
      - [ ] Yeni satır eklemeyip mevcut kaydı update et
      - [ ] `scan_count` +1
      - [ ] `last_seen_at` güncelle
    - [ ] Yoksa:
      - [ ] `first_seen_at` ve `last_seen_at` aynı olacak şekilde yeni lead oluştur
      - [ ] `scan_count = 1`

- [ ] Raporlama / filtreleme hazırlığı:
  - [ ] “Sadece yeni lead’leri göster” filtresi için gerekli alanların netleştirilmesi
  - [ ] “Zaten bilinen ama henüz temas edilmemiş lead’ler” gibi view’lar için lead CRM ile ortak alanların tasarlanması
  - [ ] Faz 3’te kullanılacak “yeni vs. known” segmentleri için temel iş kurallarının yazılması

- [ ] “Analizi güncelle” flow’una hazırlık:
  - [ ] Lead intel tablosu için `intel_last_updated_at` ve `intel_freshness_state` alanlarının tasarlanması
  - [ ] Discovery tarafında, gerekirse bir lead için “force refresh” (örneğin UI’de “Analizi güncelle” butonu) flag’ine cevap verebilecek hook’ların planlanması

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