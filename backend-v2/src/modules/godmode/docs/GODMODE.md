# GODMODE Discovery Engine — v1.1.2-live
Next-gen Omni-Data Discovery Pipeline

GODMODE, CNG AI Agent ekosistemi içinde yer alan yüksek kapasiteli tarama, keşif ve zeka toplama motorudur.  
Faz 1 itibarıyla, tek provider üzerinden tam entegre çalışan bir keşif pipeline’ı, kalıcı job sistemi ve event-log tabanlı izlenebilirlik sağlar.  
Faz 2 ile çok sağlayıcılı (multi-provider), paralel çalışan ve AI destekli bir discovery brain’e evrilecektir.

---

# ✔️ **Sürüm Bilgisi**
- **Version:** `v1.1.2-live`
- **Release Date:** 2025-12-23
- **Status:** Production-grade stable (Faz 1 tamamlandı, Faz 2 aktif geliştirme)
- **Next Target:** Faz 2 — Deep Enrichment, Freshness & Multi-Provider Expansion

---

# 🚀 **Öne Çıkan Özellikler (Faz 1 Final)**

### **1. Gerçek Discovery Motoru**
- Google Places Text Search + Place Details entegrasyonu
- Twin-phase pipeline: `discovery → enrichment`
- Canlı & mock çalışma modu (`GODMODE_DISCOVERY_MODE`)

### **2. Güçlü Job Sistemi (Persistent Memory v1)**
- SQLite üzerinde kalıcı job store
- Backend yeniden başlasa bile tüm geçmiş korunur
- Status akışı:
  - `queued → running → completed` veya `failed`

### **3. Sağlam Validasyon Katmanı**
- İş oluşturma sırasında tüm gerekli alanlar kontrol edilir
- Hatalı input → `VALIDATION_ERROR`
- `maxResults` otomatik upper-bound (250)

### **4. Normalize Provider Error Handling**
- Tüm sağlayıcı hataları tek formatta:
  ```json
  { "provider": "google_places", "error_code": "HTTP_ERROR", "error_message": "…" }

  	•	Hatalar kaybolmaz → result_summary.provider_errors içerisinde tutulur

5. Event Log Sistemi (Job Timeline)

Her job için adım adım event kaydı tutulur:
	•	QUEUED
	•	RUN_START
	•	PROVIDER_PAGE
	•	COMPLETED
	•	FAILED
	•	DEEP_ENRICHMENT_TECH_STUB
	•	DEEP_ENRICHMENT_WEBSITE_MISSING
	•	DEEP_ENRICHMENT_WEBSITE_FETCH_FAILED
	•	DEEP_ENRICHMENT_V2_REPO_PERSIST_TRY
	•	DEEP_ENRICHMENT_V2_REPO_PERSIST_OK
	•	DEEP_ENRICHMENT_V2_REPO_PERSIST_ERROR

Tablo: godmode_job_logs

Sorgu örneği:

SELECT * FROM godmode_job_logs WHERE job_id = ? ORDER BY id;

6. Worker Orchestration Stub

Discovery tamamlandığında otomatik tetikleme:
	•	dataFeederWorker → aktif stub
	•	İleride:
	•	Entity Resolver Worker
	•	Economic Analyzer Worker
(Tam pipeline Faz 3-4 ile devreye girer)

7. Lead Pipeline Entegrasyonu

Normalize edilmiş provider verileri:
	•	potential_leads tablosuna UPSERT edilir
	•	Duplicate koruması vardır
	•	Log:

    [GODMODE][PIPELINE] potential_leads upsert tamamlandı. affected=N

### **8. V2 Normalize Enrichment Persistence (NEW)**
- Deep enrichment çıktıları artık normalize şekilde saklanır
- Yeni tablo: `lead_enrichments`
- Snapshot bazlı tasarım:
  - job_id
  - lead_id
  - provider / provider_id
  - seo / social / tech / opportunity JSON alanları
  - created_at
- Repo seviyesinde best‑effort persist:
  - Service branch’lerinden bağımsız
  - V1 (`potential_leads.raw_payload_json`) bozulmadan korunur
- Event log kanıtları:
  - `DEEP_ENRICHMENT_V2_REPO_PERSIST_TRY`
  - `DEEP_ENRICHMENT_V2_REPO_PERSIST_OK`

🧩 Mimari

godmode/
│
├── api/
│   ├── controller.js       → Endpoint actions
│   └── routes.js           → /api/godmode/*
│
├── docs/
│   ├── GODMODE.md          → Teknik dokümantasyon
│   └── GODMODE_ROADMAP.md  → Yol haritası
│
├── pipeline/
│   └── discoveryPipeline.js → Provider → Normalize → Result builder
│
├── providers/
│   ├── googlePlacesProvider.js
│   ├── index.js            → Provider registry
│   └── providersRunner.js  → Provider orchestrator
│
├── repo.js                 → DB access layer (v2 enrichment persistence burada)
├── service.js              → Job management + business logic
├── validator.js            → Job input validation
│
└── workers/
    ├── dataFeederWorker.js
    ├── economicAnalyzerWorker.js
    └── entityResolverWorker.js

🧬 Job Yaşam Döngüsü

1. Create discovery job

POST /api/godmode/jobs/discovery-scan
	•	Validasyon yapılır
	•	Job DB’den kaydedilir
	•	Event log: QUEUED

2. Run

POST /api/godmode/jobs/:id/run
	•	Status → running
	•	Event log: RUN_START

3. Provider çalışma akışı

Her sayfa:
	•	Event log: PROVIDER_PAGE
	•	Lead normalize → sample_leads snapshot
	•	Lead UPSERT → potential_leads

4. Tamamlama
	•	Progress %100
	•	Summary üretilir
	•	Event log: COMPLETED
	•	Worker tetiklenir

5. Hata olursa
	•	Job → failed
	•	Event log: FAILED
	•	error alanı doldurulur

⸻

---

# 🧠 Faz 2 — Aktif Özellikler (v1.1.x)

### **8. Freshness & forceRefresh Mekanizması**
- Lead freshness window ile gereksiz enrichment engellenir
- `forceRefresh: true` gönderildiğinde:
  - Fresh lead olsa bile enrichment çalışır
  - Freshness gating bypass edilir
  - refresh metriği loglanır

### **9. Deep Enrichment Pipeline**
- Discovery sonrası manuel veya planlı tetiklenebilir
- Çalışan enrichment türleri:
  - Website fetch
  - Tech fingerprint (stub)
- Google Place Details fallback:
  - Website yoksa otomatik denenir
  - Rate-limit safe (429 kovalanmaz)
- V2 persistence aktif:
  - Enrichment snapshot’ları `lead_enrichments` tablosuna yazılır
  - Idempotent ve job‑aware çalışır

### **10. Idempotent Enrichment Execution**
- Aynı `jobId + google_place_id` için:
  - Tech stub
  - Website missing
  event’leri **sadece bir kez** loglanır
- Tekrar consumer çalıştırmak güvenlidir

### **11. Gelişmiş İzlenebilirlik (Observability)**
Yeni event türleri:
- `DEEP_ENRICHMENT_TECH_STUB`
- `DEEP_ENRICHMENT_WEBSITE_MISSING`
- `DEEP_ENRICHMENT_WEBSITE_FETCH_FAILED`

⸻

🌐 API Referansı

GET /api/godmode/status

Modül sağlık bilgisi (yakında genişletilecek)

⸻

POST /api/godmode/jobs/discovery-scan

Yeni discovery job oluşturur.

Example request:

{
  "label": "Finding architecture firms",
  "city": "İstanbul",
  "country": "Türkiye",
  "categories": ["mimarlık ofisi"],
  "minGoogleRating": 3.5,
  "maxResults": 50,
  "channels": ["google_places"],
  "notes": "Daily Istanbul scan"
}

POST /api/godmode/jobs/:id/run

Job’ı başlatır.

⸻

GET /api/godmode/jobs

Tüm job’ların güncel snapshot’ı.

⸻

GET /api/godmode/jobs/:id

Tek job’ın tüm detayları + summary + provider errors + event logs (v2’de entegre edilecek)

⸻

GET /api/godmode/jobs/:id/logs
→ Job’a ait tüm event log’ları döner

GET /api/godmode/jobs/:id/logs/deep-enrichment
→ Sadece deep enrichment event’lerini döner

---

## 🔁 Deep Enrichment (Manuel Çalıştırma)

Aynı discovery job’u için deep enrichment consumer’ı manuel tetiklemek mümkündür.

Örnek:

```js
processDeepEnrichmentBatch({
  jobId: "<JOB_ID>",
  ids: ["<GOOGLE_PLACE_ID>", "..."],
  sources: ["website", "tech"]
});
```

Bu işlem:
- Mevcut discovery sonuçlarını kullanır
- Yeni provider çağrısı yapmaz (güvenli)
- Idempotent çalışır
