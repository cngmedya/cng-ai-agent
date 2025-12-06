
## v1.0.0 — 2025-12-06
### 🔐 Initial Auth Core
- `users` SQLite tablosu tanımlandı.
- `POST /api/auth/register` ve `POST /api/auth/login` endpoint’leri eklendi.
- Şifre hashleme için `bcrypt` tabanlı `hash.js` utility’si yazıldı.
- `USER_ALREADY_EXISTS` hata modeli eklendi.
- Admin modülünde `auth` modülü `v1.0 — OK` olarak işaretlendi.