
## v0.1.0 — 2025-12-06
### 🧪 Initial Enqueue Wrapper
- `/api/outreach-scheduler/enqueue/:leadId` endpoint’i eklendi.
- Outreach modülündeki sequence üretim fonksiyonunu sarmalayan servis katmanı tanımlandı.
- Queue / cron / worker implementasyonu olmadan, sadece AI sequence üretimi sağlandı.
- Admin modülünde `outreachScheduler` modülü `v0.1 — OK` olarak işaretlendi.