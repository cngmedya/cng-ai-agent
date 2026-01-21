const nodemailer = require('nodemailer');

function boolEnv(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function intEnv(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`Missing required env: ${name}`);
    err.code = 'MISSING_ENV';
    throw err;
  }
  return v;
}

function buildTransport() {
  const host = requireEnv('SMTP_HOST');
  const port = intEnv(process.env.SMTP_PORT, 587);
  const secure = boolEnv(process.env.SMTP_SECURE);
  const authUser = process.env.SMTP_USER || '';
  const authPass = process.env.SMTP_PASS || '';

  const transportOptions = {
    host,
    port,
    secure,
    pool: boolEnv(process.env.SMTP_POOL),
    connectionTimeout: intEnv(process.env.SMTP_CONNECTION_TIMEOUT_MS, 15_000),
    greetingTimeout: intEnv(process.env.SMTP_GREETING_TIMEOUT_MS, 15_000),
    socketTimeout: intEnv(process.env.SMTP_SOCKET_TIMEOUT_MS, 30_000),
    maxConnections: intEnv(process.env.SMTP_MAX_CONNECTIONS, 2),
    maxMessages: intEnv(process.env.SMTP_MAX_MESSAGES, 50),
  };

  if (authUser && authPass) {
    transportOptions.auth = { user: authUser, pass: authPass };
  }

  return nodemailer.createTransport(transportOptions);
}

function normalizeTo(to) {
  if (Array.isArray(to)) return to.filter(Boolean).map(String);
  if (typeof to === 'string' && to.trim()) return [to.trim()];
  return [];
}

function splitCsv(v) {
  if (!v) return [];
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseEmailDomain(email) {
  const s = String(email || '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  if (at <= 0 || at === s.length - 1) return null;
  return s.slice(at + 1);
}

function isAllowedRecipient(toList) {
  const allowAll = boolEnv(process.env.OUTREACH_ALLOW_ALL);
  if (allowAll) return true;

  const allowedEmails = splitCsv(process.env.OUTREACH_ALLOWLIST_EMAILS).map((e) => e.toLowerCase());
  const allowedDomains = splitCsv(process.env.OUTREACH_ALLOWLIST_DOMAINS).map((d) => d.toLowerCase());

  if (allowedEmails.length === 0 && allowedDomains.length === 0) return false;

  for (const r of toList) {
    const email = String(r).trim().toLowerCase();
    if (!email) return false;

    if (allowedEmails.includes(email)) continue;

    const domain = parseEmailDomain(email);
    if (!domain) return false;
    if (allowedDomains.includes(domain)) continue;

    return false;
  }

  return true;
}

let _cachedTransport = null;
function getTransport() {
  if (_cachedTransport) return _cachedTransport;
  _cachedTransport = buildTransport();
  return _cachedTransport;
}

async function sendMessage({ to, subject, text, html, meta }) {
  const toList = normalizeTo(to);

  const enabled = boolEnv(process.env.OUTREACH_SMTP_ENABLED);
  if (!enabled) {
    return { ok: false, error_code: 'SMTP_DISABLED', error_message: 'SMTP provider disabled (OUTREACH_SMTP_ENABLED != 1)' };
  }

  if (!isAllowedRecipient(toList)) {
    return { ok: false, error_code: 'ALLOWLIST_BLOCK', error_message: 'Recipient not in allowlist' };
  }

  if (toList.length === 0) {
    return { ok: false, error_code: 'INVALID_TO', error_message: 'Missing recipient' };
  }
  if (!subject || !String(subject).trim()) {
    return { ok: false, error_code: 'INVALID_SUBJECT', error_message: 'Missing subject' };
  }
  if ((!text || !String(text).trim()) && (!html || !String(html).trim())) {
    return { ok: false, error_code: 'INVALID_BODY', error_message: 'Missing text/html body' };
  }

  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || requireEnv('SMTP_USER');
    const transporter = getTransport();

    const info = await transporter.sendMail({
      from,
      to: toList.join(','),
      subject: String(subject),
      text: text ? String(text) : undefined,
      html: html ? String(html) : undefined,
      headers: meta && meta.headers ? meta.headers : undefined,
      replyTo: meta && meta.replyTo ? meta.replyTo : undefined,
      messageId: meta && meta.messageId ? meta.messageId : undefined,
    });

    return {
      ok: true,
      provider_message_id: info && info.messageId ? String(info.messageId) : undefined,
      raw: info ? { accepted: info.accepted, rejected: info.rejected, response: info.response } : undefined,
    };
  } catch (e) {
    const code = e && (e.code || e.name) ? String(e.code || e.name) : 'SMTP_ERROR';
    const msg = e && e.message ? String(e.message) : 'SMTP send failed';
    return { ok: false, error_code: code, error_message: msg };
  }
}

module.exports = { provider: 'smtp', channel: 'email', sendMessage };