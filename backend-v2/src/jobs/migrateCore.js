

/**
 * Core Migration Runner Bootstrap
 *
 * Purpose:
 * Trigger core DB initialization so that
 * src/core/migrations/*.js are executed via db.js
 *
 * This file intentionally does NOT contain migration logic.
 * All logic lives in core/db.js.
 */

const { getDb } = require('../core/db');

(async () => {
  try {
    getDb();
    console.log('[migrate] core migrations executed successfully');
    process.exit(0);
  } catch (err) {
    console.error('[migrate] migration failed:', err);
    process.exit(1);
  }
})();