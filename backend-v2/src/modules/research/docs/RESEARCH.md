# Research / CIR Engine — v1.0.0

Bu modül CNG AI Agent’ın **“CNG Intelligence Report (CIR)”** üreten beyni.

---

## 🧠 Görev
Lead’in tüm dijital varlıklarını birleştirerek satış ekibi için tek bir kapsamlı rapor (CIR) üretir.

---

## ⚙️ Pipeline Aşamaları
1) Basic Intel
2) Deep Intel (website varsa)
3) Web OSINT Search
4) Social Media Detection
5) Ads Intelligence
6) Competitor Discovery
7) Benchmarking
8) CIR JSON Output (AI)

---

## 📡 DB Kaydı
Her rapor şu tabloya kaydedilir:

### `lead_cir_reports`
- lead_id  
- report_json  
- created_at  
- score  

Routes:
- `POST /api/research/full-report`
- `GET /api/research/latest/:leadId`
- `GET /api/research/all/:leadId`
- `GET /api/research/history/:leadId`

---

# 📌 CHANGELOG (v1.0.0)
## Added
- Tam CIR pipeline
- lead_cir_reports tablosu
- history endpoint

---

## Version
```
v1.0.0
```



---------



# Research Module (CNG Intelligence Report Engine) – v1.1.0

## Amaç

Research modülü, CNG AI Agent için **üst seviye zeka motoru** olarak çalışır.  
Görevi: Tek bir `leadId` üzerinden bütün veri kaynaklarını birleştirip, ajans için satılabilir ve aksiyon alınabilir **“CNG Intelligence Report (CIR)”** üretmek.

Bu modül, discovery, intel, web search, sosyal medya, reklam ve rakip analizi modüllerini tek bir pipeline altında toplar.

---

## Ana Sorumluluklar

- Tek giriş: `leadId`
- Lead’i discovery veritabanından okur (`potential_leads`).
- Intel modülü üzerinden:
  - Hızlı SWOT + dijital durum analizi (`intel_basic`)
  - Website ve SEO odaklı derin analiz (`intel_deep`, varsa)
- Web & OSINT:
  - `runWebSearch` ile firma hakkında dizinler, haberler, bloglar, üçüncü parti profiller ve olası risk sinyallerini toplar.
- Sosyal medya izi:
  - `detectSocials` ile Instagram, Facebook, LinkedIn, YouTube, TikTok gibi platformlarda varlık olup olmadığını tespit etmeye çalışır.
- Reklam izi:
  - `analyzeAds` ile Facebook/Meta, Google Ads ve piksel/analytics varlığını anlamaya çalışır.
- Rakipler:
  - `findCompetitors` ile aynı segmentteki muhtemel rakip firmaları modellemeye hazır altyapı sağlar.
- Benchmark:
  - `benchmarkLead` ile firmanın sektör içindeki pozisyonuna dair özet benchmark skoru üretir.
- Tüm bu verileri birleştirip **LLM ile tek JSON CIR raporuna dönüştürür.**

---

## High-Level Akış

1. `generateFullResearch({ leadId })` çağrılır.
2. `getLeadById(id)` ile `potential_leads` tablosundan kayıt çekilir.
3. Intel modülü:
   - `analyzeLead({ leadId })` → `intel_basic`
   - `analyzeLeadDeep({ leadId })` → `intel_deep` (sadece `lead.website` varsa)
4. Araştırma katmanları:
   - `runWebSearch(lead)` → `web_presence`
   - `detectSocials(lead)` → `social_presence`
   - `analyzeAds(lead)` → `ad_intel`
   - `findCompetitors(lead, web_presence)` → `competitors`
   - `benchmarkLead(lead, competitors)` → `benchmark`
5. LLM katmanı:
   - Tüm bu payload `RESEARCH_MASTER_PROMPT` ile `chatJson` fonksiyonuna gönderilir.
   - Çıktı: Tek bir **CIR JSON**:
     - `lead_overview`
     - `combined_swot`
     - `digital_presence`
     - `seo_insights`
     - `agency_opportunities`
     - `risk_and_reputation`
     - `cng_recommendation`
6. Controller:
   - `POST /api/research/full-report` endpoint’i üzerinden bu pipeline tetiklenir.
   - Response:
     - `{ leadId, leadName, cir, raw }`

---

## Public API (Service Seviyesi)

- `generateFullResearch({ leadId })`
  - Input: `{ leadId: number | string }`
  - Output:
    ```jsonc
    {
      "leadId": 180,
      "leadName": "Hane Mimarlık",
      "cir": { /* CIR JSON */ },
      "raw": {
        "lead": { /* DB kaydı */ },
        "intel_basic": { ... },
        "intel_deep": { ... } | null,
        "web_presence": { ... },
        "social_presence": { ... },
        "ad_intel": { ... },
        "competitors": [ ... ],
        "benchmark": { ... }
      }
    }
    ```

---

## Versiyon Stratejisi

- **v1.0.0**
  - Tek odak: Web search + temel research pipeline (lead + web_presence + basit analiz).
- **v1.1.0 (mevcut sürüm)**
  - Intel modülü entegrasyonu (`intel_basic`, `intel_deep`).
  - Social, ads, competitors ve benchmark modülleri ile entegrasyon.
  - Çıktı formatı stabilize edildi: CIR JSON yapısı standart hale getirildi.
  - Prompt artık filesystem yerine kod içinde tanımlı (FS hata riskleri ortadan kaldırıldı).

Gelecekte:
- v1.2.x:
  - Competitors & benchmark V2 (gerçek SERP verileri ile).
- v1.3.x:
  - CIR raporlarının veritabanına kaydedilmesi, versiyonlanması ve frontend panel entegrasyonu.