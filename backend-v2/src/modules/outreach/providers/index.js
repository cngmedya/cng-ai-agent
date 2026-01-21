const smtpProvider = require('./smtpProvider');

const PROVIDERS_BY_CHANNEL = {
  email: smtpProvider,
};

function getProvider(channel) {
  if (!channel) return null;
  const key = String(channel).toLowerCase();
  return PROVIDERS_BY_CHANNEL[key] || null;
}

async function sendMessage({ channel, to, subject, text, html, meta }) {
  const provider = getProvider(channel);

  if (!provider) {
    return { ok: false, error_code: 'UNSUPPORTED_CHANNEL', error_message: `No provider for channel: ${channel}` };
  }

  const res = await provider.sendMessage({ to, subject, text, html, meta });

  return { ...res, provider: provider.provider, channel: provider.channel };
}

module.exports = { getProvider, sendMessage };