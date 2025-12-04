// backend-v2/src/core/http.js

function ok(res, data = null, meta = {}) {
    return res.status(200).json({
      ok: true,
      data,
      ...meta
    });
  }
  
  function created(res, data = null, meta = {}) {
    return res.status(201).json({
      ok: true,
      data,
      ...meta
    });
  }
  
  function fail(res, error, status = 400, meta = {}) {
    return res.status(status).json({
      ok: false,
      error: typeof error === 'string' ? error : error.message,
      ...meta
    });
  }
  
  module.exports = {
    ok,
    created,
    fail
  };