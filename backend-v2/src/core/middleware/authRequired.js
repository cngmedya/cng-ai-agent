// backend-v2/src/core/middleware/authRequired.js

function authRequired(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: 'Authentication required'
      });
    }
    next();
  }
  
  module.exports = { authRequired };