import { createHash, createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

function getKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("KEY_ENCRYPTION_SECRET env is not set or too short (>=16 chars required)");
  }
  return scryptSync(secret, "aigateway-static-salt", 32);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function maskKey(key: string): string {
  if (key.length <= 14) return key.slice(0, 4) + "..." + key.slice(-2);
  return key.slice(0, 8) + "..." + key.slice(-6);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(blob: string): string {
  if (!blob.startsWith("gcm:")) {
    // Legacy plaintext: return as-is so existing rows still work pre-migration.
    return blob;
  }
  const [, ivB64, tagB64, ctB64] = blob.split(":");
  const key = getKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
