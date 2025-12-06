# RESEARCH Module – CNG Intelligence Report (CIR)

**Modül Versiyonu:** `v1.3.0`  
**Amaç:** Tek bir lead için çok kaynaklı istihbaratı (intel_basic, intel_deep, web search, sosyal medya, reklam izi, rakipler, benchmark) birleştirip satış ekibi için **CNG Intelligence Report (CIR)** üretmek ve rapor geçmişini saklamak.

---

## 1. Sorumluluklar

- Lead bazlı tam araştırma pipeline’ı çalıştırmak
- Farklı modüllerden gelen verileri toparlamak:
  - `intel_basic` (SWOT + temel dijital durum)
  - `intel_deep` (website & SEO deep-dive, varsa)
  - `web_presence` (OSINT web search)
  - `social_presence` (sosyal medya izi)
  - `ad_intel` (reklam izi / tracking altyapısı)
  - `competitors` (DB tabanlı rakip listesi)
  - `benchmark` (pazar karşılaştırma skoru)
- Bu verileri LLM ile tek bir **CIR JSON** içinde birleştirmek
- CIR sonucunu `lead_intel_reports` tablosuna kaydetmek
- Lead bazlı CIR geçmişini (history) API ile vermek

---

## 2. Public API

### 2.1. HTTP Routes

#### `POST /api/research/full-report`

- Body:
  ```json
  { "leadId": 139 }