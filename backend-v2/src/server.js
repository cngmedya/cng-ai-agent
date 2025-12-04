// backend-v2/src/server.js
require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`CNG AI Agent backend V2 running on http://localhost:${PORT}`);
});