# OUTREACH SCHEDULER MODULE – Full Technical Documentation
**Module Version:** v0.1.0  
**Last Update:** 2025-12-06  
**Maintainer:** CNG AI Agent Backend Team

---

# 📌 1. Purpose

Outreach Scheduler, CNG AI Agent’in **“Yapay Satış Otomasyonu”** için temelidir.

Görevi:

- Belirli bir lead için, AI tabanlı **mesaj sekansını** (sequence) üretmek
- Bu sequence’i ileride gerçek bir queue / job sistemi ile eşleştirmek
- Şimdilik: Outreach modülünün sequence üretimini sarmalayan bir “enqueue” katmanı sağlamak

> v0.1 aşaması: Sequence üretiliyor ama **gerçek zamanlama / cron / queue yok**.

---

# 📌 2. Responsibilities

### ✔ 1. Sequence Generation Wrapper
- Outreach modülündeki `generateOutreachSequenceForLead` fonksiyonunu çağırır.
- Parametreler:
  - `leadId`
  - `channel` (whatsapp / email)
  - `tone` (premium / samimi / kurumsal / vb.)
  - `language` (tr / en)
  - `objective` (örn: `ilk_temas`)
  - `max_followups` (örn: 2)

### ✔ 2. Enqueue Interface (Future-Proof)
- API tasarımı, ileride:
  - DB’de `outreach_jobs` / `outreach_queue` tablosu
  - Worker / cron sistemi
  - Otomatik gönderim
için hazır olacak şekilde tasarlanmıştır.

---

# 📌 3. Technical Architecture

```bash
src/modules/outreachScheduler
  ├── api
  │   ├── controller.js
  │   └── routes.js
  ├── service.js
  ├── repo.js        # v0.1’de minimal veya boş; ileride queue tablosu için kullanılacak
  └── docs
      ├── OUTREACH_SCHEDULER.md
      └── CHANGELOG.md

📌 4. Data Flow
Client → POST /api/outreach-scheduler/enqueue/:leadId
    → controller.enqueueOutreachSequenceHandler
    → outreachSchedulerService.enqueueSequenceForLead
    → outreachService.generateOutreachSequenceForLead(leadId, payload)
    → (Future) repo.saveSequenceJob(...)
    → JSON response (lead_id + ai_context + sequence[])

📌 5. Core Endpoint

Method
Endpoint
Açıklama
POST
/api/outreach-scheduler/enqueue/:leadId
Lead için outreach sequence üretir.

🔹 Request Body

{
  "channel": "whatsapp",
  "tone": "kurumsal",
  "language": "tr",
  "objective": "ilk_temas",
  "max_followups": 2
}

🔹 Response (örnek, kısaltılmış)

{
  "ok": true,
  "data": {
    "lead_id": 139,
    "channel": "whatsapp",
    "tone": "kurumsal",
    "language": "tr",
    "objective": "ilk_temas",
    "ai_context": {
      "ai_score_band": "A",
      "priority_score": 70,
      "why_now": "…",
      "risk_level": "medium",
      "ideal_entry_channel": "whatsapp"
    },
    "sequence": [
      {
        "step": 1,
        "type": "initial",
        "send_after_hours": 0,
        "message": "Merhaba Hane Mimarlık…"
      },
      {
        "step": 2,
        "type": "follow_up",
        "send_after_hours": 48,
        "message": "İyi günler, Hane Mimarlık…"
      },
      {
        "step": 3,
        "type": "follow_up",
        "send_after_hours": 72,
        "message": "Tekrar merhaba…"
      }
    ]
  }
}

📌 6. Dependencies
	•	modules/outreach/service → generateOutreachSequenceForLead
	•	modules/leadDashboard / modules/crm / modules/research (dolaylı, outreach içinden)
	•	İleride:
	•	modules/whatsapp ve modules/email ile entegrasyon
	•	Scheduler / worker sistemi

⸻

📌 7. Known Limitations
	•	v0.1’de hiçbir şey gerçekten “queue”ya yazılmıyor, sadece sequence üretilip dönüyor.
	•	Cron / worker / job retry mekanizması yok.
	•	Auth / permission yok; endpoint public.
	•	Multichannel send (whatsapp + email paralel) henüz yok.

⸻

📌 8. Future Improvements
	•	outreach_jobs tablosu:
	•	lead_id, channel, message, send_at, status (pending/sent/failed)
	•	Worker / cron ile otomatik gönderim
	•	Admin panelinden:
	•	job listesi
	•	cancel / reschedule
	•	WhatsApp & Email modülleri ile gerçek entegrasyon
	•	Lead history’e “planned outreach” loglama

⸻

📌 9. Versioning History

Detaylar için: CHANGELOG.md