// backend-v2/src/core/middleware/authOptional.js

function authOptional(req, _res, next) {
    // Şimdilik sadece placeholder.
    // İleride header'dan token okuyup req.user set edebiliriz.
    req.user = null;
    next();
  }
  
  module.exports = { authOptional };