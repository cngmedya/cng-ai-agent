const packageJson = require('../../../package.json');

const templateService = {
  getPing() {
    return {
      module: '_template',
      version: packageJson.version,
      timestamp: new Date().toISOString(),
      note: 'Module created via AUTO-GEN COMMIT PACK',
    };
  },

  echo(message) {
    const msg = message || '';
    return {
      received: msg,
      length: msg.length,
      uppercased: msg.toUpperCase(),
    };
  },
};

module.exports = templateService;
