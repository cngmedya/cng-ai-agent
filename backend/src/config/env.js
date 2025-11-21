const dotenv = require("dotenv");
dotenv.config();

const config = {
  port: process.env.PORT || 4000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  googleApiKey: process.env.GOOGLE_PLACES_API_KEY,   // 👈 EKLENEN SATIR
  internalApiKey: process.env.CNG_INTERNAL_API_KEY || null,
  env: process.env.CNG_ENV || "development",

  // 🔽 WhatsApp Cloud API config
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || null,
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || null,
  whatsappApiBase:
    process.env.WHATSAPP_API_BASE || "https://graph.facebook.com/v20.0",
};

module.exports = { config };