# Brain Module (v1.0.0)

CNG AI Agent Backend V2 içinde **Brain** modülü, tek bir lead için tüm yapay zeka tabanlı içgörüleri tek noktadan sunan “merkezi beyin” katmanıdır.

Bu modül:

- CRM (lead temel verisi)
- Research / CIR (derin dijital analiz, SWOT, SEO, fırsatlar)
- Lead Intelligence / Score band (A–D, label vs.)
- Özet “sales brain summary”

gibi parçaları toplayıp, satış ekibine ve frontend’e **tek bir konsol** üzerinden verir.

---

## Versiyon

- Brain module: `v1.0.0`
- Statü: `OK`
- Admin panelde: `brain: 'v1.0 — OK'`

---

## Amaç

- Lead’e ait farklı kaynaklardan (CRM, CIR, Research) gelen verileri tek JSON altında birleştirmek.
- Satış ekibi için:
  - Detaylı “Lead Brain” datası
  - Hızlı tüketilebilir “Brain Summary” çıktısı üretmek
- Frontend tarafında:
  - Lead detay sayfasında “Brain” sekmesi
  - Lead listesinde özet gösterimler için API sağlamak

---

## Bağımlılıklar

Brain modülü şu servisleri kullanır:

- `crmBrainService.getBrainForLead(leadId)`
  - CRM + CIR + research + intel fuse edilmiş tam JSON
- `crmBrainService.getBrainSummaryForLead(leadId)`
  - Lead odaklı kısa özet (headline, one-liner, why_now, next actions)

Bu servisler, `src/modules/crmBrain/service/crmBrainService.js` içinde tanımlıdır ve brain modülü bunların üstünde ince bir API katmanı olarak çalışır.

---

## API Endpoints

### 1) GET `/api/brain/lead/:id`

Belirli bir lead için **tam beyin datasını** döner.

- Metod: `GET`
- URL: `/api/brain/lead/:id`
- Parametreler:
  - `id`: Lead ID (integer, örnek: `139`)

#### Örnek İstek

```bash
curl -s "http://localhost:4000/api/brain/lead/139" | jq

Örnek Response (kısaltılmış)

{
  "ok": true,
  "data": {
    "lead": {
      "id": 139,
      "name": "Hane Mimarlık",
      "city": "İstanbul",
      "country": "Türkiye",
      "category": "mimarlık ofisi",
      "website": "http://hanemimarlik.com/",
      "phone": "+902163421535",
      "source": "google_places",
      "ai_score": 100
    },
    "ai_score_band": {
      "score": 100,
      "band": "A",
      "label": "yüksek potansiyel"
    },
    "cir": {
      "exists": true,
      "last_cir_created_at": "2025-12-06T06:23:26.691Z",
      "priority_score": 75,
      "sales_notes": "Firmaya yaklaşırken dijital varlıklarını güçlendirme ve görünürlük artırma ihtiyacına vurgu yapılmalı...",
      "raw": {
        "leadId": 139,
        "leadName": "Hane Mimarlık",
        "swot": {
          "strengths": [
            "Net ve profesyonel firma ismi, markalaşmaya uygun domain mevcut.",
            "Faaliyet alanı olan mimarlık, yaratıcı içerik ve proje odaklı pazarlamaya uygundur."
          ],
          "weaknesses": [
            "Google kullanıcı puanı ve yorum sayısı bulunmaması dijital güvenilirliği olumsuz etkileyebilir."
          ],
          "opportunities": [
            "Dijital pazarlama ile web sitesi ve sosyal medya kanallarının aktif hale getirilmesi..."
          ],
          "threats": [
            "Sektörde yüksek rekabet nedeniyle fark yaratamama riski."
          ]
        },
        "digital_status": {
          "website": "var",
          "social_media": "zayıf",
          "brand_positioning": "belirsiz"
        },
        "website_evaluation": {
          "positioning": "orta seviye",
          "clarity": "karışık",
          "content_quality": "orta"
        },
        "seo": {
          "overall_score": 70,
          "issues": [
            "Meta description eksik.",
            "Heading yapısı iyileştirilebilir."
          ]
        },
        "agency_opportunities": {
          "short_term": [
            "Web sitesi modernizasyonu ve SEO çalışmaları",
            "Sosyal medya hesaplarının aktif yönetimi"
          ],
          "long_term": [
            "Marka kimliği ve konumlandırma stratejisi geliştirme"
          ]
        },
        "recommended_services": [
          {
            "name": "Kurumsal web sitesi yeniden tasarım",
            "priority": "high"
          }
        ],
        "social_presence": {
          "instagram": "https://www.instagram.com/hanemimarlikcom/",
          "facebook": "https://www.facebook.com/hanemimarlikcom/",
          "activity_score": 40
        },
        "ad_intel": {
          "active_ads": [],
          "pixel_detected": false,
          "google_analytics_detected": false
        },
        "web_presence": {
          "directories": [],
          "news_mentions": [],
          "blog_mentions": [],
          "third_party_profiles": []
        },
        "benchmark": {
          "benchmark_score": 100,
          "strengths_vs_market": [
            "Bu lead için kayıtlı doğrudan rakip bulunmuyor; pazar nispeten boş görünüyor."
          ]
        }
      }
    },
    "summary": {
      "ok": true,
      "json": {
        "lead_brain_summary": {
          "headline": "İstanbul'da Orta Seviye Konumlanmış, Güçlü Potansiyelli Mimarlık Ofisi",
          "one_line_positioning": "Hane Mimarlık, dijital görünürlüğünü artırmak için etkili bir SEO ve dijital pazarlama stratejisine ihtiyaç duyan yüksek potansiyelli bir mimarlık firmasıdır.",
          "why_now": "Firmada SEO ve dijital pazarlıkta oluşan eksiklikler, rekabet avantajı yakalamak için hemen müdahale edilmesini gerektiriyor.",
          "risk_level": "medium",
          "ideal_entry_channel": "phone"
        }
      }
    }
  }
}
Bu endpoint, frontend’de:
	•	Lead detay sayfası “Brain” sekmesi
	•	Derin analiz view’ları
	•	İçerideki swot, seo, agency_opportunities gibi bölümleri blok blok göstermek

için kullanılmalıdır.

2) GET /api/brain/lead/:id/summary

Belirli bir lead için kısa özet ve aksiyon önerileri döner. Bu, satışçıların hızlıca okuyabileceği “Sales Brain Summary”dir.
	•	Metod: GET
	•	URL: /api/brain/lead/:id/summary
	•	Parametreler:
	•	id: Lead ID (integer, örnek: 139)

Örnek İstek
curl -s "http://localhost:4000/api/brain/lead/139/summary" | jq

Örnek Response

{
  "ok": true,
  "data": {
    "lead_id": 139,
    "lead_name": "Hane Mimarlık",
    "city": "İstanbul",
    "country": "Türkiye",
    "category": "mimarlık ofisi",
    "ai_score_band": {
      "score": 100,
      "band": "A",
      "label": "yüksek potansiyel"
    },
    "priority_score": 75,
    "headline": "İstanbul merkezli mimarlık ofisi, dijital görünürlükte gelişim fırsatıyla yüksek potansiyel taşıyor",
    "one_line_positioning": "Hane Mimarlık, sektörde orta seviyede konumlanmış, dijital pazarlamada güçlendirilmesi gereken güçlü bir mimarlık firmasıdır.",
    "why_now": "Dijital pazarlama ve SEO eksiklikleri, rekabet avantajı kazanmak için acil olarak ele alınmalı.",
    "risk_level": "medium",
    "ideal_entry_channel": "phone",
    "recommended_next_actions": [
      "Telefonla ulaşarak dijital pazarlama ve SEO alanındaki fırsatları vurgulamak",
      "Firma ihtiyaçlarına uygun, hızlı hayata geçirilebilecek çözüm önerileri sunmak",
      "Hane Mimarlık’a yaratıcı mimarlık projelerinde dijital görünürlük avantajını öne çıkaracak stratejileri detaylandırmak"
    ]
  }
}

Frontend kullanım senaryoları:
	•	Lead detayında “Özet” paneli
	•	Lead listesinde sağ panel / hover kart
	•	İç satış ekibi için hızlı briefing ekranları

⸻

Hata Durumları
	•	Lead bulunamazsa:
	•	ok: false ve uygun bir hata mesajı dönülür (LEAD_NOT_FOUND benzeri).
	•	CIR / research verisi yoksa:
	•	cir.exists: false olarak dönebilir, summary yine minimum veriye göre üretilebilir (gelecekte v1.x içinde geliştirilebilir).

⸻

Brain Modülü ve Diğer Modüller
	•	leadDashboard:
	•	Lead detay sayfasında brain datasını göstermek için getLeadAiDashboard ile birlikte brain endpoint’lerini de kullanabilir.
	•	outreach:
	•	Brain summary içindeki headline, why_now, recommended_next_actions, outreach copy’lerinde kullanılabilecek zengin bağlam sağlar.
	•	admin:
	•	admin/status ve admin/modules üzerinden brain modülünün versiyonu ve health durumu takip edilebilir.

⸻

Gelecek Versiyon Fikirleri (v1.x, v2.0)
	•	Lead bazında:
	•	“Satış tahmini” ve “closing probability” skorları
	•	Önerilen ilk temas kanalı için otomatik reason text
	•	Takım bazında:
	•	Aynı segmente ait lead’ler arasında kıyaslama
	•	Otomasyon:
	•	Outreach Scheduler ile daha sıkı entegrasyon
	•	“Best next action” → direkt task yaratma

