// backend/src/services/r2Service.js

/**
 * Cloudflare R2 upload servisi
 *
 * - S3 compatible endpoint üzerinden çalışır (@aws-sdk/client-s3)
 * - Buffer’dan upload
 * - URL’den çekip upload (ör: WhatsApp media linki)
 * - Silme + public URL üretme
 */

const crypto = require("crypto");
const path = require("path");
const axios = require("axios");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { log } = require("../lib/logger");

// -------------------------------------------------------------
// ENV
// -------------------------------------------------------------
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "";
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL || "";
const R2_S3_ENDPOINT =
  process.env.R2_S3_ENDPOINT ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");

// -------------------------------------------------------------
// Guard + Client
// -------------------------------------------------------------
function ensureConfigured() {
  if (!R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_S3_ENDPOINT) {
    throw new Error(
      "[R2] Config eksik. Lütfen .env içinde R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME ve R2_S3_ENDPOINT değerlerini tanımla."
    );
  }
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// -------------------------------------------------------------
// Helperlar
// -------------------------------------------------------------

function randomId(len = 12) {
  return crypto.randomBytes(len).toString("hex");
}

function cleanFolder(folder = "") {
  if (!folder) return "";
  return folder.replace(/^\/+/, "").replace(/\/+$/, "");
}

function inferExtensionFromMime(mime, fallback = "bin") {
  if (!mime) return fallback;

  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg")) return "mp3";

  return fallback;
}

function extractFileNameFromUrl(url) {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname || "");
    return base || null;
  } catch {
    return null;
  }
}

function buildKey({ folder, fileName, contentType }) {
  const safeFolder = cleanFolder(folder);
  const base =
    fileName ||
    `${Date.now()}-${randomId(6)}.${inferExtensionFromMime(contentType || "", "bin")}`;

  return safeFolder ? `${safeFolder}/${base}` : base;
}

function getPublicUrl(key) {
  if (!R2_PUBLIC_BASE_URL) return null;
  return `${R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

// -------------------------------------------------------------
// Ana fonksiyonlar
// -------------------------------------------------------------

/**
 * Buffer’dan upload (ör: WhatsApp media download sonrası)
 *
 * @param {Buffer} buffer - Yüklenecek veri
 * @param {Object} opts
 * @param {string} [opts.folder] - bucket içi klasör (ör: "whatsapp/media")
 * @param {string} [opts.fileName] - opsiyonel dosya adı
 * @param {string} [opts.contentType] - MIME type
 */
async function uploadBuffer(buffer, opts = {}) {
  ensureConfigured();

  const { folder = "", fileName, contentType } = opts;
  const key = buildKey({ folder, fileName, contentType });

  const putCmd = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType || undefined,
  });

  try {
    await s3Client.send(putCmd);

    const url = getPublicUrl(key);
    log.info("[R2] Upload ok", { bucket: R2_BUCKET_NAME, key, size: buffer.length });

    return {
      ok: true,
      bucket: R2_BUCKET_NAME,
      key,
      url,
      size: buffer.length,
      contentType: contentType || null,
    };
  } catch (err) {
    log.error("[R2] Upload hata:", err.message);
    throw err;
  }
}

/**
 * URL’den dosya çekip R2’ya yükler.
 * Örn: WhatsApp media URL → R2
 *
 * @param {string} sourceUrl
 * @param {Object} opts
 * @param {string} [opts.folder]
 * @param {string} [opts.fileName]
 */
async function uploadFromUrl(sourceUrl, opts = {}) {
  ensureConfigured();

  try {
    const response = await axios.get(sourceUrl, {
      responseType: "arraybuffer",
      // WhatsApp medya linkleri genelde kısa ömürlü, timeout düşük olsun:
      timeout: 15000,
    });

    const contentType = response.headers["content-type"] || null;
    const buffer = Buffer.from(response.data);

    let fileName = opts.fileName || extractFileNameFromUrl(sourceUrl);

    // URL'den anlamlı bir isim çıkmazsa random üret
    if (!fileName || !fileName.includes(".")) {
      const ext = inferExtensionFromMime(contentType, "bin");
      fileName = `${Date.now()}-${randomId(6)}.${ext}`;
    }

    return uploadBuffer(buffer, {
      ...opts,
      fileName,
      contentType,
    });
  } catch (err) {
    log.error("[R2] URL'den dosya çekerken hata:", {
      url: sourceUrl,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Bir R2 objesini siler
 *
 * @param {string} key - bucket içi path
 */
async function deleteObject(key) {
  ensureConfigured();

  const cmd = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  try {
    await s3Client.send(cmd);
    log.info("[R2] Delete ok", { bucket: R2_BUCKET_NAME, key });
    return { ok: true };
  } catch (err) {
    log.error("[R2] Delete hata:", err.message);
    throw err;
  }
}

module.exports = {
  uploadBuffer,
  uploadFromUrl,
  deleteObject,
  getPublicUrl,
};