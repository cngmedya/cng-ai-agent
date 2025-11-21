// backend/src/controllers/crmController.js

const crmService = require("../services/crmService");

// GET /api/crm/leads
exports.listLeads = (req, res) => {
  try {
    const { page, pageSize, status } = req.query;
    const result = crmService.listLeads({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status: status || undefined,
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("CRM listLeads error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Lead listesi alınırken hata oluştu." });
  }
};

// GET /api/crm/leads/:id
exports.getLeadDetail = (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = crmService.getLeadDetail(id);
    if (!result) {
      return res.status(404).json({ ok: false, error: "Lead bulunamadı." });
    }
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("CRM getLeadDetail error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Lead detayı alınırken hata oluştu." });
  }
};

// POST /api/crm/leads/:id/notes
exports.addNote = (req, res) => {
  try {
    const id = Number(req.params.id);
    const { type, content } = req.body;
    if (!content) {
      return res
        .status(400)
        .json({ ok: false, error: "content alanı zorunludur." });
    }

    const result = crmService.addNote({
      leadId: id,
      type: type || "note",
      content,
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("CRM addNote error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Not eklenirken hata oluştu." });
  }
};

// PATCH /api/crm/leads/:id/status
exports.updateStatus = (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ ok: false, error: "status alanı zorunludur." });
    }

    const result = crmService.updateLeadStatus({ leadId: id, status });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("CRM updateStatus error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Durum güncellenirken hata oluştu." });
  }
};