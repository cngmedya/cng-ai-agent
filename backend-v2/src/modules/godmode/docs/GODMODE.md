# GODMODE Discovery Engine — v1.0.0-live
Next-gen Omni-Data Discovery Pipeline

GODMODE, CNG AI Agent ekosistemi içinde yer alan yüksek kapasiteli tarama, keşif ve zeka toplama motorudur.  
Faz 1 itibarıyla, tek provider üzerinden tam entegre çalışan bir keşif pipeline’ı, kalıcı job sistemi ve event-log tabanlı izlenebilirlik sağlar.  
Faz 2 ile çok sağlayıcılı (multi-provider), paralel çalışan ve AI destekli bir discovery brain’e evrilecektir.

---

# ✔️ **Sürüm Bilgisi**
- **Version:** `v1.0.0-live`
- **Release Date:** 2025-12-08
- **Status:** Production-grade stable (Faz 1 %100 tamamlandı)
- **Next Target:** Faz 2 — Provider Abstraction Layer + Multi-Provider Discovery

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
├── repo.js                 → DB access layer
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

🔧 Environment Variables

Key
Açıklama
GOOGLE_PLACES_API_KEY
Gerçek discovery için zorunlu
GODMODE_DISCOVERY_MODE
mock, live, 0, 1, true
GODMODE_MAX_RESULTS
(Opsiyonel) global limit


📈 Faz 2 Hazırlık Durumu

Faz 1; Faz 2 için tüm alt yapıyı %100 hazır hale getirmiş durumda:
	•	Provider abstraction için unified runner
	•	Error normalization altyapısı
	•	Worker hook noktası
	•	Lead storage & duplicate protokolü
	•	Discovery pipeline izole edildi (kolay genişletilebilir)
	•	Job state machine tamamen oturdu

Faz 2 ile eklenecek:
	•	LinkedIn
	•	Instagram
	•	Facebook
	•	Yelp
	•	MERSİS
	•	5 parallel provider taraması
	•	Duplicate merging
	•	Confidence scoring

🏁 Sonuç

GODMODE Faz 1 → %100 tamamlandı.
Artık modül tam anlamıyla production-grade, izlenebilir, stabil ve genişlemeye hazır bir discovery engine.

Sonraki aşama:
Faz 2 — Provider Abstraction Layer (PAL) & Multi-Provider Engine

---
