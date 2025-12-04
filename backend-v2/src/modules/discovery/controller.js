// backend-v2/src/modules/discovery/controller.js
const {
  getLeadsPage,
  health,
  importFromPlaces,
  rankMissingLeads,
  aiSearch
} = require('./service');

async function getHealth(_req, res, next) {
  try {
    const status = await health();
    res.json({
      ok: status.ok,
      module: 'discovery',
      leadCount: status.leadCount,
      error: status.error || null
    });
  } catch (err) {
    next(err);
  }
}

async function getLeads(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    const data = await getLeadsPage({ page, pageSize });

    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

async function placesSearch(req, res, next) {
  try {
    const { query, maxPages } = req.body;

    const data = await importFromPlaces({
      query,
      maxPages: maxPages ? Number(maxPages) : 1
    });

    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

async function rankMissing(req, res, next) {
  try {
    const limit = req.body?.limit ? Number(req.body.limit) : 10;

    const data = await rankMissingLeads({ limit });

    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

async function aiSearchHandler(req, res, next) {
  try {
    const { query, maxPages, aiLimit } = req.body;

    const data = await aiSearch({
      query,
      maxPages: maxPages ? Number(maxPages) : 1,
      aiLimit: aiLimit ? Number(aiLimit) : 20
    });

    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHealth,
  getLeads,
  placesSearch,
  rankMissing,
  aiSearchHandler
};