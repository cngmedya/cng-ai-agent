// src/modules/auth/api/controller.js

const { register, login } = require('../service/authService');

async function registerHandler(req, res) {
  try {
    const user = await register(req.body);
    res.json({ ok: true, data: user });
  } catch (err) {
    console.error('[AUTH][REGISTER] Error:', err);

    if (err.code === 'USER_ALREADY_EXISTS') {
      return res.status(409).json({
        ok: false,
        error: 'USER_ALREADY_EXISTS',
        message: 'Bu email ile zaten bir kullanıcı mevcut.',
      });
    }

    if (err.message === 'EMAIL_AND_PASSWORD_REQUIRED') {
      return res.status(400).json({
        ok: false,
        error: 'EMAIL_AND_PASSWORD_REQUIRED',
        message: 'Email ve şifre zorunludur.',
      });
    }

    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: 'Kullanıcı oluşturulurken bir hata oluştu.',
    });
  }
}

async function loginHandler(req, res) {
  try {
    const user = await login(req.body);
    // Şimdilik sadece user objesi dönüyoruz.
    // Bir sonraki fazda buraya JWT ekleyeceğiz.
    res.json({
      ok: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('[AUTH][LOGIN] Error:', err);

    if (err.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        ok: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Email veya şifre hatalı.',
      });
    }

    if (err.message === 'EMAIL_AND_PASSWORD_REQUIRED') {
      return res.status(400).json({
        ok: false,
        error: 'EMAIL_AND_PASSWORD_REQUIRED',
        message: 'Email ve şifre zorunludur.',
      });
    }

    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: 'Giriş yapılırken bir hata oluştu.',
    });
  }
}

module.exports = {
  registerHandler,
  loginHandler,
};