module.exports = {
  startDiscovery: async (params = {}) => {
    return { ok: true, started: true, params };
  },
  getStatus: async () => {
    return { ok: true, workers: [] };
  },
  getLeads: async () => {
    return { ok: true, leads: [] };
  }
};
