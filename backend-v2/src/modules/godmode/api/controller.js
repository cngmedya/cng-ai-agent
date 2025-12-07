const godmodeService = require('../service');

module.exports = {
  startDiscoveryHandler: async (req, res) => {
    const out = await godmodeService.startDiscovery(req.body);
    res.json({ ok: true, data: out });
  },
  getStatusHandler: async (req, res) => {
    const out = await godmodeService.getStatus();
    res.json({ ok: true, data: out });
  },
  getLeadsHandler: async (req, res) => {
    const out = await godmodeService.getLeads();
    res.json({ ok: true, data: out });
  }
};
