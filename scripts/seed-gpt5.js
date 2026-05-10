// Seed default pricing for GPT-5 family models. Run once on VPS:
//   docker compose exec -T aigateway node scripts/seed-gpt5.js
// Safe to re-run — idempotent upsert via better-sqlite3.
const Database = require("better-sqlite3");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = path.resolve(process.cwd(), dbUrl.replace(/^file:/, ""));
const db = new Database(dbPath);

const MODELS = [
  { model: "gpt-5.5",        tcdmxInputPrice: 5.0,  tcdmxOutputPrice: 15.0, tcdmxCachePrice: 0.5 },
  { model: "gpt-5.4",        tcdmxInputPrice: 2.5,  tcdmxOutputPrice: 10.0, tcdmxCachePrice: 0.25 },
  { model: "gpt-5.4-mini",   tcdmxInputPrice: 0.15, tcdmxOutputPrice: 0.60, tcdmxCachePrice: 0.015 },
  { model: "gpt-5.3-codex",  tcdmxInputPrice: 1.5,  tcdmxOutputPrice: 5.0,  tcdmxCachePrice: 0.15 },
  { model: "gpt-5.2",        tcdmxInputPrice: 1.0,  tcdmxOutputPrice: 3.0,  tcdmxCachePrice: 0.10 },
];

const findStmt = db.prepare("SELECT id FROM ModelPricing WHERE model = ?");
const insertStmt = db.prepare(`
  INSERT INTO ModelPricing (id, model, inputPrice, outputPrice, tcdmxInputPrice, tcdmxOutputPrice, tcdmxCachePrice, tcdmxTier, markup, enabled, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, 2.0, 1.3, 1, ?)
`);
const updateStmt = db.prepare(`
  UPDATE ModelPricing
  SET tcdmxInputPrice = ?, tcdmxOutputPrice = ?, tcdmxCachePrice = ?, enabled = 1, updatedAt = ?
  WHERE model = ?
`);

const now = new Date().toISOString();
for (const m of MODELS) {
  const row = findStmt.get(m.model);
  if (row) {
    updateStmt.run(m.tcdmxInputPrice, m.tcdmxOutputPrice, m.tcdmxCachePrice, now, m.model);
    console.log("↻ updated", m.model);
  } else {
    const id = uuidv4().replace(/-/g, "");
    insertStmt.run(id, m.model, m.tcdmxInputPrice, m.tcdmxOutputPrice, m.tcdmxInputPrice, m.tcdmxOutputPrice, m.tcdmxCachePrice, now);
    console.log("✓ inserted", m.model);
  }
}
console.log("Done. Adjust prices in Admin → Pricing if needed.");
db.close();
