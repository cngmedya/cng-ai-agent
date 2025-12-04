// backend-v2/src/core/middleware/notFoundHandler.js
function notFoundHandler(req, res, _next) {
    res.status(404).json({
      ok: false,
      error: 'Endpoint not found',
      path: req.originalUrl
    });
  }
  
  module.exports = { notFoundHandler };