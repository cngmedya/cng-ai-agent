# AUTH MODULE – Full Technical Documentation
**Module Version:** v1.0.0  
**Last Update:** 2025-12-06  
**Maintainer:** CNG AI Agent Backend Team

---

# 📌 1. Purpose

Auth modülü, CNG AI Agent backend’inin **kullanıcı yönetimi ve kimlik doğrulama çekirdeği**dir.

v1.0 odakları:

- Basit **kullanıcı kayıt (register)** mekanizması
- Email + password ile **login**
- Kullanıcı verisini SQLite `users` tablosunda saklama
- Admin / gelecekteki panel için temel auth altyapısını sağlamak

> v1.0 aşaması: JWT / session middleware henüz devrede değil; login endpoint direkt user obje döndürür.

---

# 📌 2. Responsibilities

### ✔ 1. Kullanıcı Oluşturma (Register)
- Request → `{ email, password, role }`
- Şifre, `bcrypt` ile hash’lenir.
- `users` tablosuna kayıt yapılır.
- Email unique olacak şekilde kontrol edilir.

### ✔ 2. Kullanıcı Girişi (Login)
- Request → `{ email, password }`
- Email’e göre kullanıcı bulunur.
- Şifre hash’i `bcrypt.compare` ile doğrulanır.
- Başarılıysa: user bilgisi döner (`id`, `email`, `role`, `created_at`).

---

# 📌 3. Technical Architecture

```bash
src/modules/auth
  ├── api
  │   ├── controller.js
  │   └── routes.js
  ├── repo.js
  ├── service
  │   └── authService.js
  ├── utils
  │   └── hash.js   # bcrypt wrapper
  └── docs
      ├── AUTH.md
      └── CHANGELOG.md

📌 4. Database

Table: users

Alanlar:
	•	id – INTEGER PRIMARY KEY AUTOINCREMENT
	•	email – TEXT, UNIQUE, NOT NULL
	•	password_hash – TEXT, NOT NULL
	•	role – TEXT (örn: admin, user)
	•	created_at – TEXT (ISO)

⸻

📌 5. Endpoints

Method
Endpoint
Açıklama
POST
/api/auth/register
Yeni kullanıcı oluşturur (email + password + role).
POST
/api/auth/login
Kullanıcı girişi yapar, user bilgisi döner.


🔹 Register – Request

{
  "email": "test@cng.ai",
  "password": "123456",
  "role": "admin"
}

🔹 Register – Success Response

{
  "ok": true,
  "data": {
    "id": 1,
    "email": "test@cng.ai",
    "role": "admin",
    "created_at": "2025-12-06 13:42:27"
  }
}

🔹 Register – USER_ALREADY_EXISTS

{
  "ok": false,
  "error": "USER_ALREADY_EXISTS",
  "message": "Bu email ile zaten bir kullanıcı mevcut."
}

🔹 Login – Request

{
  "email": "test@cng.ai",
  "password": "123456"
}

🔹 Login – Success Response

{
  "ok": true,
  "data": {
    "id": 1,
    "email": "test@cng.ai",
    "role": "admin",
    "created_at": "2025-12-06 13:42:27"
  }
}

📌 6. Dependencies
	•	bcrypt → şifre hash / verify
	•	core/db → SQLite
	•	express

⸻

📌 7. Known Limitations
	•	JWT / access token üretimi yok (v1.0).
	•	Route-level auth middleware (örn: authRequired) henüz bu modülle entegre edilmedi.
	•	Şu an Auth, yalnızca “backend tarafında kim var?” sorusuna cevap veriyor; frontend’de tam oturum yönetimi ileride eklenecek.

⸻

📌 8. Future Improvements
	•	JWT token üretimi (access + refresh)
	•	authRequired / authOptional middleware entegrasyonu
	•	Role-based access control (RBAC):
	•	admin vs sales vs viewer rolleri
	•	Password reset flow
	•	Rate limiting (brute force login koruması)

⸻

📌 9. Versioning History

Detaylar için: CHANGELOG.md