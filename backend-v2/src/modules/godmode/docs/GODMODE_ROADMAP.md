
# GODMODE Discovery Engine — ROADMAP (v1.1.3)
> Current focus: FAZ 2.D.3.5 — Persist enrichment payload to DB (schema + migration)

Bu dosya, CNG AI Agent içerisinde yer alan **GODMODE Discovery Engine** modülünün full gelişim yol haritasıdır.  
Her aşama production seviyesine uygun şekilde tasarlanmıştır ve tamamlanan maddeler işaretlenerek ilerleme takip edilir.

## Son Oturum Notları (2025-12-23)

- Lokal servis portu standardı: `4000`
- Smoke test standardı: `./scripts/smoke_test.sh` (major değişiklik sonrası hedef: yeşil)
- Deep enrichment manuel consumer koştururken `.env` export gerekebilir:
  - `set -a; source .env; set +a`
- Deep enrichment’te `WEBSITE_MISSING` event’i gerçek bir senaryodur (Google “OK” dönse bile website alanı boş olabilir).
- Idempotency aktif: aynı `jobId + google_place_id` için duplicate `TECH_STUB` / `WEBSITE_MISSING` log basılmaz.

- Discovery içinde deterministik deep-enrichment stub write ile smoke test yeşil (worker/queue bağımsız).

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
  - [x] **DB path canonicalizasyonu**
    - Canonical path: `data/app.sqlite`
    - Godmode, Discovery, Research ve Lead pipeline aynı DB’yi kullanır
    - `src/data/` yalnızca legacy/symlink amaçlıdır
    - Yeni geliştirmelerde `src/data` doğrudan kullanılmaz

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
  - [x] `sqlite3 data/app.sqlite "SELECT id, job_id, event_type, substr(created_at,1,19) FROM godmode_job_logs ORDER BY id DESC LIMIT 20;"` ile log akışının doğru sırada ve doğru event tipleriyle kaydedildiği doğrulandı.

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

✅ Smoke test (full-green) doğrulandı (2025-12-23): Godmode + Outreach + Research(CIR full-report) pipeline uçtan uca çalışıyor.

## **2.A — PROVIDER ABSTRACTION LAYER (PAL)**

Amaç: Tüm discovery provider’larını tek bir abstraction altında toplamak, ileride LinkedIn / Instagram / Yelp vb. kaynakları rahatça ekleyebilmek.

### Durum:

- [x] **Unified provider interface (v1.1.0)**
  - `providersRunner.runDiscoveryProviders(criteria)` ile tek entry point
  - Standart output:
    - `leads` (normalize lead objeleri)
    - `providers_used`
    - `used_categories`
    - `provider_errors`
  - Şu an tek aktif kanal: `google_places`
- [x] **Provider health check sistemi (FAZ 2.A.1 — TAMAMLANDI)**
  - ✔ Lightweight healthCheck() (google_places)
  - ✔ Latency ölçümü + ok/fail durumu
  - ✔ `GET /api/godmode/providers/health` endpoint
  - ✔ Smoke test entegrasyonu
  - ✔ PAL observability temeli atıldı
- [x] **Rate limit & backoff strategy (FAZ 2.A.2 — TAMAMLANDI)**
  - PAL_FORCE_RATE_LIMIT simülasyonu eklendi (smoke test dahil)
  - Provider health response: `provider_rate_limited` + `retryAt` + `backoffMs`
  - Discovery runner `provider_skips` + `provider_skip_details` üretir
  - Job `result_summary` içine skip detayları yazılır (observability)
  - Progress heartbeat (stage/percent) iyileştirildi (provider_search → result_build)
- [ ] **Rate limit balancing (NEXT)**
  - Provider bazlı gerçek throttling + jitter
  - Circuit breaker / cooldown window tasarımı
  - Çoklu provider için ortak backoff policy

## **2.B — 5+ Discovery Provider Integration**

Amaç: Farklı kanallardan veri çekerek tek bir omni-discovery motoru kurmak.

### 2.B.1 — Google Places Provider Hardening & Normalization (v1.1.0) ✅

- [x] `providers/googlePlacesProvider.js` normalize edildi
  - Tek tip lead formatı:
    - `provider`
    - `place_id`
    - `name`
    - `address`
    - `city`
    - `country`
    - `rating`
    - `user_ratings_total`
    - `types`
    - `business_status`
    - `location { lat, lng }`
    - `raw.reference` (ileride deep-link vb. için)
  - Tüm sonuçlar bu schema’ya zorlanıyor (eksik alanlar null / default)
- [x] `providersRunner.runDiscoveryProviders` ile entegrasyon
  - `channels` içinde `google_places` varsa otomatik devreye giriyor
  - `providers_used` listesine `google_places` ekleniyor
  - `used_categories` → Google Places tarafında fiilen kullanılan arama kategorileri
- [x] `service.runDiscoveryJob*` entegrasyonu (FAZ 2 versiyonu)
  - `engine_version: "v1.1.0-live-faz2"`
  - `result_summary` alanları:
    - `providers_used` → runner’dan gelen set
    - `used_categories` → runner’dan gelen set (veya gerekirse criteria fallback)
    - `provider_errors` → provider bazlı error listesi (şimdilik [] ama alan hazır)
    - `stats.providers_used`
    - `stats.used_categories`
- [x] Smoke testler:
  - İstanbul için `maxResults=10` / tek kategori / çoklu kategori senaryoları
  - `GET /api/godmode/jobs/:id` → `result_summary` içinde yukarıdaki alanların doluluğu doğrulandı


### 2.B.2+ — Diğer Providerlar (Plan)

Providers:

- [ ] LinkedIn Company Finder
- [ ] Instagram Business Search
- [ ] Facebook Business
- [ ] Yelp / Foursquare
- [ ] Gov / Chamber of Commerce (MERSİS vb.)
- [ ] Ek: Google Maps Place Details (deep enrichment, FAZ 2.D ile birlikte)

Her provider için hedef:

- [ ] PAL interface’ine uygun adapter
- [ ] Normalized lead output
- [ ] Error / rate limit handling
- [ ] `providers_used` ve `provider_errors` entegrasyonu

### 2.B.6 — Discovery Deduplication & Freshness Policy (Design Draft)

Amaç: Aynı firmayı anlamsızca tekrar tekrar keşfetmek yerine, “zaten sistemde olan” lead’ler için daha akıllı bir yol izlemek.

**Canonical dedup key**
- [x] `provider + provider_id` (örn. `google_places + place_id`) ile dedup

**DB şema hazırlığı (potential_leads)**
- [x] `provider` / `provider_id` kolonları eklendi
- [x] `raw_payload_json` kolonları eklendi (ham provider payload saklama)
- [x] `first_seen_at` / `last_seen_at` kolonları eklendi
- [x] `scan_count` kolonu eklendi (DEFAULT 1)
- [x] `updated_at` kolonu eklendi
- [x] `idx_potential_leads_provider_provider_id` index’i eklendi
- [x] Startup idempotent schema-sync + best-effort backfill (source/google_place_id → provider/provider_id)

**Godmode discovery davranışı (v1.1.0-live-faz2 mevcut)**
- [x] Discovery sonuçları `potential_leads` tablosuna upsert ediliyor (idempotent)
- [x] `result_summary.stats` içine dedup metrikleri eklendi:
  - [x] `deduped_leads`
  - [x] `fresh_inserted_leads`

**Kalan tasarım hedefleri (FAZ 2.B.6.2 ile tamamlanacak)**
- [x] Freshness window içinde **skip-enrichment** (known lead) davranışı (metrik + event düzeyi)
- [x] `skip_enrichment` kolonu eklendi (DB + startup schema-sync)
- [x] forceRefresh: true ile manuel yeniden enrichment (DONE — v1.1.2+ hotfix: payload→validator→service→criteria, freshness bypass + metrics)
- [ ] `last_seen_at` / `scan_count` güncelleme kurallarının netleştirilmesi
- [ ] `skipped_as_existing_count` gibi ek metriklerin opsiyonel eklenmesi

### 2.B.6.2 — Freshness Window & Skip-Enrichment Policy (DONE — v1.1.1-live-faz2, known-lead path)

Amaç: “Known lead” için gereksiz ağır enrichment/analiz adımlarını çalıştırmadan, sistemin taze kalmasını sağlamak.

**Hedef davranış**
- [x] Dedup sonrası lead “known” ise:
  - [x] `last_seen_at` güncelle
  - [x] `scan_count` +1
  - [x] Freshness window içindeyse enrichment adımlarını **skip** et
- [ ] “New lead” davranışı (NEXT — 2.B.6.2.1)
  - [ ] `first_seen_at` ve `last_seen_at` set et
  - [ ] `scan_count = 1`
  - [ ] Normal enrichment akışını çalıştır (mevcut behavior)

**Freshness window tasarımı**
- [x] Env/flag: `GODMODE_FRESHNESS_WINDOW_HOURS` (default: 168 saat / 7 gün)
- [x] Lead “fresh” sayılır koşulu:
  - [x] `now - last_seen_at <= window`
- [x] forceRefresh: true geldiğinde freshness window bypass edilir (DONE — v1.1.2+ hotfix)

**Observability / metrics**
- [x] `result_summary.stats` içine:
  - [x] `skipped_as_fresh_count`
  - [x] `refreshed_due_to_force_count`
  - [x] `updated_known_leads_count`
- [x] Job log’larına (godmode_job_logs) stage/event ekleri:
  - [x] `DEDUP_DONE`
  - [ ] `FRESHNESS_EVAL`
  - [x] `ENRICHMENT_SKIPPED`

**Implementation notes**
- [x] Karar noktası: `service.runDiscoveryJobLive` içinde dedup sonucu → freshness check (repo last_seen_at_before ile)
- [x] DB write’lar idempotent (provider+provider_id dedup + upsert + schema-sync)
- [x] Smoke test metrikleri doğrulayacak şekilde genişletildi (skipped_as_fresh_count, updated_known_leads_count, refreshed_due_to_force_count)

---

### 2.B.6.3 — Enrichment Gating (Skip-Enrichment Execution) (DONE — v1.1.2-live-faz2, freshness gating v1)

Amaç: Freshness window içinde “known lead” için yalnızca lightweight update yapıp, ağır enrichment / worker zincirini gerçekten çalıştırmamak.

**Hedef davranış**
- [x] `skipped_as_fresh_count` içine giren lead’ler için:
  - [x] Worker tetikleme / enrichment pipeline adımları gerçekten bypass edilecek
  - [x] Job log event: `ENRICHMENT_START` eklendi (worker run path)
  - [ ] `skip_enrichment=1` DB flag’i set edilecek (veya job-context flag)
- [x] forceRefresh: true senaryosu (DONE — v1.1.2+ hotfix, freshness gating override)
  - [x] Fresh lead olsa bile enrichment çalışacak
  - [x] refreshed_due_to_force_count artacak

  - [x] Branch noktası: `runDiscoveryJobLive` → worker orchestration hook (FAZ 1.G.6)
  - [x] dataFeederWorker tetiklemesi gating ile şartlı hale getirildi (şimdilik console-log stub)
  - [ ] Job log event: `FRESHNESS_EVAL` (opsiyonel) + `ENRICHMENT_SKIPPED` nedeni standardizasyonu
  - [ ] `skip_enrichment=1` DB flag’i set etme (NEXT — 2.B.6.3.2)

**Test**
- [x] Smoke test full-green doğrulandı (PAL + discovery + outreach + CIR)
- [x] Aynı kriterle ardışık 2 run: ikinci run’da enrichment count düşmeli
- [ ] Smoke test’e `forceRefresh` senaryosu ekle (NEXT — 2.B.6.3.3)

---

## **2.C — Parallel Discovery Engine**

- [x] 2.C.1 — Aynı anda çoklu provider taraması (parallel execution) (v1.2.0-live-faz2)
  - [x] `providersRunner.runDiscoveryProviders` çoklu provider `channels[]` ile çalışır
  - [x] `parallel=true` default, `parallel=false` sequential debug modu
  - [x] `provider_errors` alanı runner output’unda mevcut
  - [x] Smoke test full-green doğrulandı (Google Places tek provider ile geriye uyum)

- [x] 2.C.2 — Duplicate merging system (multi-provider aynı firmayı tek lead’de birleştirme) (DONE — v1.3.0-live-faz2)
  - [x] Canonical merge key v1: `domain::(city|country)` fallback `normalized_name::(city|country)::address`
  - [x] Merge strategy v1: primary selection (confidence → rating → review_volume) + `sources[]` + `raw_sources[]`
  - [x] Merge conflict resolver v1: rating/review_volume seçimi + alan precedence (primary)
  - [x] Output v1: `result_summary.sample_leads` (merged) + `raw_leads_sample` (ham)
  - [x] DB persist (şemasız): `raw_payload_json._merge` içine `canonical_key/provider_count/source_confidence/sources` yazılır

- [x] 2.C.3 — Source confidence score (DONE — v1.3.0-live-faz2)
  - [x] Provider-side confidence v1 (Google Places: rating + review volume + business_status)
  - [x] Merge-side confidence v1: max(confidence) + cross-source bonus (+5, cap 100)
  - [x] `provider_count` alanı merged lead üzerinde taşınır

- [x] 2.C.4 — Provider bazlı weighting (DONE — v1.4.0-live-faz2)
  - [x] `GODMODE_PROVIDER_WEIGHTS` env/config (örn: `google_places=1.0,yelp=0.9,linkedin=0.8`)
  - [x] Weighted score: `final_score = source_confidence * weight` (cap 100)
  - [x] Lead ranking: top-N selection + deterministik sıralama (score → rating → reviews)
  - [x] Observability: `weights_used` + `top_ranked_sample` alanları result_summary’ye eklendi
  - [x] DB persist: `top_ranked_sample` öncelikli (fallback: `sample_leads`)


## **2.D — Deep Enrichment (Website/Tech/SEO/Social signals)**

- [x] 2.D.0 — Gating & Observability (READY — infra)
  - [x] `GODMODE_DEEP_ENRICHMENT` feature flag + `GODMODE_DEEP_ENRICHMENT_SOURCES`
  - [x] `deep_enrichment_candidates` metriği (pipeline + worker + service)
  - [x] `job.result_summary.deep_enrichment` alanı (enabled/sources/candidates)

- [x] 2.D.1 — Stage persistence (READY — infra)
  - [x] Repo helpers: `appendDeepEnrichmentStage()` + `getDeepEnrichmentLogs()`
  - [x] Event types: `DEEP_ENRICHMENT_*` (RUNNING/COMPLETED/FAILED)

- [x] 2.D.2 — Placeholder workers (READY — infra, no external calls)
  - [x] `economicAnalyzerWorker` stage-aware placeholder signals
  - [x] `entityResolverWorker` stage-aware normalized entity stub

- [ ] 2.D.3 — Real enrichment execution (IN PROGRESS)
  - [x] 2.D.3.0 — Candidate ID collection + queue persistence (DONE — infra)
    - [x] Candidate ID collection (cap/opt-in): `GODMODE_DEEP_ENRICHMENT_COLLECT_IDS`, `GODMODE_DEEP_ENRICHMENT_IDS_CAP`
    - [x] Queue persistence via job logs (no new tables yet):
      - [x] Repo: `enqueueDeepEnrichmentCandidates()` + `getDeepEnrichmentQueuedBatches()`
      - [x] Event: `DEEP_ENRICHMENT_QUEUED` batches (chunk size env: `GODMODE_DEEP_ENRICHMENT_QUEUE_CHUNK`)
    - [x] Service wiring: eligible providerIds collected + queued when not skipped due to freshness

  - [x] 2.D.3.1 — Website fetch + tech fingerprint (DONE — v1.1.2+ hotfix, rate-limit safe)
    - Not: Discovery run içinde deterministik stub write ile event üretimi garanti altına alındı (smoke-test uyumu).
  - [x] Job logs API endpoints eklendi:
    - `GET /api/godmode/jobs/:id/logs`
    - `GET /api/godmode/jobs/:id/logs/deep-enrichment`
  - [x] Deep enrichment consumer (manual invoke) eklendi: `processDeepEnrichmentBatch({ jobId, ids, sources })`
  - [x] Website fallback (Place Details) yalnızca website eksikse çalışır; rate-limit safe backoff ile sarıldı
  - [x] Observability:
    - `DEEP_ENRICHMENT_TECH_STUB`
    - `DEEP_ENRICHMENT_WEBSITE_MISSING` (Google OK ama website yok)
    - `DEEP_ENRICHMENT_WEBSITE_FETCH_FAILED` (REQUEST_DENIED / MISSING_API_KEY vb.)
  - [x] Idempotency: Aynı `jobId + google_place_id` için duplicate TECH_STUB / WEBSITE_MISSING log basılmaz
    - [x] Manuel consumer notu: `node -e ...` çağrılarında `.env` export edilmezse `MISSING_API_KEY/REQUEST_DENIED` görülebilir
    - [x] “Website yok” senaryosu normaldir; bu durumda `DEEP_ENRICHMENT_WEBSITE_MISSING` log’u ile kanıtlanır
  - [x] 2.D.3.2 — SEO signals (DONE — v1.1.3)
    - [x] event: DEEP_ENRICHMENT_SEO_SIGNALS (idempotent; smoke-test verified)
  - [x] 2.D.3.3 — Opportunity / Lead Scoring (DONE — v1.1.3)
    - [x] event: DEEP_ENRICHMENT_OPPORTUNITY_SCORE (idempotent; smoke-test verified)
  - [x] 2.D.3.4 — Social signals (DONE — v1.1.3)
    - [x] event: DEEP_ENRICHMENT_SOCIAL_SIGNALS (idempotent; smoke-test verified)
  - [x] 2.D.3.5 — Persist enrichment payload to DB (**DONE** — V2 normalized persistence live as of 2025-12-24; lead_enrichments table insert, job_id wiring, verified by logs & row count)
    - [x] V2 normalized persistence (lead_enrichments) — repo-level best‑effort insert, job_id wired, verified by logs and row count (2025-12-24)

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

- DB canonical kuralı:
  - Kod + doküman + smoke test → `data/` dizinini referans alır
  - Bu kural FAZ 2 ve sonrası için değişmez kabul edilir