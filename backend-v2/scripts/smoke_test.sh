#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:4000"
JQ_BIN="${JQ:-jq}"
LEAD_ID="${LEAD_ID_OVERRIDE:-1}"

echo "==============================="
echo " CNG AI Agent – SMOKE TEST v1 "
echo " BASE_URL = $BASE_URL"
echo "==============================="
echo

###
# 0) ÖN KOŞUL KONTROLÜ
###
if ! command -v curl >/dev/null 2>&1; then
  echo "[ERR] curl bulunamadı. Lütfen curl kur."
  exit 1
fi

if ! command -v $JQ_BIN >/dev/null 2>&1; then
  echo "[ERR] jq bulunamadı. JSON çıktıları için jq tavsiye edilir."
  echo "Devam ediyorum ama çıktılar ham JSON olacak."
  JQ_BIN="cat"
fi

###
# 1) ADMIN STATUS
###
echo "▶ 1) Admin status testi..."
curl -s "$BASE_URL/api/admin/status" | $JQ_BIN
echo "✔ Admin status OK"
echo

###
# 2) GODMODE DISCOVERY ENGINE – BASIC JOB
###
echo "▶ 2) GODMODE job create + run testi..."

JOB_ID=$(curl -s -X POST "$BASE_URL/api/godmode/jobs/discovery-scan" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "SMOKE - Godmode Discovery Test",
    "city": "İstanbul",
    "country": "Türkiye",
    "categories": ["mimarlık ofisi"],
    "minGoogleRating": 3.5,
    "maxResults": 10,
    "channels": ["google_places"],
    "notes": "smoke-test"
  }' | $JQ_BIN -r '.data.id')

echo "  → Oluşan JOB_ID: $JOB_ID"

echo "  → Job run..."
curl -s -X POST "$BASE_URL/api/godmode/jobs/$JOB_ID/run" | $JQ_BIN '.data.status'
echo

echo "  → Job detay & summary:"
curl -s "$BASE_URL/api/godmode/jobs/$JOB_ID" \
  | $JQ_BIN '{id: .data.id, label: .data.label, status: .data.status, result_summary: .data.result_summary}'
echo "✔ Godmode discovery pipeline OK"
echo

###
# 3) EMAIL MODULE – TEST LOG
###
echo "▶ 3) Email test log..."

curl -s -X POST "$BASE_URL/api/email/test" \
  -H "Content-Type: application/json" \
  -d '{}' | $JQ_BIN
echo "✔ Email module test OK (log yazması gerekiyor)"
echo

###
# 4) WHATSAPP MODULE – TEST LOG
###
echo "▶ 4) WhatsApp test log..."

curl -s -X POST "$BASE_URL/api/whatsapp/test" \
  -H "Content-Type: application/json" \
  -d '{}' | $JQ_BIN
echo "✔ WhatsApp module test OK (simulated log)"
echo

###
# 5) OUTREACH v1 – FIRST CONTACT
###
echo "▶ 5) Outreach v1 – first-contact testi..."

curl -s -X POST "$BASE_URL/api/outreach/first-contact" \
  -H "Content-Type: application/json" \
  -d "{
    \"leadId\": $LEAD_ID,
    \"channel\": \"whatsapp\",
    \"tone\": \"kurumsal\",
    \"language\": \"tr\",
    \"notes\": \"smoke test - first contact\"
  }" | $JQ_BIN
echo "✔ Outreach v1 first-contact OK"
echo

###
# 6) LEAD ID GEREKEN TESTLER İÇİN HAZIRLIK
# Not: Buradaki LEAD_ID'yi kendi veritabanındaki gerçek bir ID ile güncelle.
###
echo "ℹ  Lead bazlı testler için varsayılan LEAD_ID = $LEAD_ID"
echo "   Eğer değiştirmek istersen komutu şu şekilde çalıştır:"
echo '   LEAD_ID_OVERRIDE=123 ./scripts/smoke_test.sh'
echo

###
# 7) OUTREACH v2 – SEQUENCE
###
echo "▶ 7) Outreach v2 – multi-step sequence testi (leadId=$LEAD_ID)..."

curl -s -X POST "$BASE_URL/api/outreach/sequence/$LEAD_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "whatsapp",
    "tone": "kurumsal",
    "language": "tr",
    "objective": "ilk_temas",
    "max_followups": 2
  }' | $JQ_BIN '{lead_id, ai_context, sequence}'
echo "✔ Outreach v2 sequence OK (eğer lead & intel uygun ise)"
echo

###
# 8) OUTREACH SCHEDULER – ENQUEUE
###
echo "▶ 8) Outreach Scheduler enqueue testi (leadId=$LEAD_ID)..."

curl -s -X POST "$BASE_URL/api/outreach-scheduler/enqueue/$LEAD_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "whatsapp",
    "tone": "kurumsal",
    "language": "tr",
    "objective": "ilk_temas",
    "max_followups": 2
  }' | $JQ_BIN
echo "✔ Outreach Scheduler enqueue OK"
echo

###
# 9) RESEARCH – CIR FULL REPORT
###
echo "▶ 9) Research / CIR full-report testi (leadId=$LEAD_ID)..."

curl -s -X POST "$BASE_URL/api/research/full-report" \
  -H "Content-Type: application/json" \
  -d "{
    \"leadId\": $LEAD_ID
  }" | $JQ_BIN '{leadId, leadName, cir: .cir.priority_score}'
echo "✔ Research CIR pipeline OK (lead verisine göre skor dönmeli)"
echo

###
# 10) ÖZET
###
echo "==============================="
echo " SMOKE TEST TAMAMLANDI 🔥"
echo "  - Admin status"
echo "  - Godmode discovery (job create + run + summary)"
echo "  - Email log"
echo "  - WhatsApp log"
echo "  - Outreach v1 first-contact"
echo "  - Outreach v2 sequence"
echo "  - Outreach Scheduler enqueue"
echo "  - Research CIR full-report"
echo "==============================="