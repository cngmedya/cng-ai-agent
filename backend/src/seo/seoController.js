// backend/src/seo/seoController.js

const { analyzeLeadSeo } = require("./seoService");

/**
 * POST /api/seo/analyze-lead
 * Body: { sector?, location?, lead: {...} }
 */
exports.analyzeLeadForLeadObject = async (req, res) => {
  try {
    const { sector, location, lead } = req.body;

    if (!lead) {
      return res.status(400).json({
        ok: false,
        error: "lead alanı zorunludur.",
      });
    }

    const result = await analyzeLeadSeo({ lead, sector, location });

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("SEO analyzeLeadForLeadObject error:", err);
    return res.status(500).json({
      ok: false,
      error: "SEO analizi sırasında hata oluştu.",
      detail: err.message,
    });
  }
};