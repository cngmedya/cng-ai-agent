const express = require("express");
const cors = require("cors");
const { config } = require("./config/env");
const { log } = require("./lib/logger");
const aiRoutes = require("./routes/aiRoutes"); // ← ÖNEMLİ: süslü parantez YOK, .js yazmasan da olur

const app = express();

app.use(cors());
app.use(express.json());

// Basit health check
app.get("/", (req, res) => {
  res.json({ ok: true, message: "CNG Medya AI Agent backend çalışıyor." });
});

// AI endpointleri
app.use("/api/ai", aiRoutes);

// Server'ı başlat
app.listen(config.port, () => {
  log.info(`Server ${config.port} portunda çalışıyor (${config.env})`);
});