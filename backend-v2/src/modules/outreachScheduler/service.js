// backend-v2/src/modules/outreachScheduler/service.js

/**
 * Basit v1:
 * - İçeride çalışan outreach sequence endpoint'ini ( /api/outreach/sequence/:leadId )
 *   HTTP üzerinden çağırır.
 * - Sequence üretiminde outreach modülünün tüm pipeline'ını tekrar kullanır.
 *
 * İleriki versiyonlarda:
 * - Çıkan sequence'i outreach_queue / tasks tablosuna yazıp
 *   gerçek zamanlı / cron bazlı gönderim planlayacağız.
 */

const DEFAULT_PORT = process.env.PORT || 4000;

async function enqueueSequenceForLead(leadId, options = {}) {
  if (!leadId) {
    throw new Error('leadId is required');
  }

  const {
    channel = 'whatsapp',
    tone = 'kurumsal',
    language = 'tr',
    objective = 'ilk_temas',
    max_followups = 2
  } = options;

  const url = `http://localhost:${DEFAULT_PORT}/api/outreach/sequence/${leadId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel,
      tone,
      language,
      objective,
      max_followups
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Outreach sequence API failed: ${response.status} ${response.statusText} ${text}`
    );
  }

  const json = await response.json();

  if (!json || !json.ok) {
    throw new Error(
      `Outreach sequence API returned invalid payload: ${JSON.stringify(json)}`
    );
  }

  // v1: sadece oluşturup geri döndürüyoruz
  // v2: burayı outreach_queue tablosuna INSERT atacak hale getireceğiz.
  return {
    ok: true,
    data: {
      lead_id: leadId,
      ...json.data
    }
  };
}

module.exports = {
  enqueueSequenceForLead
};