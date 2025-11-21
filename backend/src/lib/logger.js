// backend/src/lib/logger.js

const isDev = process.env.CNG_ENV !== "production";

const log = {
  info: (...args) => {
    console.log("[INFO]", ...args);
  },

  warn: (...args) => {
    console.warn("[WARN]", ...args);
  },

  error: (...args) => {
    console.error("[ERROR]", ...args);
  },

  debug: (...args) => {
    if (isDev) {
      console.log("[DEBUG]", ...args);
    }
  },
};

module.exports = { log };