const dotenv = require("dotenv");
dotenv.config();

const config = {
  port: process.env.PORT || 4000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  env: process.env.CNG_ENV || "development",
};

module.exports = { config };