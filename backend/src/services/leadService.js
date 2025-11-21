// -----------------------------------------------
// WhatsApp Lead Automation Helper
// -----------------------------------------------

function normalizePhone(raw) {
    if (!raw) return null;
    return raw.replace(/\D/g, ""); // sadece rakamlar
  }
  
  function findOrCreateLeadByPhone(phone) {
    const clean = normalizePhone(phone);
    if (!clean) return null;
  
    // Bu numaraya bağlı lead var mı?
    const existing = db
      .prepare(`SELECT * FROM leads WHERE phone = ? LIMIT 1`)
      .get(clean);
  
    if (existing) {
      return existing;
    }
  
    // Yoksa yeni lead oluştur
    const now = new Date().toISOString();
  
    const result = db.prepare(`
      INSERT INTO leads (
        created_at,
        updated_at,
        name,
        phone,
        sector,
        location,
        lead_score,
        firmographic_score,
        total_score,
        status,
        raw_json
      )
      VALUES (
        @created_at,
        @updated_at,
        @name,
        @phone,
        NULL,
        NULL,
        20,
        10,
        30,
        'new',
        @raw_json
      )
    `).run({
      created_at: now,
      updated_at: now,
      name: "WhatsApp Lead",
      phone: clean,
      raw_json: JSON.stringify({ source: "whatsapp", phone: clean }),
    });
  
    const newLead = db
      .prepare(`SELECT * FROM leads WHERE id = ?`)
      .get(result.lastInsertRowid);
  
    return newLead;
  }
  
  module.exports = {
    // ...
    findOrCreateLeadByPhone,
    normalizePhone,
  };