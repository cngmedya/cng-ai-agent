# EMAIL MODULE – Full Technical Documentation
**Module Version:** v0.1.0  
**Last Update:** 2025-12-06  
**Maintainer:** CNG AI Agent Backend Team

---

# 📌 1. Purpose

Email modülü, CNG AI Agent’in ileride kullanacağı **email gönderim altyapısının çekirdeğini** oluşturur.

Şu anki rolü:

- Email gönderim altyapısını simüle etmek
- Gelen/giden email aksiyonlarını **SQLite içerisinde loglamak**
- Gerçek SMTP / Transactional Email entegrasyonu için temel yapı sağlamak
- Admin / Monitoring tarafında takip edilebilir bir log tablosu oluşturmak

> v0.1 aşaması: **Gerçek email gönderimi yok**, sadece log kaydı + test endpoint.

---

# 📌 2. Responsibilities

### ✔ 1. Email Loglama
- Gönderilmek istenen email içeriklerini `email_logs` tablosuna kaydeder.
- Alanlar:
  - `to_email`
  - `subject`
  - `body`
  - `meta` (JSON / opsiyonel)
  - `created_at`

### ✔ 2. Test Endpoint
- Basit bir POST isteği ile email modülünün **çalıştığını ve DB yazabildiğini** doğrulamak için kullanılır.
- Gerçek SMTP entegrasyonundan tamamen bağımsızdır.

---

# 📌 3. Technical Architecture

```bash
src/modules/email
  ├── api
  │   ├── controller.js
  │   └── routes.js
  ├── repo.js
  ├── service.js
  └── docs
      ├── EMAIL.md
      └── CHANGELOG.md

📌 4. Data Flow
Client → POST /api/email/test
    → controller.sendTestEmailHandler
    → emailService.sendTestEmail
    → emailRepo.logEmail
    → SQLite (email_logs table)
    → JSON response (ok + id + note)

📌 5. Core Endpoints
Method
Endpoint
Açıklama
POST
/api/email/test
Basit bir test email log kaydı oluşturur (SMTP yok).

🔹 Request Body (test)
{}
🔹 Response (örnek)
{
  "ok": true,
  "data": {
    "ok": true,
    "id": 1,
    "note": "Email module v0.1.0 — SMTP entegrasyonu henüz eklenmedi, sadece log kaydı oluşturuldu."
  }
}
📌 6. Dependencies
	•	core/db → SQLite bağlantısı (better-sqlite3)
	•	express → routing
	•	dotenv → env config (ileride SMTP için kullanılacak)

⸻

📌 7. Database

Table: email_logs

Alanlar (v0.1):
	•	id – INTEGER PRIMARY KEY AUTOINCREMENT
	•	to_email – TEXT
	•	subject – TEXT
	•	body – TEXT
	•	meta – TEXT (JSON string, opsiyonel)
	•	created_at – TEXT (ISO timestamp)

Tablo, repo seviyesinde CREATE TABLE IF NOT EXISTS ile otomatik olarak oluşturulur.

⸻

📌 8. Known Limitations
	•	SMTP / gerçek email gönderimi yok, sadece log kaydı var.
	•	Auth / permission kontrolü yok; /api/email/test serbest erişilebilir (v0.1).
	•	Retry, queue, status tracking (delivered / failed) yok.

⸻

📌 9. Future Improvements
	•	SMTP veya üçüncü parti email servisi (SendGrid, Mailgun, AWS SES, vb.) entegrasyonu
	•	Üretim ortamı için template bazlı HTML email yapısı
	•	Email gönderim queue sistemi + job scheduler
	•	Logları Admin UI üzerinden filtreleyip görüntüleme
	•	Auth entegrasyonu (sadece admin kullanıcıların erişebilmesi)

⸻

📌 10. Versioning History

Daha fazla detay için: CHANGELOG.md