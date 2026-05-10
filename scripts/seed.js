const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = path.resolve(process.cwd(), dbUrl.replace(/^file:/, ""));
const db = new Database(dbPath);

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("ERROR: ADMIN_EMAIL and ADMIN_PASSWORD env vars are required.");
  console.error("Example: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong-random-password>' node scripts/seed.js");
  process.exit(1);
}
if (password.length < 12) {
  console.error("ERROR: ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const existing = db.prepare("SELECT id FROM User WHERE email = ?").get(email);
if (existing) {
  console.log(`Admin already exists: ${email}`);
  process.exit(0);
}

const hashed = bcrypt.hashSync(password, 12);
const id = uuidv4().replace(/-/g, "");
const now = new Date().toISOString();

db.prepare(
  "INSERT INTO User (id, email, password, name, balance, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
).run(id, email, hashed, "Admin", 0, "admin", now, now);

console.log(`Admin created: ${email}`);
db.close();
