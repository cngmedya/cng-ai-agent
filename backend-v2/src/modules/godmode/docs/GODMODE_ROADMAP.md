# GODMODE Discovery Engine — ROADMAP (v1.0)

Bu dosya, CNG AI Agent içerisinde yer alan **GODMODE Discovery Engine** modülünün tam gelişim yol haritasıdır.  
Her faz tamamlandıkça işaretlenir ve yeni görevler sprint’lere göre eklenir.

---

# FAZ 1 — CORE DISCOVERY ENGINE (MVP → STABLE)

**Durum:** ✅ TAMAMLANDI — v1.0.0-live  
Bu faz ile GODMODE'un temel iskeleti oluşturuldu.  
Artık sistem:

- Discovery job yaratabiliyor  
- Job’ları memory + SQLite hibrit modelde tutuyor  
- Mock & Live (Google Places) modunda çalışabiliyor  
- Manual run destekliyor  
- İş geçmişi restart sonrası kaybolmuyor  

---

## **1.A — MODULE BOOTSTRAP (CORE)**
Temel GODMODE modül yapısının oluşturulduğu aşama.

### Yapılanlar
- [x] `modules/godmode` klasör yapısı kuruldu  
- [x] API routing: `/api/godmode/*`  
- [x] Controller yapısı oluşturuldu  
- [x] Service iskeleti hazırlandı  
- [x] Worker dosyaları oluşturuldu:
  - `dataFeederWorker.js`
  - `economicAnalyzerWorker.js`
  - `entityResolverWorker.js`
- [x] `GODMODE.md` ve `GODMODE_ROADMAP.md` oluşturuldu  

---

## **1.B — JOB MANAGEMENT SYSTEM (In-Memory v1)**

### Yapılanlar
- [x] In-memory JOB STORE  
- [x] Job CRUD endpointleri:
  - GET `/jobs`
  - GET `/jobs/:id`
  - POST `/jobs/discovery-scan`
- [x] UUID job id  
- [x] Job durumları: `queued`, `running`, `completed`, `failed`  
- [x] Job progress modeli:
  - percent  
  - found_leads  
  - enriched_leads  

---

## **1.C — MOCK DISCOVERY ENGINE**
Gerçek veri olmadan pipeline test edebilmek için.

### Yapılanlar
- [x] Mock discovery provider  
- [x] Fake lead generation  
- [x] Fake enrichment  
- [x] Mock summary üretimi  
- [x] `%100` completion logic  
- [x] Manual run:  
  - POST `/jobs/:id/run`

---

## **1.D — REAL DISCOVERY ENGINE (Google Places v1.0.0-live)**

### Yapılanlar
- [x] Google Places TextSearch API entegrasyonu  
- [x] Live vs Mock switch:  
  - `GODMODE_DISCOVERY_MODE=0|1|mock|live`  
- [x] Rate-limit uyumlu sayfalama  
- [x] Kullanıcı rating filtresi (minGoogleRating)  
- [x] maxResults uygulaması  
- [x] Tüm raw sonuçlar normalize edildi  
- [x] 20 örnek lead summary’e yazılıyor  
- [x] İstanbul testleri (`50` ve `100`) tamamlandı  

---

## **1.E — CONFIGURATION SYSTEM**
Geliştirme & prod ortam yönetimi için.

### Yapılanlar
- [x] `GOOGLE_PLACES_API_KEY`  
- [x] `GODMODE_DISCOVERY_MODE`  
- [x] `GODMODE_MAX_RESULTS`  
- [x] Providers used → job summary içine yazılıyor  

---

## **1.F — JOB PERSISTENCE SYSTEM (SQLite v1.0)**  
**Durum:** ✅ TAMAMLANDI

### DB Şeması
- [x] `godmode_jobs`  
- [x] `godmode_job_progress`  
- [x] `godmode_job_results`  

### Repo
- [x] insertJob  
- [x] updateJob  
- [x] loadAllJobs (JOIN’li hydrate)  
- [x] saveJobResult  
- [x] saveProgress  

### Service
- [x] Memory + DB hibrit model  
- [x] Boot sırasında yarım kalan işlerin auto-recovery  
- [x] Summary yazma sistemi  
- [x] Fail-safe error handling  

### Controller
- [x] Tüm endpointler DB ile senkron  
- [x] `JOB_NOT_FOUND` senaryosu test edildi  

### Ekstra Eklenenler (Faz 1 sırasında)
- [x] SQLite bootstrap hataları giderildi  
- [x] Tabloların eksik olması durumunda otomatik schema creation  
- [x] Faz 1 smoke testleri başarıyla tamamlandı  

---

## **1.G — CORE HARDENING & STABILITY EXTENSIONS (Mini-Geliştirmeler)**  
Faz 1 tamamlandıktan sonra sistemi production seviyesine yaklaştırmak için eklenen sağlamlaştırma adımları.

### Yapılanlar
- [x] **Job Validation Layer**
  - [x] city / country zorunlu alan validasyonu  
  - [x] categories → string array normalizasyonu  
  - [x] minGoogleRating 0–5 arası clamp  
  - [x] maxResults ≤ 250 hard-limit (üstü otomatik 250’ye çekiliyor)  
  - [x] Payload format hataları için tutarlı error response modeli (`GODMODE_CREATE_JOB_ERROR`)  

- [ ] **Provider Error Normalization**
  - Google Places hatalarının normalize edilmesi  
  - Tek tip provider error objesi: `{ provider, error_code, error_message }`  
  - Job summary içine `provider_errors` ek alanı  
  - Partial-success senaryoları için ayrıştırma  

- [ ] **Job Event Log System**
  - Yeni tablo: `godmode_job_logs`  
  - Her job için adım adım event kaydı  
  - Örnek: queued → running → provider page fetch → completed  
  - Debugging & monitoring için güçlü temel  

- [ ] **Worker Orchestration Stub Integration**
  - Discovery tamamlandığında worker tetikleme altyapısı  
  - dataFeederWorker → temel tetik oluşturuldu  
  - Faz 2’de genişletilecek worker pipeline’a hazırlık  

---

# FAZ 2 — OMNI-DATA FEEDER (MULTI PROVIDER DISCOVERY ENGINE)

Bu faz ile GODMODE tek bir provider’dan (Google Places) çıkar ve gerçek bir **çok kaynaklı discovery motoruna** dönüşür.

---

## **2.A — PROVIDER ABSTRACTION LAYER (PAL)**

- [ ] Unified provider interface  
- [ ] Provider health check  
- [ ] Rate limit yönetimi  
- [ ] Provider fallback mekanizması  

---

## **2.B — 5+ DISCOVERY PROVIDER ENTEGRASYONU**

Providers:
- [ ] Google Places (faz 2’de harden)  
- [ ] LinkedIn Business Search  
- [ ] Instagram Business Graph API  
- [ ] Facebook Graph  
- [ ] Foursquare / Yelp  
- [ ] MERSİS / Ticaret Sicil  

---

## **2.C — PARALLEL DISCOVERY ENGINE**

- [ ] Paralel provider scanning  
- [ ] Duplicate merging engine  
- [ ] Confidence scoring  
- [ ] Source-weighting sistemi  

---

## **2.D — DEEP ENRICHMENT PIPELINE**

- [ ] Website scraping (cheerio)  
- [ ] Wappalyzer Lite – teknoloji stack tespiti  
- [ ] SEO sinyalleri  
- [ ] Sosyal medya varlık analizi  
- [ ] Meta / Google Ads tag detection  

---

# FAZ 3 — AI BRAIN INTEGRATION

Discovery sonuçlarını otomatik analiz eden bir yapay zeka katmanı.

---

## **3.A — AI Lead Ranking**
- [ ] Lead AI Score v2  
- [ ] Opportunity score  
- [ ] Risk profile  
- [ ] Industry-fit indeks  

---

## **3.B — Auto-SWOT**
- [ ] Lead özel SWOT  
- [ ] Pazar karşılaştırmalı SWOT  
- [ ] Fırsat/tehdit haritaları  

---

## **3.C — Auto-Sales Strategy**
- [ ] Hedeflenen entry channel  
- [ ] Açılış mesajı  
- [ ] Red flags & risk uyarıları  
- [ ] Sıcak lead için action plan  

---

# FAZ 4 — FULL AUTOMATION & OUTREACH ECOSYSTEM

---

## **4.A — Autonomous Scanning**
- [ ] Şehir/ülke bazlı otomatik tarama  
- [ ] Trend-based scanning  
- [ ] Predictive discovery  

---

## **4.B — Auto-Enrichment Workers**
- [ ] Worker cluster  
- [ ] Çok aşamalı enrichment  
- [ ] Retry & recovery  

---

## **4.C — Outreach Auto-Trigger**
- [ ] Lead AI Score > 80 → Outreach trigger  
- [ ] Outreach Scheduler  
- [ ] Auto-target grouping  

---

# FAZ 5 — ANALYTICS & INSIGHT HUB

## **5.A — Discovery Metrics**
- [ ] Provider accuracy  
- [ ] Trend heatmap  
- [ ] Günlük/haftalık traffic  

## **5.B — Lead Intelligence Reports**
- [ ] PDF pipeline  
- [ ] Bölgesel raporlar  
- [ ] Sektör fırsat analizleri  

---

# NOTLAR
- Roadmap her sprint sonunda güncellenir  
- Fazlar birbirine bağımlı ilerler  
- Yeni fazlar, ihtiyaç oldukça eklenir  