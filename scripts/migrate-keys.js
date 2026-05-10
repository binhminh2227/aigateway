/* Backfill keyHash/keyPrefix for ApiKey rows and encrypt TcdmxKey rows.
   Idempotent — re-running is safe.
   Requires KEY_ENCRYPTION_SECRET env to be set. */

const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const path = require("path");
const { createHash, createCipheriv, randomBytes, scryptSync } = require("crypto");

if (!process.env.KEY_ENCRYPTION_SECRET || process.env.KEY_ENCRYPTION_SECRET.length < 16) {
  console.error("KEY_ENCRYPTION_SECRET env var required (>=16 chars).");
  process.exit(1);
}

function getKey() {
  return scryptSync(process.env.KEY_ENCRYPTION_SECRET, "aigateway-static-salt", 32);
}
function sha256(v) { return createHash("sha256").update(v, "utf8").digest("hex"); }
function maskKey(k) {
  if (k.length <= 14) return k.slice(0, 4) + "..." + k.slice(-2);
  return k.slice(0, 8) + "..." + k.slice(-6);
}
function encryptSecret(pt) {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(pt, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

(async () => {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const relativePath = dbUrl.replace(/^file:/, "");
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const adapter = new PrismaBetterSqlite3({ url: `file:${absolutePath}` });
  const prisma = new PrismaClient({ adapter });

  const apiKeys = await prisma.apiKey.findMany({ where: { OR: [{ keyHash: null }, { keyPrefix: null }] } });
  console.log(`ApiKey rows missing hash/prefix: ${apiKeys.length}`);
  for (const r of apiKeys) {
    await prisma.apiKey.update({
      where: { id: r.id },
      data: { keyHash: sha256(r.key), keyPrefix: maskKey(r.key) },
    });
  }

  const tcdmxKeys = await prisma.tcdmxKey.findMany();
  let encrypted = 0;
  for (const r of tcdmxKeys) {
    if (r.key.startsWith("gcm:") && r.keyHash && r.keyPrefix) continue;
    const plain = r.key.startsWith("gcm:") ? null : r.key;
    if (!plain) {
      // already encrypted but missing hash/prefix — cannot recover plaintext, skip
      continue;
    }
    await prisma.tcdmxKey.update({
      where: { id: r.id },
      data: {
        key: encryptSecret(plain),
        keyHash: sha256(plain),
        keyPrefix: maskKey(plain),
      },
    });
    encrypted++;
  }
  console.log(`TcdmxKey rows encrypted: ${encrypted}`);
  await prisma.$disconnect();
})();
