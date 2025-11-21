// backend/src/offers/offerController.js

const { generateOffer } = require("./offerService");

async function generateOfferHandler(req, res) {
  try {
    const { lead, packageLevel, tone } = req.body;

    if (!lead) {
      return res
        .status(400)
        .json({ ok: false, error: "lead alanı zorunludur." });
    }

    const offer = await generateOffer({ lead, packageLevel, tone });

    res.json({ ok: true, offer });
  } catch (err) {
    console.error("Offer generate error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { generateOfferHandler };