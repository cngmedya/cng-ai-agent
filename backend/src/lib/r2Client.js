// backend/src/lib/r2Client.js

const {
    R2_ACCOUNT_ID,
    R2_BUCKET_NAME,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_PUBLIC_BASE_URL,
  } = process.env;
  
  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
  const crypto = require("crypto");
  
  /**
   * R2 S3 client
   * Cloudflare R2, AWS S3 protokolünü birebir destekler.
   */
  const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  
  /**
   * R2'ye dosya yükleme
   * @param {Buffer} buffer - dosya içeriği
   * @param {string} mimeType - image/jpeg, video/mp4 vb.
   * @param {string} prefix - whatsapp/media/... gibi klasör ön eki
   */
  async function uploadToR2({ buffer, mimeType, prefix = "uploads" }) {
    if (!buffer) throw new Error("uploadToR2: buffer is missing");
  
    const id = crypto.randomUUID();
    const fileKey = `${prefix}/${id}`;
  
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    });
  
    await r2Client.send(putCommand);
  
    // Public URL (dosya herkese açık olacak)
    const publicUrl = `${R2_PUBLIC_BASE_URL}/${fileKey}`;
  
    return {
      key: fileKey,
      url: publicUrl,
    };
  }
  
  module.exports = {
    uploadToR2,
    r2Client,
  };