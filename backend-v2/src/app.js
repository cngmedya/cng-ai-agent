// backend-v2/src/app.js
const express = require('express');
const cors = require('cors');

const { crmRouter } = require('./modules/crm/api/routes');
const { discoveryRouter } = require('./modules/discovery/routes');
const { intelRouter } = require('./modules/intel/routes');
const { outreachRouter } = require('./modules/outreach/routes');
const { leadDashboardRouter } = require('./modules/leadDashboard/routes');
const { researchRouter } = require('./modules/research/api/routes');
const { authRouter } = require('./modules/auth/api/routes');

// v2 comms layer
const { emailRouter } = require('./modules/email/routes');
const { whatsappRouter } = require('./modules/whatsapp/routes');
const { outreachSchedulerRouter } = require('./modules/outreachScheduler/routes');
const { adminRouter } = require('./modules/admin/api/routes');


// ⚠️ Henüz hazır olmayan modüller – router bağlamıyoruz
// const { authRouter } = require('./modules/auth/api/routes');
// const { adminRouter } = require('./modules/admin/api/routes');
// const { brainRouter } = require('./modules/brain/api/routes');

const app = express();

app.use(cors());
app.use(express.json());

// Core lead intelligence pipeline
app.use('/api/discovery', discoveryRouter);
app.use('/api/intel', intelRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/leads', leadDashboardRouter);
app.use('/api/research', researchRouter);
app.use('/api/crm', crmRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

// Comms layer
app.use('/api/email', emailRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/outreach-scheduler', outreachSchedulerRouter);

// Gelecek faz: auth / admin / brain
// app.use('/api/auth', authRouter);
// app.use('/api/admin', adminRouter);
// app.use('/api/brain', brainRouter);

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'CNG AI Agent Backend V2' });
});

module.exports = app;