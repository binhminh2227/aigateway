// Seed default pricing for GPT-5 family models. Run once on VPS:
//   docker compose exec -T aigateway node scripts/seed-gpt5.js
// Safe to re-run — uses upsert.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const MODELS = [
  { model: "gpt-5.5",        tcdmxInputPrice: 5.0,  tcdmxOutputPrice: 15.0, tcdmxCachePrice: 0.5 },
  { model: "gpt-5.4",        tcdmxInputPrice: 2.5,  tcdmxOutputPrice: 10.0, tcdmxCachePrice: 0.25 },
  { model: "gpt-5.4-mini",   tcdmxInputPrice: 0.15, tcdmxOutputPrice: 0.60, tcdmxCachePrice: 0.015 },
  { model: "gpt-5.3-codex",  tcdmxInputPrice: 1.5,  tcdmxOutputPrice: 5.0,  tcdmxCachePrice: 0.15 },
  { model: "gpt-5.2",        tcdmxInputPrice: 1.0,  tcdmxOutputPrice: 3.0,  tcdmxCachePrice: 0.10 },
];

async function main() {
  for (const m of MODELS) {
    await prisma.modelPricing.upsert({
      where: { model: m.model },
      create: {
        model: m.model,
        inputPrice: m.tcdmxInputPrice,
        outputPrice: m.tcdmxOutputPrice,
        tcdmxInputPrice: m.tcdmxInputPrice,
        tcdmxOutputPrice: m.tcdmxOutputPrice,
        tcdmxCachePrice: m.tcdmxCachePrice,
        tcdmxTier: 2.0,
        markup: 1.3,
        enabled: true,
      },
      update: {
        tcdmxInputPrice: m.tcdmxInputPrice,
        tcdmxOutputPrice: m.tcdmxOutputPrice,
        tcdmxCachePrice: m.tcdmxCachePrice,
        enabled: true,
      },
    });
    console.log("✓ seeded", m.model);
  }
  console.log("Done. Adjust prices in Admin → Pricing if needed.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
