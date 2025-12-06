// src/modules/crm/service/crmBrainService.js

const fs = require('fs');
const path = require('path');

const { getDb } = require('../../../core/db');
const { chatJson } = require('../../../shared/ai/llmClient');

/**
 * AI score'a göre band hesaplar.
 * Bu tamamen deterministik ve LLM'den bağımsız.
 */
function computeAiScoreBandLocal(score) {
  const s = typeof score === 'number' ? score : 0;

  if (s >= 90) {
    return { score: s, band: 'A', label: 'yüksek potansiyel' };
  }
  if (s >= 70) {
    return { score: s, band: 'B', label: 'orta-yüksek potansiyel' };
  }
  if (s >= 50) {
    return { score: s, band: 'C', label: 'orta potansiyel' };
  }
  if (s > 0) {
    return { score: s, band: 'D', label: 'düşük potansiyel' };
  }

  return { score: s, band: 'N/A', label: 'skor yok' };
}

/**
 * DB satırını sade bir lead objesine map eder.
 */
function mapLeadRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    category: row.category,
    website: row.website,
    phone: row.phone,
    source: row.source,
    ai_score: row.ai_score
  };
}

/**
 * crm_brain_summary.md prompt'unu dosyadan okur.
 */
function loadCrmBrainPrompt() {
  try {
    const filePath = path.join(__dirname, '../prompts/crm_brain_summary.md');
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.warn('[crmBrain] crm_brain_summary.md okunamadı:', err.message);
    return null;
  }
}

/**
 * LLM ile CRM Brain için özet / aksiyon önerileri üretir.
 * Prompt yoksa veya LLM hata verirse null döner, baseBrain bozulmaz.
 */
async function buildBrainSummaryWithLLM(baseBrain) {
  const prompt = loadCrmBrainPrompt();
  if (!prompt) return null;

  // LLM'e göndereceğimiz minimal payload
  const payload = {
    lead: baseBrain.lead,
    ai_score_band: baseBrain.ai_score_band,
    cir: {
      exists: baseBrain.cir.exists,
      last_cir_created_at: baseBrain.cir.last_cir_created_at,
      priority_score: baseBrain.cir.priority_score,
      sales_notes: baseBrain.cir.sales_notes
    }
  };

  const userContent = JSON.stringify(payload, null, 2);

  try {
    const summary = await chatJson({
      system: prompt,
      user: userContent
    });

    // chatJson doğrudan JSON obje döndürüyor varsayımıyla:
    return summary || null;
  } catch (err) {
    console.error('[crmBrain] LLM özet üretimi hata:', err);
    return null;
  }
}

/**
 * Low-level builder:
 * - DB'den lead çeker
 * - AI score band hesaplar
 * - Son CIR kaydını bulur ve meta çıkarır
 * - Üzerine LLM summary eklemeye hazır baseBrain döner
 */
async function buildLeadBrain({ leadId }) {
  const db = getDb();

  // 1) Lead'i al
  const leadRow = db.prepare(`
    SELECT id, name, city, country, category, website, phone, source, ai_score
    FROM potential_leads
    WHERE id = ?
  `).get(leadId);

  if (!leadRow) {
    throw new Error('Lead bulunamadı.');
  }

  const lead = mapLeadRow(leadRow);
  const ai_score_band = computeAiScoreBandLocal(lead.ai_score);

  // 2) Son CIR kaydını al
  const cirRow = db.prepare(`
    SELECT id, report_json, created_at
    FROM lead_cir_reports
    WHERE lead_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(leadId);

  let cirMeta = {
    exists: false,
    last_cir_created_at: null,
    priority_score: null,
    sales_notes: null,
    raw: null
  };

  if (cirRow) {
    let report = null;

    try {
      report = JSON.parse(cirRow.report_json);
    } catch (err) {
      console.error('[crmBrain] CIR JSON parse hatası:', err);
    }

    // priority_score birkaç farklı yerde olabilir, güvenli şekilde tara
    const priority =
      report?.priority_score ??
      report?.CNG_Intelligence_Report?.priority_score ??
      null;

    // satış notları da farklı alan isimlerinden gelebilir
    const salesNotes =
      report?.notes_for_sales ??
      report?.sales_notes ??
      report?.CNG_Intelligence_Report?.sales_notes ??
      report?.CNG_Intelligence_Report?.notes_for_sales ??
      null;

    cirMeta = {
      exists: true,
      last_cir_created_at: cirRow.created_at,
      priority_score: priority,
      sales_notes: salesNotes,
      raw: report || null
    };
  }

  // 3) LLM'e hazır base brain
  const baseBrain = {
    lead,
    ai_score_band,
    cir: cirMeta
  };

  // 4) LLM summary ekle (hata olsa bile baseBrain döneceğiz)
  const summary = await buildBrainSummaryWithLLM(baseBrain);

  return {
    ...baseBrain,
    summary // null olabilir; frontend buna göre davranabilir
  };
}

/**
 * Public API
 * - Hem leadId hem lead objesi ile çağrılabilir:
 *   - getLeadBrain(139)
 *   - getLeadBrain(leadRow)
 */
async function getLeadBrain(input) {
  if (input && typeof input === 'object' && input.id) {
    return buildLeadBrain({ leadId: input.id });
  }

  // string veya number ise leadId olarak ele al
  return buildLeadBrain({ leadId: Number(input) });
}

module.exports = {
  buildLeadBrain,
  getLeadBrain
};