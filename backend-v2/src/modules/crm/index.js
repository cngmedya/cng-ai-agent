// backend-v2/src/modules/crm/index.js

const { crmRouter } = require('./api/routes');

module.exports = {
  mount(app) {
    app.use('/api/crm', crmRouter);
  }
};