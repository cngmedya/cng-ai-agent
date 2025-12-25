#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT_OVERRIDE:-4000}"
BASE="http://localhost:${PORT}"
SMOKE_FORCE_AB="${SMOKE_FORCE_AB:-0}"

echo "▶ MINI SMOKE — GODMODE (PORT=${PORT})"

echo "▶ 1) Admin status..."
curl -fsS "${BASE}/api/admin/status" >/dev/null
echo "✔ Admin status OK"

echo "▶ 2) Godmode providers health..."
curl -fsS "${BASE}/api/godmode/providers/health" >/dev/null
echo "✔ Providers health OK"

echo "▶ 3) Create + run GODMODE discovery job (forceRefresh=true)..."
PAYLOAD='{"city":"İstanbul","country":"Türkiye","categories":["mimarlık ofisi"],"maxResults":10,"forceRefresh":true}'

if [ "${SMOKE_FORCE_AB}" = "1" ]; then
  echo "ℹ SMOKE_FORCE_AB=1 → using broader categories to surface A/B leads and exercise SWOT/Draft/Persist"
  PAYLOAD='{"label":"smoke-force-ab","city":"Istanbul","country":"TR","categories":["nakliyat","oto tamir","halı yıkama","tesisatçı"],"minGoogleRating":0,"maxResults":60,"channels":["google_places"],"forceRefresh":true}'
fi

JOB_ID=$(curl -fsS -X POST "${BASE}/api/godmode/jobs/discovery-scan" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);console.log(j.id||j.data?.id||'');});")

if [ -z "${JOB_ID}" ]; then
  echo "✖ Could not read JOB_ID from response"
  exit 1
fi
echo "  → JOB_ID=${JOB_ID}"

curl -fsS -X POST "${BASE}/api/godmode/jobs/${JOB_ID}/run" >/dev/null
echo "✔ Job run triggered"

echo "▶ 3.1) Wait for job logs (AI ranking)..."
DEADLINE=$((SECONDS + 30))
AI_COUNTS=""
while [ $SECONDS -lt $DEADLINE ]; do
  AI_COUNTS=$(sqlite3 data/app.sqlite "SELECT event_type, COUNT(*) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type IN ('AI_LEAD_RANKED','AI_LEAD_RANKING_DONE') GROUP BY event_type;" 2>/dev/null || true)
  if echo "${AI_COUNTS}" | grep -Fq "AI_LEAD_RANKED|"; then
    break
  fi
  sleep 1
done

echo "▶ 4) DB assertions (AI ranking events must exist)..."
echo "${AI_COUNTS}"

if ! echo "${AI_COUNTS}" | grep -Fq "AI_LEAD_RANKED|"; then
  echo "✖ Missing AI_LEAD_RANKED"
  exit 1
fi

if ! echo "${AI_COUNTS}" | grep -Fq "AI_LEAD_RANKING_DONE|1"; then
  echo "✖ Missing AI_LEAD_RANKING_DONE"
  exit 1
fi

echo "▶ 4.1) DB assertions (Auto-SWOT optional)..."
SWOT_COUNTS=$(sqlite3 data/app.sqlite "SELECT event_type, COUNT(*) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type IN ('AI_AUTO_SWOT_GENERATED','AI_AUTO_SWOT_DONE') GROUP BY event_type;" 2>/dev/null || true)
echo "${SWOT_COUNTS}"

if ! echo "${SWOT_COUNTS}" | grep -Fq "AI_AUTO_SWOT_DONE"; then
  echo "✖ Missing AI_AUTO_SWOT_DONE"
  exit 1
fi

echo "✔ Auto-SWOT check OK (generated may be 0 if no A/B leads)"

echo "▶ 4.2) DB assertions (Outreach Draft optional + persistence)..."
DRAFT_COUNTS=$(sqlite3 data/app.sqlite "SELECT event_type, COUNT(*) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type IN ('AI_OUTREACH_DRAFT_GENERATED','AI_OUTREACH_DRAFT_DONE','AI_OUTREACH_DRAFT_PERSISTED','AI_OUTREACH_DRAFT_PERSIST_ERROR') GROUP BY event_type;" 2>/dev/null || true)
echo "${DRAFT_COUNTS}"

if ! echo "${DRAFT_COUNTS}" | grep -Fq "AI_OUTREACH_DRAFT_DONE"; then
  echo "✖ Missing AI_OUTREACH_DRAFT_DONE"
  exit 1
fi

if echo "${DRAFT_COUNTS}" | grep -Fq "AI_OUTREACH_DRAFT_PERSIST_ERROR"; then
  echo "✖ AI_OUTREACH_DRAFT_PERSIST_ERROR present"
  exit 1
fi

HAS_GENERATED=0
if echo "${DRAFT_COUNTS}" | grep -Fq "AI_OUTREACH_DRAFT_GENERATED|"; then
  HAS_GENERATED=1
fi

if [ "${HAS_GENERATED}" -eq 1 ]; then
  if ! echo "${DRAFT_COUNTS}" | grep -Fq "AI_OUTREACH_DRAFT_PERSISTED|"; then
    echo "✖ Draft generated but not persisted"
    exit 1
  fi
fi

ART_COUNT=$(sqlite3 data/app.sqlite "SELECT COUNT(*) FROM ai_artifacts WHERE job_id='${JOB_ID}' AND artifact_type='outreach_draft_v1';" 2>/dev/null || echo "0")
echo "  ai_artifacts(outreach_draft_v1) count: ${ART_COUNT}"

if [ "${HAS_GENERATED}" -eq 1 ] && [ "${ART_COUNT}" -lt 1 ]; then
  echo "✖ Draft generated but ai_artifacts has no rows"
  exit 1
fi

echo "✔ Outreach Draft check OK (generated/persisted may be 0 if no A/B leads)"

echo "▶ 5) Print AI summary payload..."
sqlite3 data/app.sqlite "SELECT substr(payload_json,1,900) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type='AI_LEAD_RANKING_DONE' ORDER BY created_at DESC LIMIT 1;"

echo ""
echo "▶ 5.1) Print Outreach Draft summary payload..."
sqlite3 data/app.sqlite "SELECT substr(payload_json,1,900) FROM godmode_job_logs WHERE job_id='${JOB_ID}' AND event_type='AI_OUTREACH_DRAFT_DONE' ORDER BY created_at DESC LIMIT 1;"

echo ""
echo "▶ 5.2) Print a persisted ai_artifacts row (if any)..."
sqlite3 data/app.sqlite "SELECT id, artifact_type, substr(artifact_json,1,700) FROM ai_artifacts WHERE job_id='${JOB_ID}' AND artifact_type='outreach_draft_v1' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || true

echo "==============================="
echo " MINI SMOKE TAMAMLANDI ✅"
echo "==============================="
