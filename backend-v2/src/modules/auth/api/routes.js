// src/modules/auth/api/routes.js

const express = require('express');
const { registerHandler, loginHandler } = require('./controller');

const router = express.Router();

// POST /api/auth/register
router.post('/register', registerHandler);

// POST /api/auth/login
router.post('/login', loginHandler);

module.exports = {
  authRouter: router,
};