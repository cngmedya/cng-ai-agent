# CRM Module – Lead Brain Engine  
**Versiyon:** `v1.0.0`  
**Amaç:**  
Satış ekibinin bir lead hakkında *tek bakışta karar verebilmesini* sağlayan, CIR (CNG Intelligence Report) + LLM tabanlı satış özetini tek API üzerinden sunmak.

---

## 1. Modülün Rolü

CRM modülü, farklı kaynaklardan gelen lead analizlerini işleyip satış ekibine tek bir kompakt “Lead Brain” çıktısı sağlar.

Bu modülün amacı:
- Lead’in ham CRM datası  
- CIR istihbaratı (Research modülü)  
- AI Score bantlaması  
- LLM tabanlı satış özeti  

→ **tek bir API ile frontend’e servis edilir.**

Satış uzmanı sadece `/crm/lead-brain/:leadId` endpoint’ini çağırır ve lead için gerekli tüm stratejik bilgileri elde eder.

---

## 2. Klasör Yapısı

modules/crm
│
├── api
│   ├── controller.js
│   └── routes.js
│
├── service
│   └── crmBrainService.js
│
├── docs
│   ├── CRM.md
│   └── CHANGELOG.md
│
├── prompts
│   └── crm_brain_summary.md
│
└── index.js

---

## 3. Public API

### 3.1. GET `/api/crm/lead-brain/:leadId`

**Amaç:**  
Tek bir lead için CRM Brain datasını (lead card + CIR meta + LLM sales summary) döndürmek.

#### **Response:**
```json
{
  "ok": true,
  "data": {
    "lead": { ... },
    "ai_score_band": { "score": 100, "band": "A", "label": "yüksek potansiyel" },
    "cir": {
      "exists": true,
      "last_cir_created_at": "...",
      "priority_score": 75,
      "sales_notes": "...",
      "raw": { ...full CIR... }
    },
    "summary": {
      "ok": true,
      "json": {
        "lead_brain_summary": {
          "headline": "...",
          "one_line_positioning": "...",
          "why_now": "...",
          "ideal_entry_channel": "phone",
          "risk_level": "medium",
          "opening_sentence": "...",
          "key_opportunities": [...],
          "red_flags": [...],
          "recommended_next_actions": [...]
        }
      },
      "raw": "{...}"
    }
  }
}


⸻

4. İç Bileşenler

4.1 crmBrainService.js

Bu servis üç ana fonksiyon içerir:

✔ buildLeadObject(leadRow)
Lead’i CRM Brain’e uygun forma çevirir.

✔ scoreBand(score)
AI score → band → label üretir.

✔ buildLeadBrain(lead, cirReport)
Lead + CIR + LLM özetini birleştirir.

✔ getLeadBrain(leadRow)
Modülün ana fonksiyonudur.
DB’den gelen lead’i işler, CIR raporunu bulur, LLM ile özet oluşturur ve tek bir “brain” objesi üretir.

⸻

5. LLM Prompt Sistemi

Modül, prompts/crm_brain_summary.md içindeki profesyonel satış özet promptunu kullanır.

Bu prompt:
	•	Headline
	•	Positioning
	•	Why now
	•	Risk level
	•	Entry channel
	•	Opening sentence
	•	Key opportunities
	•	Red flags
	•	Next actions

gibi CRM odaklı alanları üretir.

LLM aktif değilse fallback olarak:
	•	summary.ok = true
	•	summary.json = { empty summary }
şeklinde geri döner.

⸻

6. CIR Bağımlılığı

lead_intel_reports tablosunda lead’e ait en güncel CIR aranır.

CIR yoksa:

"cir": { "exists": false }

CIR varsa:
	•	priority_score
	•	sales_notes
	•	raw CIR JSON
doğrudan CRM Brain’e eklenir.

⸻

7. Kullanım Alanları (Frontend)

CRM ekranında şu bloklar gösterilebilir:

Lead Header
	•	lead.name
	•	city, category
	•	ai_score_band (renk kodlu badge)

Potansiyel Skoru
	•	priority_score (progress bar)

Sales Summary
	•	headline
	•	one_line_positioning
	•	opening_sentence
	•	next_actions listesi

CIR Quick Info
	•	threats / weaknesses (quick risk)
	•	opportunities (selling points)

