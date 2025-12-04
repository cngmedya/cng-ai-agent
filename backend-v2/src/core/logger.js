// backend-v2/src/core/logger.js

const levels = ['debug', 'info', 'warn', 'error'];

function log(level, ...args) {
  if (!levels.includes(level)) level = 'info';
  const ts = new Date().toISOString();
  const label = level.toUpperCase();
  // Şimdilik console tabanlı, ileride external logger eklenebilir
  // debug → console.log, info → console.info, warn → console.warn, error → console.error
  const fn =
    level === 'debug'
      ? console.log
      : level === 'info'
      ? console.info
      : level === 'warn'
      ? console.warn
      : console.error;

  fn(`[${ts}] [${label}]`, ...args);
}

module.exports = {
  debug: (...args) => log('debug', ...args),
  info: (...args) => log('info', ...args),
  warn: (...args) => log('warn', ...args),
  error: (...args) => log('error', ...args)
};