# OUTREACH MODULE – Full Technical Documentation
**Module Version:** v1.0.0  
**Last Update:** 2025-12-02  
**Maintainer:** CNG AI Agent Backend Team

---

# 📌 1. Purpose
Outreach modülü, firmanın satış pipeline’ındaki **ilk temas mesajını** üretir.

Görevleri:

- WhatsApp / Email / Instagram DM mesajları üretmek  
- Tonlama + dil ayarı yapmak  
- Lead özelliklerine göre kişiselleştirilmiş mesajlar oluşturmak  
- Satış ekibinin zamanını azaltmak  
- Profesyonel ve ikna edici giriş mesajları sağlamak

---

# 📌 2. Responsibilities

### ✔ 1. Kişiselleştirilmiş İlk Mesaj Üretimi  
- Kanal → whatsapp / email / instagram  
- Ton → premium / samimi / kurumsal  
- Dil → TR / EN  
- Lead meta verisi entegre edilir

### ✔ 2. AI Mesaj Üretim Motoru  
- Prompt kontrollü  
- JSON çıktısı  
- Lead Name, konum, kategori bazlı kişiselleştirir

---

# 📌 3. Technical Architecture

```
/api
  outreachRoutes.js

/controller
  controller.js

/service
  outreachService.js

/ai
  first_contact_message.md

/docs
  OUTREACH.md
  CHANGELOG.md
```

---

# 📌 4. Data Flow

```
Client → first-contact → Controller
→ Service → Prompt Loader → LLM → JSON Response
```

---

# 📌 5. Core Endpoint

| Method | Endpoint | Açıklama |
|--------|----------|-----------|
| **POST** | `/api/outreach/first-contact` | Lead için ilk temas mesajı oluşturur |

---

# 📌 6. Dependencies

- shared/ai/llmClient  
- shared/db/sqlite  
- shared/promptLoader  

---

# 📌 7. AI Prompt

### `first_contact_message.md`
- Ton, kanal, dil, lead bilgisi  
- Minimal, zarif ve profesyonel mesaj üretir  
- “Merhaba şirket adı …” akışını kullanır  
- WhatsApp/email için farklı formatlar üretir

---

# 📌 8. Known Limitations

- WhatsApp için metin formatı sade tutulmalı  
- Email HTML template desteği ileride eklenecek  
- DM mesajları karakter sınırlı olabilir  
- Çok resmi ton bazen fazla kurumsal durabilir

---

# 📌 9. Future Improvements

- WhatsApp Cloud API entegrasyonu  
- Email HTML template üreticisi  
- Multi-message follow-up sekansları  
- Scheduling + otomatik gönderim sistemi  
- CRM aktivitelerine loglama

---

# 📌 10. Versioning History  
(Bkz. CHANGELOG.md)