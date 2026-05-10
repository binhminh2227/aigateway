// Setup admin with API key, balance, TCDMX key, gpt-image-2 pricing
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const abs = path.resolve(process.cwd(), dbUrl.replace(/^file:/, ""));
const adapter = new PrismaBetterSqlite3({ url: `file:${abs}` });
const prisma = new PrismaClient({ adapter });

(async () => {
  const email = "binhminh22227@gmail.com";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("admin not found");

  await prisma.user.update({ where: { id: user.id }, data: { balance: 10 } });

  const tcdmxKey = process.env.TCDMX_API_KEY;
  if (!tcdmxKey) throw new Error("TCDMX_API_KEY missing in env");
  const tHash = crypto.createHash("sha256").update(tcdmxKey).digest("hex");
  await prisma.tcdmxKey.upsert({
    where: { keyHash: tHash },
    create: { key: tcdmxKey, keyHash: tHash, keyPrefix: tcdmxKey.slice(0, 8), label: "main", status: "active" },
    update: { status: "active", errorCount: 0 },
  });

  const userKey = "sk-test-" + crypto.randomBytes(16).toString("hex");
  const uHash = crypto.createHash("sha256").update(userKey).digest("hex");
  await prisma.apiKey.create({
    data: {
      name: "test-key",
      key: userKey,
      keyHash: uHash,
      keyPrefix: userKey.slice(0, 12),
      userId: user.id,
      status: "active",
    },
  });

  await prisma.modelPricing.upsert({
    where: { model: "gpt-image-2" },
    create: {
      model: "gpt-image-2",
      tcdmxInputPrice: 0,
      tcdmxOutputPrice: 0,
      tcdmxCachePrice: 0,
      tcdmxTier: 2.0,
      markup: 1.3,
      flatCostPerCall: 0.268,
      inputPrice: 0,
      outputPrice: 0,
      enabled: true,
    },
    update: {
      tcdmxTier: 2.0,
      markup: 1.3,
      flatCostPerCall: 0.268,
      enabled: true,
    },
  });

  console.log("USER_API_KEY=" + userKey);
  console.log("admin balance=10, gpt-image-2 flatCost=$0.268, tier=2.0, markup=1.3");
})();
