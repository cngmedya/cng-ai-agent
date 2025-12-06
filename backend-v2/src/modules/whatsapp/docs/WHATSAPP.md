# WHATSAPP MODULE – Full Technical Documentation
**Module Version:** v0.1.0  
**Last Update:** 2025-12-06  
**Maintainer:** CNG AI Agent Backend Team

---

# 📌 1. Purpose

WhatsApp modülü, ileride WhatsApp Cloud API ile entegre edilecek **iletişim katmanının çekirdeğidir**.

Şu anki rolü:

- Gönderilecek WhatsApp mesajları için **log tablosu** oluşturmak
- Basit bir test endpoint ile modülün stabil çalıştığını doğrulamak
- Outreach / OutreachScheduler modülleri için ileride kullanılacak altyapıyı hazırlamak

> v0.1 aşaması: **Gerçek WhatsApp Cloud API entegrasyonu yok**, sadece log kaydı.

---

# 📌 2. Responsibilities

### ✔ 1. WhatsApp Mesaj Loglama
- Gönderim denemelerini `whatsapp_logs` tablosuna yazar.
- Alanlar:
  - `lead_id` (opsiyonel)
  - `phone`
  - `message`
  - `status` (örn: `pending`, `simulated`)
  - `meta`
  - `created_at`

### ✔ 2. Test Endpoint
- Modülün DB ile birlikte doğru çalıştığını test etmek için kullanılır.
- Email modülüne benzer şekilde, sadece **simüle** eder.

---

# 📌 3. Technical Architecture

```bash
src/modules/whatsapp
  ├── api
  │   ├── controller.js
  │   └── routes.js
  ├── repo.js
  ├── service.js
  └── docs
      ├── WHATSAPP.md
      └── CHANGELOG.md

📌 4. Data Flow
Client → POST /api/whatsapp/test
    → controller.sendTestWhatsappHandler
    → whatsappService.sendTestMessage
    → whatsappRepo.logWhatsapp
    → SQLite (whatsapp_logs table)
    → JSON response (ok + id + note)

📌 5. Core Endpoints
Method
Endpoint
Açıklama
POST
/api/whatsapp/test
Test amaçlı bir WhatsApp log kaydı oluşturur.

🔹 Response (örnek)
{
  "ok": true,
  "data": {
    "ok": true,
    "id": 1,
    "note": "WhatsApp module v0.1.0 — Cloud API entegrasyonu henüz yok, sadece log kaydı."
  }
}
📌 6. Dependencies
	•	core/db → SQLite (better-sqlite3)
	•	express
	•	İleride: WhatsApp Cloud API HTTP client (axios / fetch)

⸻

📌 7. Database

Table: whatsapp_logs

Alanlar (v0.1):
	•	id – INTEGER PRIMARY KEY AUTOINCREMENT
	•	lead_id – INTEGER (nullable)
	•	phone – TEXT (nullable, test modunda boş geçilebilir)
	•	message – TEXT
	•	status – TEXT (ör: "simulated")
	•	meta – TEXT (JSON string, opsiyonel)
	•	created_at – TEXT (ISO)

Tablo, repo içinde CREATE TABLE IF NOT EXISTS ile lazily initialize edilir.

⸻

📌 8. Known Limitations
	•	WhatsApp Cloud API entegrasyonu yok; hiçbir gerçek mesaj gönderilmiyor.
	•	Auth yok; /api/whatsapp/test public.
	•	Queue / retry / delivery status takibi yok.
	•	Mesaj içerikleri şimdilik çok basic (test modunda statik).

⸻

📌 9. Future Improvements
	•	Meta WhatsApp Cloud API entegrasyonu
	•	Mesaj şablon sistemi (örn. outreach sequence entegrasyonu)
	•	Delivery & read status tracking
	•	Rate limit / queue mekanizması
	•	Admin panelde log listesi + filtreleme

⸻

📌 10. Versioning History

Detaylar için: CHANGELOG.md