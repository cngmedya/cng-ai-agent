const router = require('router')();
const c = require('./controller');

router.post('/discover', c.startDiscoveryHandler);
router.get('/status', c.getStatusHandler);
router.get('/leads', c.getLeadsHandler);

module.exports = { godmodeRouter: router };
