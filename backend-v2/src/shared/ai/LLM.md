# SHARED AI – LLM Katmanı

**Modül Versiyonu:** `v1.1.0`  
**Konum:** `backend-v2/src/shared/ai/llmClient.js`  

Bu modül, backend içindeki tüm LLM çağrılarını tek bir yerden yönetmek için tasarlanmış ortak AI katmanıdır.

---

## 1. Amaç

- OpenAI Chat Completion endpoint’ine tek noktadan erişim sağlamak  
- **İki ana kullanım** sunmak:
  1. Serbest metin cevapları için `chat`
  2. **JSON garantili** cevaplar için `chatJson`
- Model versiyonu ve API key yönetimini merkezileştirmek
- JSON parse hatalarını minimuma indirmek için savunmacı (defensive) bir JSON extraction mekanizması sağlamak

---

## 2. Ortak Ayarlar

- Varsayılan model:  
  - `process.env.OPENAI_MODEL` varsa o  
  - Yoksa: `gpt-4.1-mini`
- API key: `process.env.OPENAI_API_KEY`

---

## 3. Public API

### 3.1. `chat({ system, user, model })`

- **Amaç:** Serbest metin tabanlı cevap gerektiğinde kullanılır (JSON zorunlu değil).
- Parametreler:
  - `system: string` – Sistem prompt
  - `user: string` – Kullanıcı mesajı
  - `model?: string` – Override model (opsiyonel)
- Davranış:
  - OpenAI Chat Completion çağrısı yapar
  - İlk cevabın `message.content` alanını **string** olarak döner.
- Örnek kullanım:
  ```js
  const { chat } = require('../../../shared/ai/llmClient');

  const answer = await chat({
    system: 'Kısa yanıt ver.',
    user: 'Bu lead için tek cümlelik özet üret.'
  });