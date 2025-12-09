# README_FIRST.md — CNG AI Agent Backend V2
Bu dosya, tüm sistemi yeniden hatırlamak ve yeni bir sohbete geçtiğimizde **kritik bilgileri hızlıca yüklemek** için oluşturulmuştur.  
Backend-V2’nin çalışması, portlar, environment değişkenleri, API anahtarları, DB yapısı, test komutları ve hayati operasyonel bilgiler burada tutulur.

---

# 📌 1. Sistem Genel Bilgiler

### **Backend Port**
- Sistem **4000 portunda** çalışır.
- Başlatma komutu:
```
npm start
```

### **Sunucu Framework**
- Node.js (v24)
- Express.js
- better-sqlite3 (DB)
- OpenAI / LLM entegrasyonu (shared/ai)

### **Ana Entry Points**
- `src/server.js`
- `src/app.js`

---

# 📌 2. Environment (.env) Dosyası

Aşağıdaki değişkenler sistem için kritiktir:

```
PORT=4000
OPENAI_API_KEY=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
GOOGLE_PLACES_API_KEY=AIzaSyDVFtV8wPr6NUBAFoiSmkQueiI7sknwdzU
CNG_INTERNAL_API_KEY=super-gizli-cng-internal-key-987
WHATSAPP_MOCK_MODE=1
WHATSAPP_API_URL=https://graph.facebook.com/v20.0
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=super-secret-verify-token
GODMODE_DISCOVERY_MODE=1
R2_ACCESS_TOKEN=Kv-c0aX2ZtGrBy1yPTxl7YqrAJDQAY3-8bpFo50F
R2_ACCOUNT_ID=b2152640cbcba3f6ffc1bd5f70d6578c
R2_ACCESS_KEY_ID=AKIA...
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_NAME=cng-ai-media
R2_PUBLIC_BASE_URL=https://pub-ccee20fd320b4d63b632cf6b88a7f073.r2.dev
R2_S3_ENDPOINT=https://b2152640cbcba3f6ffc1bd5f70d6578c.r2.cloudflarestorage.com
CNG_ENV=development
```

⚠️ **Not:** Bu dosyada gerçek anahtar saklama! Sadece roller listesi burada bulunur.

---

# 📌 3. Database Yapısı

### **Ana Veritabanı Dosyaları**

```
src/data/app.sqlite       → lead, discovery ve intel için ana DB
src/data/crm.sqlite       → CRM modülü için ayrı DB
```

### **Kilit Tablolar**

#### GODMODE:
- `godmode_jobs`
- `godmode_job_logs`
- `godmode_job_results`
- `godmode_job_progress`

#### LEAD PIPELINE:
- `potential_leads`
- `lead_search_intel`
- `lead_intel_reports`
- `lead_crm_brains`
- `lead_crm_notes`

#### OUTREACH:
- v2.1 motor kullanır, DB kaydı yok  
(gelecekte `outreach_jobs`)

#### EMAIL:
- `email_logs`

#### WHATSAPP:
- `whatsapp_logs`

---

# 📌 4. Godmode Test CURL Komutları

### **Job Create**
```
curl -s -X POST "http://localhost:4000/api/godmode/jobs/discovery-scan" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Smoke Test",
    "city": "İstanbul",
    "country": "Türkiye",
    "categories": ["mimarlık ofisi"],
    "minGoogleRating": 3.5,
    "maxResults": 10,
    "channels": ["google_places"],
    "notes": "smoke-test"
  }' | jq
```

### **Job Run**
```
curl -s -X POST "http://localhost:4000/api/godmode/jobs/<JOB_ID>/run" | jq
```

### **Job Details**
```
curl -s "http://localhost:4000/api/godmode/jobs/<JOB_ID>" | jq
```

---

# 📌 5. Job Log Kontrol Komutları

### Tüm loglar (son 20)
```
sqlite3 src/data/app.sqlite "
SELECT id, job_id, event_type, substr(created_at,1,19)
FROM godmode_job_logs
ORDER BY id DESC LIMIT 20;
"
```

### Belirli job’a göre log:
```
sqlite3 src/data/app.sqlite "
SELECT id, event_type, created_at
FROM godmode_job_logs
WHERE job_id = '<JOB_ID>'
ORDER BY id;
"
```

---

# 📌 6. Sistemde Önemli Pipeline'lar

### **Godmode Discovery Engine**
- Provider Runner → Google Places
- Discovery Pipeline → normalization
- UPSERT → `potential_leads`
- Summary Builder → job sonuçları
- Worker Stub → `dataFeederWorker`

### **Research Pipeline (CIR v1.4.0)**
- intel_basic
- intel_deep
- web search
- social presence v2.0
- competitors
- benchmark
- CIR normalization

### **Outreach v2.1**
- first-contact motoru (v1)
- multi-step sequence motoru (v2)
- strict JSON output

---

# 📌 7. Manuel DB Silme / Reset Notları

### **Yanlış DB dosyasını silme riski!**

**Doğru DB yolu:**
```
src/data/app.sqlite
src/data/crm.sqlite
```

Eğer DB yenilemek istenirse:
```
rm src/data/app.sqlite
npm start
```
→ Tüm tablolar kendisi yeniden oluşur.

---

# 📌 8. Kritik Teknik Notlar

- `godmodeService.getJobById` sorunu düzeltildi (service → repo mapping)
- Provider errors artık normalize ediliyor
- `used_categories` correct fallback: criteria.categories
- DB dosyasının *yanlış klasörde oluşması* eski sorundu → çözülmüş durumda
- Worker mekanizması v1 stub çalışıyor

---

# 📌 9. Yeni Sohbet Başlangıç Komutu

Yeni bir sohbette, bana sadece:

```
Sistemi yükle
```

demen yeterli.

Ben de bu README_FIRST.md dosyasını okuyarak:
- Portu
- DB yollarını
- Godmode test komutlarını
- CIR pipeline özelliklerini
- Outreach motor mantığını
- Env değişkenlerini
%100 hafızama yükleyeceğim.

---

# ✔ Bu dosya sistemin başlangıç kılavuzudur.  
Her geliştirme sonrası güncellenmelidir.
