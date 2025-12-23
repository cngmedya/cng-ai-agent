📌 OUTREACH.md (v2.1 FINAL)

— FULL TECHNICAL DOCUMENTATION —

# OUTREACH MODULE — Full Technical Documentation
**Module Version:** v2.1.1  
**Last Update:** 2025-12-23  
**Maintainer:** CNG Medya AI Engineering Team  
**Status:** Stable — Production Ready (CIR-aligned)

---

# 📌 1. Purpose
Outreach modülü, CNG Medya’nın satış pipeline’ındaki ilk iletişim ve takip süreçlerini otomatikleştiren motorudur.

> **CIR Entegrasyon Notu (2025-12-23):**  
> Outreach modülü, Research (CIR) çıktısını **tek referans gerçeklik** olarak kullanacak şekilde stabilize edilmiştir.  
> CIR üretimi başarısız olursa outreach sequence veya first-contact üretimi **tetiklenmez**.

Görevleri:

- WhatsApp / Email / Instagram DM için **ilk temas mesajı (v1)** oluşturmak  
- Lead + Intel verilerini işleyerek **çok adımlı outreach sequence (v2)** üretmek  
- Tonlama / dil / kanal uyumu sağlayarak profesyonel, premium ve sektöre uyumlu iletişim üretmek  

---

# 📌 2. Responsibilities

### ✔ v1 — İlk Temas Motoru
- Tek seferlik mesaj üretimi  
- Kanal → whatsapp / email / instagram_dm  
- Ton → premium / kurumsal / samimi  
- Dil → tr / en  
- Prompt: `first_contact_message.md`

### ✔ v2 — Multi-Step Sequence Motoru
- Lead bazlı AI destekli iletişim sekansı  
- Kullanılan parametreler:
  - channel  
  - tone  
  - language  
  - objective  
  - max_followups  
- INTEL modülünden gelen SWOT + digital_status + priority_score entegre edilir  
- Prompt: `outreach_sequence_v2.md` (Universal Voice Edition)  
- CIR (normalize edilmiş research output) zorunlu girdidir; eksik veya hatalı CIR durumunda v2 sequence üretilmez

---

# 📌 3. Technical Architecture

modules/outreach/
│
├── controller.js
├── service.js
├── repo.js
│
├── first_contact_message.md
├── outreach_sequence_v2.md
│
└── docs/
├── OUTREACH.md
└── CHANGELOG.md

---

# 📌 4. API Endpoints

| Method | Endpoint | Version | Açıklama |
|--------|----------|---------|----------|
| POST | `/api/outreach/first-contact` | v1.x | Tek seferlik ilk temas mesajı üretir |
| POST | `/api/outreach/sequence/:leadId` | v2.x | Çok adımlı AI outreach sekansı üretir |

---

# 📌 5. Data Flow

## 5.1 v1 — First Contact Flow

Client
→ POST /first-contact
→ Controller
→ Service.generateFirstContact()
→ promptLoader
→ llmClient (Responses API)
← JSON (subject, message)

---

## 5.2 v2 — Multi-Step Sequence Flow

Client
→ POST /sequence/:leadId
→ Controller
→ Service.generateSequenceForLead()
→ repo.getLeadById()
→ intel.analyzeLead()
→ CIR doğrulama (research output integrity check)
→ promptLoader (outreach_sequence_v2.md)
→ llmClient (strict JSON)
← ai_context + sequence[]

---

# 📌 6. AI Prompts

### 6.1. `first_contact_message.md`  
- v1 motoru  
- Sade, premium, kısa mesaj üretimi  

### 6.2. `outreach_sequence_v2.md`  
- Universal Voice Edition (v2.1)  
- CNG Medya’nın premium + modern + stratejik ajans dili  
- Çok adımlı sequence üretir  
- Strict JSON formatı  

---

# 📌 7. Output Structure

## ai_context
```json
{
  "ai_score_band": "A",
  "priority_score": 75,
  "why_now": "string",
  "risk_level": "medium",
  "ideal_entry_channel": "whatsapp"
}

sequence[]

{
  "step": 1,
  "type": "initial",
  "send_after_hours": 0,
  "subject": null,
  "message": "string"
}


⸻

📌 8. Dependencies
	•	shared/ai/llmClient.js
	•	shared/ai/promptLoader.js
	•	modules/intel/service.js → analyzeLead()
	•	core/db.js
	•	modules/research (CIR normalized output)

⸻

📌 9. Future Improvements
	•	Sector Packs (industry-specific add-ons)
	•	Follow-up scheduling (jobs/)
	•	WhatsApp Cloud API entegrasyonu
	•	UI dashboard’a sequence embed
	•	Sequence archive (DB kayıt sistemi)
	•	CIR freshness kontrolü ile otomatik re-research tetikleme

⸻

📌 10. Versioning

v2.1.1 — CIR stabilizasyonu ve smoke test uyumu

Detaylar: CHANGELOG.md

</file>
