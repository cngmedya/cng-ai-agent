// backend-v2/src/app.js
const express = require('express');
const cors = require('cors');

const { discoveryRouter } = require('./modules/discovery/routes');
const { intelRouter } = require('./modules/intel/routes');
const { outreachRouter } = require('./modules/outreach/routes');
const { leadDashboardRouter } = require('./modules/leadDashboard/routes');
const { researchRouter } = require('./modules/research/api/routes');


const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/discovery', discoveryRouter);
app.use('/api/intel', intelRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/leads', leadDashboardRouter);
app.use('/api/research', researchRouter);

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'CNG AI Agent Backend V2' });
});

module.exports = app;