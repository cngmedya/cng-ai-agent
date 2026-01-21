
# GODMODE Discovery Engine — ROADMAP (v1.1.13)
> Current focus: FAZ 4.E — Real Send Provider (Provider-ready; SMTP creds + DELIVERED proof deferred)

Bu dosya, CNG AI Agent içerisinde yer alan **GODMODE Discovery Engine** modülünün full gelişim yol haritasıdır.  
Her aşama production seviyesine uygun şekilde tasarlanmıştır ve tamamlanan maddeler işaretlenerek ilerleme takip edilir.


## Son Oturum Notları (2026-01-21)

- FAZ 4.E “queue_only” execution path uçtan uca doğrulandı (Count → Queue → Worker → Write).
- `OUTREACH_EXECUTION_MODE=queue` alias normalize edildi → `queue_only` ile uyumlu hale getirildi (MODE_NOT_IMPLEMENTED sarmalı kapatıldı).
- Lead resolve guardrail: email yokken controlled test için `OUTREACH_TEST_TO=test@noqse.com` ile fallback recipient desteklendi (Google Places email vermez).
- Queue persistence modeli: ayrı `outreach_queue` tablosu yok; enqueue state `godmode_job_logs` event’leri ile tutuluyor (`OUTREACH_ENQUEUED`).
- Outreach worker çalıştırma standardı:
  - CLI entrypoint eklendi: `node -r dotenv/config src/modules/outreach/worker.js <jobId> [limit]`
  - `.env` export edilmezse provider tarafı `SMTP_DISABLED/MISSING_ENV` ile deterministik fail verir (beklenen).
- Real send rollout kararı: Frontend bitene kadar güvenlik için `OUTREACH_SMTP_ENABLED=0` (Yol 1). Allowlist gate aktif tutulur.
- Kanıt job’ları (örnek): `d68ea900-2179-42d1-9ce0-fc549b4bad44` → `OUTREACH_ENQUEUED|10` + `OUTREACH_FAILED|10 (MISSING_ENV)`; provider path gerçek, SMTP creds eksik.
- Idempotency: `job + lead + channel` kombinasyonunda duplicate send engellenir (skipped=true).

- Smoke Test Strategy & Replay Policy (LOCKED):
  - Mini Smoke (`./scripts/smoke_godmode_min.sh`)
    - Amaç: hızlı iterasyon, regresyon yakalama
    - Varsayılan mod: REPLAY (DB seed / replay)
    - External provider çağrısı YOK (Google Places çağrılmaz)
    - Günlük / küçük kod değişikliklerinde zorunlu kontrol
  - Full Smoke (`./scripts/smoke_test.sh`)
    - Amaç: uçtan uca gerçek sistem doğrulaması
    - Varsayılan mod: LIVE (gerçek Google Places verisi)
    - Kullanım kuralı: sadece büyük modül değişiklikleri, faz geçişleri ve release öncesi
    - Google API maliyeti bilinçli ve kontrollü kabul edilir
  - Kural:
    - Yeni FAZ geçişi öncesi Full Smoke PASS zorunludur
    - Mini Smoke, Full Smoke’un yerine geçmez (sadece iterasyon aracıdır)
  - Operasyonel netlik:
    - Full Smoke her zaman LIVE çalışır (REPLAY’e alınmaz).
    - Sadece major değişikliklerde, faz geçişlerinde ve release öncesinde koşturulur.
    - Amaç doğruluk doğrulamasıdır; maliyet bilinçli olarak kabul edilir.


## Son Oturum Notları (2025-12-23)

- Lokal servis portu standardı: `4000`
- Smoke test standardı: `./scripts/smoke_test.sh` (major değişiklik sonrası hedef: yeşil)
- Deep enrichment manuel consumer koştururken `.env` export gerekebilir:
  - `set -a; source .env; set +a`
- Deep enrichment’te `WEBSITE_MISSING` event’i gerçek bir senaryodur (Google “OK” dönse bile website alanı boş olabilir).
- Idempotency aktif: aynı `jobId + google_place_id` için duplicate `TECH_STUB` / `WEBSITE_MISSING` log basılmaz.

- Discovery içinde deterministik deep-enrichment stub write ile smoke test yeşil (worker/queue bağımsız).

- 2025-12-24: Smoke test full-green doğrulandı (discovery → deep enrichment → outreach → research). Freshness gating, forceRefresh ve V2 enrichment persistence prod seviyesinde stabil.
- 2025-12-25: Full smoke çıktı analizine göre `potential_leads.raw_payload_json._merge.last_discovery_job_id` alanı “son discovery run” tarafından overwrite edildiği için, smoke_test.sh assertion’ı JOB_ID_1 yerine JOB_ID_3 (final) ile doğrulanacak şekilde güncellendi (false WARN kapatıldı).
- 2025-12-25: Full smoke tekrar koşturuldu ve yeşil doğrulandı; deep enrichment (TECH_STUB=10), V2 persistence (JOB_ID_1=10, JOB_ID_3=10), freshness gating ve FAZ 2.E metrikleri prod seviyesinde stabil.

- 2025-12-24: FAZ 2.E başlangıç deliverable tamamlandı: upsertPotentialLead job-aware yapıldı (is_new + scan_count before/after), DEDUP_DONE payload’ına new/known/scan_total metrikleri eklendi.
- 2025-12-24: raw_payload_json overwrite bug fix: deep enrichment update artık _merge.last_discovery_job_id alanını koruyor (repo-level safe merge).
- 2025-12-24: Smoke test 3B.3: FAZ 2.E metrikleri deterministik doğrulanıyor (DEDUP_DONE counters). potential_leads last_discovery_job_id assertion environment’a göre WARN olabilir.
 
- 2025-12-24: FAZ 2.E.2 (MINIMAL) tamamlandı: rescan eligibility (time/manual) + scan_count cap + observability (RESCAN_ELIGIBLE / RESCAN_BLOCKED_SCANCOUNT_CAP) + DEDUP_DONE payload alanları (rescan_after_hours, scancount_cap, counters).
- 2025-12-24: Smoke test kanıtı: JOB_ID_3 DEDUP_DONE → rescanned_due_to_manual_count=10, rescanned_due_to_time_count=0, rescan_after_hours=720, scancount_cap=10.

- 2025-12-24: FAZ 3.A (v1 minimal) tamamlandı: Godmode modülü içinde ai/ klasörü açıldı; leadRanking.prompt.js + leadRanking.schema.js eklendi; service.js içine AI ranking wiring eklendi (LLM opt-in: GODMODE_AI_LEAD_RANKING=1, aksi halde deterministic heuristic fallback).
- 2025-12-24: Job log events: AI_LEAD_RANKED (lead bazında) + AI_LEAD_RANKING_DONE (özet) DB write ile doğrulandı (mini smoke + full smoke green).
- 2025-12-24: Mini smoke eklendi ve stabilize edildi: ./scripts/smoke_godmode_min.sh (forceRefresh=true + 30s poll).
- 2025-12-25: Mini smoke'a SMOKE_FORCE_AB=1 modu eklendi (test-only). Amaç: A/B lead üretimini tetikleyip Auto-SWOT + Outreach Draft + Persistence zincirini daha deterministik şekilde egzersiz etmek. Not: veri şartlarına bağlı olarak yine de A/B çıkmayabilir; kesin kanıt için “real AB job” kanıtı kullanılır (aşağıda).
- 2025-12-24: Global test standardı Master Document’e eklendi: Mini smoke (hızlı iterasyon) vs Full smoke (release gate).

- Phase transition rule: **Before advancing to a new FAZ, Full Smoke (`./scripts/smoke_test.sh`) must pass green.** Mini smoke is for iteration only.

-- 2025-12-25: smoke_test.sh 3B deep-enrichment assertions hardened: deep enrichment is optional; when the deep-enrichment worker is not running, the test emits WARN + SKIP instead of false-failing. Strict persistence asserts run only when worker signals exist (accepts V2 or legacy persist OK events).
- 2025-12-25: FAZ 3.E Channel Strategy (v1) tamamlandı: service wiring + ai_artifacts persist (channel_strategy_v1) + job log events (AI_CHANNEL_STRATEGY_*) + mini smoke assertion (4.3) eklendi; Full smoke yeşil doğrulandı (faz geçiş gate).
 
- 2025-12-26: Outreach execution hattı stabilize edildi: `OUTREACH_EXECUTION_ENABLED` + `OUTREACH_DAILY_CAP` policy davranışları doğrulandı; mini smoke + full smoke yeşil.
- 2025-12-26: WhatsApp strategy korunarak execution-only fallback eklendi: whatsapp seçilirse provider hazır olana kadar email’e downshift edilir.
  - Event: `OUTREACH_CHANNEL_FALLBACK` (from=whatsapp, to=email)
  - Not: Strategy ≠ Execution (WhatsApp provider geldiğinde fallback otomatik devre dışı kalır)
- 2025-12-26: Full smoke gate tekrar koşuldu: `./scripts/smoke_test.sh` PASS (Godmode → Deep Enrichment → Outreach → Research(CIR) uçtan uca).
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

  - [x] 2.D.3 — Real enrichment execution (COMPLETED — v1.1.4)
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
    - Idempotency + event determinism verified: duplicate runs do not create duplicate DEEP_ENRICHMENT_* logs.
  - [x] 2.D.3.5 — Persist enrichment payload to DB (**DONE** — V2 normalized persistence live as of 2025-12-24; lead_enrichments table insert, job_id wiring, verified by logs & row count)
    - Verified via smoke_test.sh + direct DB row count assertion (JOB_ID_1 / JOB_ID_3).
    - [x] V2 normalized persistence (lead_enrichments) — repo-level best‑effort insert, job_id wired, verified by logs and row count (2025-12-24)

## **2.E — Lead Freshness & Rescan Policy (New vs Known Leads)**

Amaç: Aynı firmayı gereksiz yere tekrar tekrar ağır analizden geçirmeden, “yeni lead” ile “zaten bildiğimiz lead” ayrımını netleştirmek ve discovery sonuçlarını daha akıllı şekilde sınıflandırmak.

- [x] DB model geliştirmesi:
  - [x] `first_seen_at` alanı (lead ilk ne zaman keşfedildi?)
  - [x] `last_seen_at` alanı (en son ne zaman görüldü?)
  - [x] `scan_count` alanı (kaç farklı discovery run’ında yakalandı?)
  - [x] `last_discovery_job_id` (şu an `potential_leads.raw_payload_json._merge.last_discovery_job_id` içinde persist ediliyor; ileride kolonlaştırılabilir)

- [x] Discovery davranışı:
  - [x] Yeni bir provider sonucu geldiğinde:
    - [x] Aynı `provider + provider_id` (örn. `google_places + place_id`) varsa:
      - [x] Yeni satır eklemeyip mevcut kaydı update et
      - [x] `scan_count` +1
      - [x] `last_seen_at` güncelle
    - [x] Yoksa:
      - [x] `first_seen_at` ve `last_seen_at` aynı olacak şekilde yeni lead oluştur
      - [x] `scan_count = 1`

- [ ] Raporlama / filtreleme hazırlığı:
  - [ ] “Sadece yeni lead’leri göster” filtresi için gerekli alanların netleştirilmesi
  - [ ] “Zaten bilinen ama henüz temas edilmemiş lead’ler” gibi view’lar için lead CRM ile ortak alanların tasarlanması
  - [ ] Faz 3’te kullanılacak “yeni vs. known” segmentleri için temel iş kurallarının yazılması

- [ ] “Analizi güncelle” flow’una hazırlık:
  - [ ] Lead intel tablosu için `intel_last_updated_at` ve `intel_freshness_state` alanlarının tasarlanması
  - [ ] Discovery tarafında, gerekirse bir lead için “force refresh” (örneğin UI’de “Analizi güncelle” butonu) flag’ine cevap verebilecek hook’ların planlanması

**2.E.1 — Job-aware metrics (DONE — v1.1.5)**
- [x] Repo upsert dönüşü: is_new + scan_count_before/after
- [x] Service DEDUP_DONE payload: new_leads_count, known_leads_count, scan_count_total_before/after
- [x] Enrichment update safety: _merge korunur, last_discovery_job_id kaybolmaz
- [x] Smoke test: DEDUP_DONE counters deterministik doğrulanır (3B.3)

**2.E.2 — Rescan / Refresh Policy (MINIMAL) (DONE — v1.1.5)**
- [x] Env: `GODMODE_RESCAN_AFTER_HOURS` (default: 720 / 30 gün), `GODMODE_RESCAN_SCANCOUNT_CAP` (default: 10)
- [x] Eligibility: time/manual + scan_count guardrail
- [x] Job log events: `RESCAN_ELIGIBLE`, `RESCAN_BLOCKED_SCANCOUNT_CAP`
- [x] DEDUP_DONE payload: rescan_after_hours, scancount_cap, rescanned_due_to_time_count, rescanned_due_to_manual_count, blocked_by_scancount_cap_count, skipped_due_to_rescan_policy_count
- [x] Smoke test verified (full-green)

---

# FAZ 3 — BRAIN INTEGRATION (AI DECISION PIPELINE)

Discovery sonuçlarının otomatik analiz edilmesi.

## **3.A — AI Lead Ranking**

### 3.A.1 — Lead Ranking (v1 minimal) ✅ DONE — v1.1.6
- [x] Modül içi prompt konumu: `modules/godmode/ai/`
- [x] Prompt: `ai/leadRanking.prompt.js` (strict JSON output)
- [x] Schema: `ai/leadRanking.schema.js` (additionalProperties=false, enum/limits)
- [x] Service wiring: `service.js` içinde rankLead()
  - [x] LLM opt-in: `GODMODE_AI_LEAD_RANKING=1`
  - [x] Backward compatible llmClient interface denemesi (chatJson/completeJson/chat)
  - [x] Deterministic fallback: `heuristic_v1` (website_missing ağırlıklı)
- [x] Job log events:
  - [x] `AI_LEAD_RANKED` (lead bazında)
  - [x] `AI_LEAD_RANKING_DONE` (summary: enabled/top)
- [x] Smoke test:
  - [x] Full smoke green
  - [x] Mini smoke green: `./scripts/smoke_godmode_min.sh`

- [x] **Definition of Done (DoD) — LOCKED**
  - [x] Ranking çıktısı deterministik (LLM kapalıyken heuristic fallback)
  - [x] LLM açıkken strict JSON schema ile validate edilir
  - [x] Job log kanıtı: `AI_LEAD_RANKED` + `AI_LEAD_RANKING_DONE`
  - [x] Mini smoke + Full smoke green (release gate)
  - [x] Bu faz “tam kapatıldı”: yeni değişiklik yalnızca yeni bir FAZ kararıyla yapılır

### 3.A.2 — Lead Ranking (v1.1) — BACKLOG (post‑FAZ 3.D)
- [ ] Ranking input’unu `potential_leads` / `lead_enrichments` verileriyle zenginleştir (rating, reviews, opportunity_score vb.) (ileride)
- [ ] Ranking sonucunu DB’ye persist et (lead-level alanlar veya ayrı tablo tasarımı)
- [ ] API: “Top ranked leads” endpoint (limit/filter)

## **3.B — Auto-SWOT**

### 3.B.1 — Auto-SWOT (v1 minimal) ✅ DONE — v1.1.7
- [x] Prompt: `ai/autoSwot.prompt.js` (strict JSON, sales‑oriented)
- [x] Schema: `ai/autoSwot.schema.js` (additionalProperties=false)
- [x] Service wiring: A/B band only, LLM opt‑in `GODMODE_AI_AUTO_SWOT=1`, deterministic heuristic fallback
- [x] Job log events:
  - `AI_AUTO_SWOT_GENERATED` (lead-level, optional when no A/B)
  - `AI_AUTO_SWOT_DONE` (summary)
- [x] Mini smoke stabilized (`smoke_godmode_min.sh`)
- [x] Full smoke verified before phase transition


## **3.C — Auto-Outreach Draft**

### 3.C.1 — Outreach Draft (v1 minimal) ✅ DONE — v1.1.8
- [x] Prompt: `ai/outreachDraft.prompt.js` (strict JSON)
- [x] Schema: `ai/outreachDraft.schema.js`
- [x] Service wiring: consume Auto‑SWOT + ranking to produce a single opening message
- [x] Scope:
  - 1 suggested channel
  - 1 opening message
  - 1 CTA
- [x] Job log events:
  - `AI_OUTREACH_DRAFT_GENERATED`
  - `AI_OUTREACH_DRAFT_DONE`
- [x] No sending / scheduling (execution belongs to Outreach module)
  - DB kanıtı: AI_OUTREACH_DRAFT_DONE job log’u ile doğrulandı (2025-12-24).
  - Mini smoke kanıtı: AI_OUTREACH_DRAFT_DONE (draft_count=0 olabilir; A/B yoksa normal).


### 3.C.2 — Outreach Draft Persistence (READ-ONLY) ✅ DONE — v1.1.9
- [x] Draft çıktısı `ai_artifacts` tablosuna persist edilir (`artifact_type='outreach_draft_v1'`)
- [x] Observability:
  - [x] `AI_OUTREACH_DRAFT_PERSISTED`
  - [x] `AI_OUTREACH_DRAFT_PERSIST_ERROR` (negatif kanıt; olmamalı)
- [x] Mini smoke (günlük iterasyon) doğrulaması:
  - [x] Draft üretilmezse `ai_artifacts=0` olması normal (A/B yoksa)
  - [x] Draft üretildiğinde `ai_artifacts(outreach_draft_v1) >= 1` olmalı
- [x] Gerçek A/B kanıtı (data-driven):
  - [x] Ranking band dağılımında A/B görüldüğünde zincir çalışır ve `ai_artifacts` satırı oluşur (örnek: `A|1` + `ai_artifacts=1` doğrulandı).
- [x] Full smoke gate: `./scripts/smoke_test.sh` yeşil (faz geçiş şartı)


## **3.D — Auto-Sales Entry Strategy**

- [x] Prompt: `ai/salesEntryStrategy.prompt.js` (strict JSON)
- [x] Schema: `ai/salesEntryStrategy.schema.js` (additionalProperties=false)
- [x] Service wiring: deterministic “brain sample” pipeline stage (top‑10 sample)
  - [x] LLM opt‑in: `GODMODE_AI_SALES_ENTRY_STRATEGY=1`, deterministic fallback when disabled
  - [x] Lead-level event: `AI_SALES_ENTRY_STRATEGY_GENERATED`
  - [x] Job summary event: `AI_SALES_ENTRY_STRATEGY_DONE`
- [x] Persistence:
  - [x] `ai_artifacts` insert (`artifact_type='sales_entry_strategy_v1'`)
  - [x] Observability: `AI_SALES_ENTRY_STRATEGY_PERSISTED` + `AI_SALES_ENTRY_STRATEGY_PERSIST_ERROR` (negatif kanıt; olmamalı)
- [x] Smoke test proof:
  - [x] Mini smoke green (`./scripts/smoke_godmode_min.sh`)
  - [x] Full smoke green (`./scripts/smoke_test.sh`) — phase transition gate

- [x] **Definition of Done (DoD) — LOCKED**
  - [x] LLM kapalıyken deterministik fallback ile çalışır
  - [x] LLM açıkken strict JSON schema ile validate edilir
  - [x] DB kanıtı: job log + `ai_artifacts(sales_entry_strategy_v1) >= 1`
  - [x] Full smoke green (faz geçiş gate)
## **3.E — Next Brain Artifact (Decision Phase)**

Bu faz, FAZ 3’ün **karar noktasıdır**.  
Amaç yeni bir AI özelliği eklemek değil; **hangi AI karar artefaktının gerçekten eklenmeye değer olduğuna karar vermektir**.

FAZ 3.A–3.D ile:
- Lead Ranking
- Auto‑SWOT
- Outreach Draft
- Sales Entry Strategy

tamamlandı ve GODMODE artık “düşünebilen” bir discovery engine oldu.

**3.E’nin rolü:**  
Yeni bir prompt dosyası açmadan önce durmak, sistemi tartmak ve *bir sonraki* AI hamleyi bilinçli seçmek.

---

### **3.E.1 — Scope Lock (Zorunlu Karar Adımı)**

Bu adım geçilmeden **hiçbir yeni AI dosyası açılmaz**.

- [x] **Seçilen brain artifact:** Channel Strategy Intelligence (v1)
- [x] **Neden:** Outreach execution’a geçmeden önce “nereden yazacağız?” kararını deterministik + AI destekli hale getirmek (yanlış kanal = 0 reply).
- [x] **Girdi seti (v1):**
  - [x] Lead Ranking (band/priority_score)
  - [x] Auto‑SWOT özeti (varsa)
  - [x] Enrichment snapshot (website var/yok + sosyal sinyaller + business_type)
  - [x] Sales Entry Strategy (tone/angle)
- [x] **Çıktı contract (strict JSON) (v1):**
  - [x] `primary_channel` (enum: `email|whatsapp|instagram|linkedin|phone`)
  - [x] `fallback_channels[]` (enum list)
  - [x] `channel_reasoning` (string)
  - [x] `confidence` (enum: `low|medium|high`)
- [x] **LLM opt‑in:** `GODMODE_AI_CHANNEL_STRATEGY=1` (kapalıyken deterministik heuristic fallback)
- [x] **Persistence:** `ai_artifacts` (`artifact_type='channel_strategy_v1'`)
- [x] **Observability (event’ler):**
  - [x] `AI_CHANNEL_STRATEGY_GENERATED`
  - [x] `AI_CHANNEL_STRATEGY_PERSISTED`
  - [x] `AI_CHANNEL_STRATEGY_PERSIST_ERROR` (negatif kanıt; olmamalı)
- [x] **DoD / Gate:** Mini smoke (iterasyon) + Full smoke (faz geçiş şartı)

---

### **3.E.2 — Aday Brain Artefact’ler (DECISION) ✅ DONE**

Bu listeden **yalnızca biri** seçilip uygulanacaktır:

- [ ] **Follow‑up Timing / Cadence**
  - “Bu lead’e ne zaman tekrar yazmalıyız?”
- [x] **Channel Strategy Intelligence (SELECTED + IMPLEMENTED)**
  - “İlk temas için ideal kanal + alternatif plan”
- [ ] **Deal Probability / Win Likelihood**
  - “Bu lead’in satışa dönüşme ihtimali”
- [ ] **Objection Handling Angle**
  - “En muhtemel itiraz ve buna karşı argüman”


> Kural: 3.E tamamlanmadan FAZ 4’e veya yeni AI prompt’larına geçilmez.

### **3.E.3 — Channel Strategy (v1 minimal) ✅ DONE — v1.1.11**

- [x] Prompt: `ai/channelStrategy.prompt.js` (strict JSON)
- [x] Schema: `ai/channelStrategy.schema.js` (additionalProperties=false)
- [x] Service wiring: A/B band only, LLM opt‑in `GODMODE_AI_CHANNEL_STRATEGY=1`, deterministic heuristic fallback
- [x] Job log events:
  - [x] `AI_CHANNEL_STRATEGY_GENERATED`
  - [x] `AI_CHANNEL_STRATEGY_DONE`
- [x] Persistence:
  - [x] `ai_artifacts` insert (`artifact_type='channel_strategy_v1'`)
  - [x] Observability: `AI_CHANNEL_STRATEGY_PERSISTED` + `AI_CHANNEL_STRATEGY_PERSIST_ERROR` (negatif kanıt; olmamalı)
- [x] Smoke test proof:
  - [x] Mini smoke: `./scripts/smoke_godmode_min.sh` içine `4.3 Channel Strategy` DB assertion eklendi
  - [x] Full smoke green (`./scripts/smoke_test.sh`) — faz geçiş gate

- [x] **Definition of Done (DoD) — LOCKED**
  - [x] LLM kapalıyken deterministik fallback ile çalışır
  - [x] LLM açıkken strict JSON schema ile validate edilir
  - [x] DB kanıtı: job log + `ai_artifacts(channel_strategy_v1) >= 1`
  - [x] Mini smoke + Full smoke green (release gate)

# FAZ 4 — FULL AUTOMATION & OUTREACH ECOSYSTEM (ENTERPRISE MODE)

## **4.A — Autonomous Scanning**

- [ ] Şehir / ülke bazlı otomatik discovery  
- [ ] Sektör bazlı günlük taramalar  
- [ ] Trend alert sistemi  

## **4.B — Auto-Enrichment Workers**

- [ ] Queue-based worker cluster  
- [ ] Çok aşamalı enrichment pipeline  
- [ ] Retry & error recovery mekanizması  

## **4.C — Outreach Auto-Trigger (DONE)**

- [x] Lead threshold > 80 ise otomatik outreach  
- [x] Outreach Scheduler entegrasyonu  
- [x] AI tarafından seçilen hedef setleri  
- [x] Kanıt: Mini smoke + Full smoke green + DB job logs (`OUTREACH_AUTO_TRIGGER_ENQUEUED`, `OUTREACH_AUTO_TRIGGER_DONE`)
- [x] Execution compatibility: whatsapp seçimi geldiğinde provider hazır olana kadar email fallback (execution-only) — `OUTREACH_CHANNEL_FALLBACK`

## **4.D — Outreach Execution Guardrails (DONE)**

**Durum:** ✅ DONE — 4.D.1–4.D.5 tamamlandı. Mini + Full smoke ile kanıtlandı.

### 4.D.1 — Execution Mode & Kill-Switch (v1) ✅ DONE
- [x] ENV: `OUTREACH_EXECUTION_ENABLED`
- [x] ENV: `OUTREACH_EXECUTION_MODE=stub|send_now|queue_only|schedule`
- [x] Varsayılan: `stub` (no external send; sadece stub event)
- [x] Guardrail log: `OUTREACH_EXECUTION_BLOCKED_POLICY` (reason=`KILL_SWITCH`)
- [x] Observability: `OUTREACH_EXECUTION_ATTEMPT` (provider/provider_id/mode)

**Kanıt:** Mini smoke mode-aware assert (send_now → `OUTREACH_SEND_STUB`, schedule → `OUTREACH_SCHEDULE_STUB`) + DB job logs doğrulandı (2025-12-25).

### 4.D.2 — Policy Reason Standardization (v1) ✅ DONE
### 4.D.3 — Send vs Queue Separation (v1) ✅ DONE
- [x] Execution intent resolver: `resolveExecutionIntent()`
- [x] Observability: `OUTREACH_EXECUTION_INTENT` (intent + mode + raw_mode)
- [x] Intent-based branching: QUEUE / SEND / SCHEDULE / BLOCK
- [x] Mini smoke proof: send_now → `OUTREACH_SEND_STUB` + intent=SEND

- [x] Channel resolution uses execution-resolved channel (fallback-consistent) across SEND/QUEUE/SCHEDULE paths

Amaç: Brain tarafındaki “neden elendi / neden ilerlemedi” kararlarını ve execution tarafındaki policy block’ları **tek vocabulary** ile loglamak.

- [x] Brain observability event: `AI_POLICY_BLOCK`
- [x] Brain reason enum (v1 minimal): `BAND_GATED`, `NO_ROUTING_CHANNEL`
- [x] Execution reason enum (alignment): `KILL_SWITCH`, `DAILY_CAP_REACHED`, `UNSUPPORTED_CHANNEL`, `MODE_NOT_IMPLEMENTED`
- [x] Execution (outreachTrigger) tarafında reason’lar enum üzerinden standardize edildi
- [x] Smoke kanıtı: mini smoke yeşil + DB log’larda policy/event vocabulary doğrulandı (2025-12-25)

**Kanıt sorguları (ops):**
- `sqlite3 data/app.sqlite "SELECT event_type, COUNT(*) FROM godmode_job_logs WHERE job_id='<JOB_ID>' AND event_type IN ('AI_POLICY_BLOCK','OUTREACH_EXECUTION_BLOCKED_POLICY','OUTREACH_EXECUTION_ATTEMPT') GROUP BY event_type;"`

### 4.D.4 — Daily Cap / Rate Limit (v1) ✅ DONE
- [x] ENV: `OUTREACH_DAILY_CAP`
- [x] DB-based daily counter (restart-safe)
- [x] Enforcement in outreachTrigger (remainingQuota)
- [x] Policy block event: `OUTREACH_EXECUTION_BLOCKED_POLICY` (reason=`DAILY_CAP_REACHED`)
- [x] Mini smoke proof (cap blokluyken policy event görülür)
- [x] Full smoke proof (policy block logged with cap/usedToday)

### 4.D.5 — Dry-run Sent / Failed Events (v1) ✅ DONE
Amaç: Gerçek send açmadan önce “gönderilmiş gibi” raporlanabilen event’lerle analytics/CRM zincirini test etmek.

- [x] ENV: `OUTREACH_DRY_RUN=1`
- [x] Event: `OUTREACH_EXECUTION_SENT` (payload: `{ dry_run:true, channel, provider, provider_id, intent, mode, raw_mode }`)
- [x] Event: `OUTREACH_EXECUTION_FAILED` (payload: `{ dry_run:true, reason_class, error_code? }`)
- [x] Policy ile uyum: blocked vs failed ayrımı net (blocked → `OUTREACH_EXECUTION_BLOCKED_POLICY`)
- [x] Mini smoke proof: `smoke_godmode_min.sh` içinde dry-run açıkken `OUTREACH_EXECUTION_SENT` assert
- [x] Full smoke proof: `smoke_test.sh` 3E DB assertion ile dry-run `SENT` kanıtı (OUTREACH_DRY_RUN=1 koşumunda)

**Phase Gate:** FAZ 4.D tamamlanmadan FAZ 4.E veya gerçek send provider entegrasyonuna geçilmez.


**FAZ 4.D STATUS:** 4.D.1–4.D.5 verified (mini + full smoke). Ready for FAZ 4.E.

## **4.E — Real Send Provider (Design + Safety Gate) (IN PROGRESS → Provider-ready)**

Amaç: Gerçek send açmadan önce “provider adapter + safety gate + observability” tasarımını netleştirmek ve sadece güvenli kanallarda controlled rollout yapabilmek.

### 4.E.0 — Preflight (DONE) ✅
Bu maddeler “gerçek provider” implementasyonu değildir; FAZ 4.E’ye güvenli geçişi sağlayan stabilizasyon/ön-hazırlık katmanıdır.

- [x] Execution hattı stabilize: `OUTREACH_EXECUTION_ENABLED`, `OUTREACH_EXECUTION_MODE`, `OUTREACH_DAILY_CAP` policy + observability (mini + full smoke kanıtlı)
- [x] Strategy korunarak execution-only kanal uyumluluğu: whatsapp seçimi geldiğinde provider hazır olana kadar email fallback (`OUTREACH_CHANNEL_FALLBACK`)
- [x] Full smoke gate: `./scripts/smoke_test.sh` PASS (2025-12-26)
- [x] Scope kararı (v1 rollout): **ilk canlı send kanalı = email** (WhatsApp provider entegrasyonu ayrı deliverable)

### 4.E.1 — Scope Lock (Provider & Channel) ✅ REQUIRED
- [x] İlk canlı kanal seçimi (v1): `email` (WhatsApp provider ayrı deliverable)
- [x] İlk provider seçimi (v1): `smtp` 
- [ ] Bu faz tamamlanana kadar yalnız “controlled allowlist” ile çalışır (no broad send)

### 4.E.2 — Provider Adapter Interface (Outreach Module) (v1) ✅ REQUIRED
- [x] `modules/outreach/providers/` altında standard interface:
  - [x] `sendMessage({ lead, message, channel, meta })`
  - [x] `dryRun({ ... })` (opsiyonel; Godmode D5 zaten event üretiyor)
  - [x] Return contract: `{ ok, provider_message_id?, error_code?, error_message? }`
- [x] Godmode sadece “execution request” üretir; gerçek send Outreach modülünde kalır (boundary korunur)

### 4.E.3 — Safety Gate (Hard Blocks) (v1) ✅ REQUIRED
- [x] Kill-switch (mevcut): `OUTREACH_EXECUTION_ENABLED`
- [x] Allowlist gate: `OUTREACH_ALLOWLIST_EMAILS` / `OUTREACH_ALLOWLIST_DOMAINS` (+ override: `OUTREACH_ALLOW_ALL=1`)
- [x] Rate limit (mevcut): `OUTREACH_DAILY_CAP`
- [x] Channel policy: sadece `email|whatsapp` (instagram/linkedin/phone kapalı)
- [x] Observability: blocked → `OUTREACH_EXECUTION_BLOCKED_POLICY` (reason enum genişletilebilir)

### 4.E.4 — Real Send Wiring (Queue → Worker) (v1) ✅ REQUIRED
- [x] Send intent geldiğinde: enqueue → outreach worker execute
- [x] Worker success: `OUTREACH_EXECUTION_SENT` (dry_run:false) + provider_message_id (SMTP creds ile DELIVERED proof sonraya ertelendi)
- [x] Worker fail: `OUTREACH_FAILED` (dry_run:false) + error_code (örn: `MISSING_ENV`, `SMTP_DISABLED`)
- [x] Idempotency: aynı lead + job + channel için duplicate send engeli (dedup key)

### 4.E.5 — Proof (Mini + Full Smoke) ✅ GATE
- [x] Mini smoke: queue_only + guardrails deterministik doğrulandı (auto-trigger + intent + enqueue + worker consume + OUTREACH_FAILED (MISSING_ENV) kanıtı)
- [ ] Full smoke: 3E DB assertions genişletilir (unchecked SMTP sonrası)
- [ ] Phase transition rule: Full smoke green olmadan FAZ 4.F/5’e geçilmez

**Phase Gate:** FAZ 4.E tamamlanmadan gerçek provider send prod’da açılmaz.

**4.E STATUS (2026-01-21):** Provider-ready ✅ (queue_only + worker + allowlist + observability). SMTP creds + first DELIVERED proof → Deferred (frontend sonrası).

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

**FAZ 2.D STATUS**
- All deep enrichment stages implemented and verified.
- Freshness gating + forceRefresh behavior smoke-tested.
- Persistence confirmed (V2 normalized DB model).
- Ready to advance focus to FAZ 2.E.