# GODMODE Discovery Engine — v1.1.12
Next-gen Omni-Data Discovery Pipeline

GODMODE, CNG AI Agent ekosistemi içinde yer alan yüksek kapasiteli tarama, keşif ve zeka toplama motorudur.  
Faz 1 itibarıyla, tek provider üzerinden tam entegre çalışan bir keşif pipeline’ı, kalıcı job sistemi ve event-log tabanlı izlenebilirlik sağlar.  
Faz 2 ile çok sağlayıcılı (multi-provider), paralel çalışan ve AI destekli bir discovery brain’e evrilecektir.

---

# ✔️ **Sürüm Bilgisi**
- **Version:** `v1.1.12`
- **Release Date:** 2025-12-25
- **Status:** Production-grade stable (Faz 1–2 tamamlandı, Faz 3 aktif geliştirme)
- **Next Target:** Faz 4.D.2 — Policy Reason Standardization

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
├── ai/
│   ├── leadRanking.prompt.js
│   ├── leadRanking.schema.js
│   ├── autoSwot.prompt.js
│   ├── autoSwot.schema.js
│   ├── outreachDraft.prompt.js
│   ├── outreachDraft.schema.js
│   ├── salesEntryStrategy.prompt.js
│   ├── salesEntryStrategy.schema.js
│   ├── channelStrategy.prompt.js
│   └── channelStrategy.schema.js
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

⸻

## 🧱 Boundary Rules — What GODMODE Is / Is Not

Bu bölüm, GODMODE modülünün **sorumluluk sınırlarını** netleştirmek için eklenmiştir.
Amaç; modül şişmesini, sorumluluk çakışmalarını ve uzun vadeli mimari bozulmayı önlemektir.

### GODMODE NEDİR
GODMODE:
- Potansiyel firmaları (lead) **keşfeder**
- Normalize eder ve enrichment sinyallerini toplar
- Lead’ler için **karar destek çıktıları (decision artifacts)** üretir
- Şu sorulara cevap verir:
  - Bu lead değerli mi?
  - Ne zaman temas edilmeli?
  - Hangi kanal daha mantıklı?
  - Nasıl bir giriş stratejisi izlenmeli?

### GODMODE NE DEĞİLDİR
GODMODE:
- ❌ Gerçek mesaj göndermez (email / whatsapp / dm)
- ❌ SMTP, provider credential veya retry logic içermez
- ❌ Bounce, unsubscribe, complaint veya delivery metrikleri yönetmez
- ❌ Derin rapor (PDF, CIR, tam SWOT dosyası) üretmez

### Karar vs. İcra Ayrımı (Altın Kural)
- **GODMODE = Decision Brain**
- **Intel / Research = Deep Intelligence**
- **Outreach / Email / WhatsApp = Execution**

GODMODE yalnızca **niyet (intent)** ve **taslak (draft)** üretir.
Gerçek icra, ilgili execution modüllerine devredilir.

### Tasarım Prensibi
GODMODE içindeki tüm AI çıktıları:
- Lead-level **hafif ve hızlı** olmalıdır
- Pipeline’ı tetikleyen karar verisi niteliği taşır
- `ai_artifacts` ve `job_logs` ile izlenebilir olmalıdır
- Hiçbir zaman execution sorumluluğu üstlenmez

Bu sınırlar, ileride yeni kanal veya modül eklenirken
mevcut mimarinin **bozulmaması için bağlayıcıdır**.

## 🧠 Faz 3 — AI Decision Layer (Brain Integration)

GODMODE artık yalnızca veri toplayan bir discovery motoru değil, aynı zamanda
“kime, ne zaman, nasıl yaklaşmalıyız?” sorularına cevap üreten bir karar katmanı içerir.

### 12. Lead Ranking (v1)
- Amaç: Discovery + enrichment sonuçlarını A / B / C band’lerine ayırmak.
- Inputs: deduped lead snapshot + enrichment sinyalleri.
- Outputs:
  - `ai_score_band`
  - `priority_score`
  - `why_now`
  - `ideal_entry_channel`
- Notlar:
  - LLM opt-in: `GODMODE_AI_LEAD_RANKING=1`
  - Kapalıysa deterministik heuristic ranking kullanılır.

### 13. Auto-SWOT (v1)
- Amaç: Satış odaklı SWOT analizi üretmek (sadece A/B lead’ler).
- Inputs: ranking sonucu + enrichment snapshot.
- Outputs: yapılandırılmış SWOT JSON:
  - Strengths
  - Weaknesses
  - Opportunities
  - Threats
- Notlar:
  - LLM opt-in: `GODMODE_AI_AUTO_SWOT=1`
  - Heuristic fallback desteklenir.

### 14. Auto-Outreach Draft (v1)
- Amaç: İlk temas için outreach mesaj taslağı üretmek.
- Inputs: Lead Ranking + Auto-SWOT çıktıları.
- Outputs:
  - Önerilen kanal
  - Opening message
  - CTA
- Notlar:
  - Sadece taslak üretimi yapılır.
  - Gönderim, zamanlama ve otomasyon Outreach modülünün sorumluluğundadır.

### 15. Auto-Sales Entry Strategy (v1) ✅
- Amaç: Lead için en uygun satış giriş stratejisini (angle + gerekçe) üretmek.
- Inputs:
  - Lead Ranking sonucu
  - Auto-SWOT özeti (varsa)
  - Enrichment snapshot (deterministic sample)
- Outputs (strict JSON):
  - `entry_angle`
  - `why_this_angle`
  - `recommended_tone`
  - `risk_flags`
- Notlar:
  - LLM opt-in: `GODMODE_AI_SALES_ENTRY_STRATEGY=1`
  - Kapalıysa deterministik fallback stratejisi kullanılır.
  - Çıktı `ai_artifacts` tablosuna `sales_entry_strategy_v1` tipiyle yazılır.
  - İlgili event’ler:
    - `AI_SALES_ENTRY_STRATEGY_GENERATED`
    - `AI_SALES_ENTRY_STRATEGY_PERSISTED`

### 16. Channel Strategy Intelligence (v1) ✅
- Amaç: Lead için **ilk temasın hangi kanaldan** yapılacağını belirlemek.
- Inputs:
  - Lead Ranking (band, priority_score)
  - Auto-SWOT özeti (varsa)
  - Enrichment snapshot (website var/yok, sosyal sinyaller)
  - Sales Entry Strategy çıktısı
- Outputs (strict JSON):
  - `primary_channel` (email | whatsapp | instagram | linkedin | phone)
  - `fallback_channels[]`
  - `channel_reasoning`
  - `confidence` (low | medium | high)
- Çalışma Kuralları:
  - LLM opt-in: `GODMODE_AI_CHANNEL_STRATEGY=1`
  - Kapalıysa deterministik heuristic fallback kullanılır.
  - Sadece A/B band lead’ler için üretilir.
- Persistence:
  - `ai_artifacts` → `channel_strategy_v1`
- Event’ler:
  - `AI_CHANNEL_STRATEGY_GENERATED`
  - `AI_CHANNEL_STRATEGY_PERSISTED`
  - `AI_CHANNEL_STRATEGY_DONE`
- Test Kanıtı:
  - Mini smoke: `smoke_godmode_min.sh` içinde 4.3 Channel Strategy assertion
  - Full smoke: `smoke_test.sh` yeşil (faz geçiş gate)

---

## 🛡️ Faz 4.D — Outreach Execution Guardrails

GODMODE, outreach sürecinde **yanlışlıkla veya erken mesaj gönderimini** önlemek için
çok katmanlı guardrail mekanizmaları içerir. Bu faz, discovery ve AI kararlarının
**kontrollü execution** ile buluşmasını sağlar.

### 17. Execution Mode & Kill‑Switch (v1) ✅

Amaç:
- Gerçek mesaj gönderimini **bilinçli ve geri alınabilir** hale getirmek
- Default davranışı her zaman **güvenli (stub / queue)** tutmak
- Tüm execution denemelerini izlenebilir kılmak

#### Execution Modes
Execution davranışı ENV üzerinden belirlenir:

```bash
OUTREACH_EXECUTION_MODE=stub        # default, güvenli
OUTREACH_EXECUTION_MODE=queue_only # sadece enqueue
OUTREACH_EXECUTION_MODE=send_now   # guarded send stub
OUTREACH_EXECUTION_MODE=schedule   # guarded schedule stub
```

Kurallar:
- Varsayılan mod: `stub`
- `send_now` ve `schedule` modlarında **gerçek gönderim yoktur**
- Sadece **stub event** üretilir

#### Kill‑Switch
Gerçek execution tamamen kapatılabilir:

```bash
OUTREACH_EXECUTION_ENABLED=0
```

Bu durumda:
- Hiçbir enqueue / send denenmez
- Event:
  - `OUTREACH_EXECUTION_BLOCKED_POLICY`
  - Reason: `KILL_SWITCH`

#### Observability
Her hedef için execution attempt loglanır:

- `OUTREACH_EXECUTION_ATTEMPT`
  - provider
  - provider_id
  - execution_mode

Stub event’leri:
- `OUTREACH_SEND_STUB`
- `OUTREACH_SCHEDULE_STUB`

Policy block reason’ları:
- `KILL_SWITCH`
- `DAILY_CAP_REACHED`
- `UNSUPPORTED_CHANNEL`
- `MODE_NOT_IMPLEMENTED`

#### Test Kanıtı
- Mini smoke: `smoke_godmode_min.sh`
  - Mode‑aware assertion (`OUTREACH_SEND_STUB`, `OUTREACH_SCHEDULE_STUB`)
- Full smoke: `smoke_test.sh` (guardrails açıkken yeşil)

⸻

## 📦 Persistence & Observability

- Tüm AI çıktıları `ai_artifacts` tablosuna kalıcı olarak yazılır.
- Job-level izlenebilirlik `godmode_job_logs` üzerinden sağlanır.
- Önemli event türleri:
  - `AI_LEAD_RANKED`
  - `AI_AUTO_SWOT_GENERATED`
  - `AI_OUTREACH_DRAFT_GENERATED`
  - `*_DONE` (summary)
  - `AI_CHANNEL_STRATEGY_GENERATED`
  - `AI_CHANNEL_STRATEGY_DONE`

⸻

## 🧪 Test Stratejisi

- **Mini Smoke:** `./scripts/smoke_godmode_min.sh`
  - Hızlı iterasyon içindir.
  - Release gate değildir.
- **Full Smoke:** `./scripts/smoke_test.sh`
  - FAZ geçişlerinden önce zorunlu olarak yeşil olmalıdır.
  - Deep enrichment opsiyoneldir:
    - Worker çalışmıyorsa veya candidate=0 ise smoke test WARN + SKIP üretir.
    - Worker çalışıyorsa persistence (V2 veya legacy) zorunlu olarak doğrulanır.
- `last_discovery_job_id` doğrulaması, full smoke içinde **final discovery run**
  (örn. JOB_ID_3) üzerinden yapılır.

⸻

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
