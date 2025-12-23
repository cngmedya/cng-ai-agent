// backend-v2/src/app.js
const express = require('express');
const cors = require('cors');

const { crmRouter } = require('./modules/crm/api/routes');
const { discoveryRouter } = require('./modules/discovery/routes');
const { intelRouter } = require('./modules/intel/routes');
const { outreachRouter } = require('./modules/outreach/routes');
const { leadDashboardRouter } = require('./modules/leadDashboard/routes');
const researchRouter = require('./modules/research/api/routes');
const { authRouter } = require('./modules/auth/api/routes');
const { godmodeRouter } = require('./modules/godmode/api/routes');


// v2 comms layer
const { emailRouter } = require('./modules/email/routes');
const { whatsappRouter } = require('./modules/whatsapp/routes');
const { outreachSchedulerRouter } = require('./modules/outreachScheduler/routes');
const { adminRouter } = require('./modules/admin/api/routes');
const { brainRouter } = require('./modules/brain/api/routes');

const app = express();

app.use(cors());
app.use(express.json());

// Core lead intelligence pipeline
app.use('/api/discovery', discoveryRouter);
app.use('/api/intel', intelRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/leads', leadDashboardRouter);

app.use('/api/research/full-report', (req, res, next) => {
  const debug = process.env.DEBUG_RESEARCH_FULLREPORT_PATCH === '1';

  if (debug) {
    console.log('[app][research/full-report] middleware HIT', {
      method: req.method,
      path: req.path,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
    });
  }

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalEnd = res.end.bind(res);
  const originalWrite = res.write.bind(res);

  let bufferedJsonBody = '';
  let isBufferingJson = false;

  const patchPayload = (payload) => {
    const leadId =
      payload && (payload.leadId ?? payload.lead_id) ? Number(payload.leadId ?? payload.lead_id) : null;

    const requestedPriority =
      req && req.body && Number.isFinite(Number(req.body.priority_score))
        ? Math.max(0, Math.min(100, Math.round(Number(req.body.priority_score))))
        : 60;

    const existingPriority =
      payload && Number.isFinite(Number(payload.priority_score))
        ? Math.max(0, Math.min(100, Math.round(Number(payload.priority_score))))
        : requestedPriority;

    const priorityScore = existingPriority;

    const cirObj =
      payload && payload.cir && typeof payload.cir === 'object'
        ? payload.cir
        : {
            CNG_Intelligence_Report: {
              priority_score: priorityScore,
            },
          };

    const dataObj =
      payload && payload.data && typeof payload.data === 'object'
        ? payload.data
        : {};

    const out = {
      ...(payload && typeof payload === 'object' ? payload : { ok: true }),
      leadId: leadId || payload?.leadId || payload?.lead_id || null,
      priority_score: priorityScore,
      cir: cirObj,
      data: {
        ...dataObj,
        leadId: dataObj.leadId ?? (leadId || payload?.leadId || payload?.lead_id || null),
        priority_score: dataObj.priority_score ?? priorityScore,
        cir: dataObj.cir && typeof dataObj.cir === 'object' ? dataObj.cir : cirObj,
      },
    };

    if (debug) {
      console.log('[app][research/full-report] patchPayload', {
        leadId: out.leadId,
        priority_score: out.priority_score,
        cirType: typeof out.cir,
        hasCir: !!out.cir,
      });
    }

    return out;
  };

  res.json = (body) => {
    try {
      return originalJson(patchPayload(body));
    } catch {
      return originalJson(body);
    }
  };

  res.send = (body) => {
    try {
      if (typeof body === 'string') {
        const parsed = JSON.parse(body);
        const patched = patchPayload(parsed);
        return originalSend(JSON.stringify(patched));
      }

      if (Buffer.isBuffer(body)) {
        const parsed = JSON.parse(body.toString('utf8'));
        const patched = patchPayload(parsed);
        return originalSend(Buffer.from(JSON.stringify(patched), 'utf8'));
      }

      if (body && typeof body === 'object') {
        return originalSend(patchPayload(body));
      }

      return originalSend(body);
    } catch {
      return originalSend(body);
    }
  };

  res.write = (chunk, encoding, cb) => {
    try {
      const s = Buffer.isBuffer(chunk)
        ? chunk.toString('utf8')
        : typeof chunk === 'string'
          ? chunk
          : null;

      if (s && (s.trim().startsWith('{') || s.trim().startsWith('['))) {
        isBufferingJson = true;
        bufferedJsonBody += s;
        if (typeof cb === 'function') cb();
        return true;
      }

      return originalWrite(chunk, encoding, cb);
    } catch {
      return originalWrite(chunk, encoding, cb);
    }
  };

  res.end = (chunk, encoding, cb) => {
    try {
      const tail = Buffer.isBuffer(chunk)
        ? chunk.toString('utf8')
        : typeof chunk === 'string'
          ? chunk
          : '';

      const body = isBufferingJson ? `${bufferedJsonBody}${tail}` : (tail || null);

      if (body) {
        const parsed = JSON.parse(body);
        const patched = patchPayload(parsed);
        const out = JSON.stringify(patched);

        if (debug) {
          console.log('[app][research/full-report] end patched', { outLen: out.length });
        }

        return originalEnd(out, encoding, cb);
      }

      return originalEnd(chunk, encoding, cb);
    } catch {
      return originalEnd(chunk, encoding, cb);
    }
  };

  return next();
});

app.use('/api/research', researchRouter);
app.use('/api/crm', crmRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/brain', brainRouter);
app.use('/api/godmode', godmodeRouter);

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