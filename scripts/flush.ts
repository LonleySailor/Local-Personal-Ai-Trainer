#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// Load env vars from .env.local (same approach as scripts/seed.ts)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    process.env[key.trim()] = rest.join("=").trim();
  }
}

const dbPath = path.resolve(
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "ai-trainer.db")
);

if (!fs.existsSync(dbPath)) {
  console.log(`⏭  No database at ${dbPath} — nothing to flush.`);
  process.exit(0);
}

// `--all` also clears users + equipment (requires re-seeding afterwards).
// Default keeps users/equipment and only clears training history — which is all
// the AI reads as context (recovery check-ins, sessions, sets, memories).
const wipeAll = process.argv.includes("--all");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

// Child tables before parents to respect foreign keys.
const trainingTables = [
  "workout_sets",
  "workout_sessions",
  "recovery_logs",
  "ai_memories",
];
const tables = wipeAll
  ? [...trainingTables, "equipment", "users"]
  : trainingTables;

function existingTables(): Set<string> {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

const present = existingTables();

const flush = sqlite.transaction(() => {
  sqlite.pragma("foreign_keys = OFF");
  for (const table of tables) {
    if (!present.has(table)) continue;
    const { n } = sqlite
      .prepare(`SELECT COUNT(*) AS n FROM ${table}`)
      .get() as { n: number };
    sqlite.prepare(`DELETE FROM ${table}`).run();
    // Reset AUTOINCREMENT counters so ids restart at 1.
    sqlite.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
    console.log(`✓ ${table}: ${n} row(s) deleted`);
  }
  sqlite.pragma("foreign_keys = ON");
});

flush();
sqlite.close();

console.log(
  wipeAll
    ? "\n✅ Full wipe complete — run `npm run seed` to recreate the default user and equipment."
    : "\n✅ Training history flushed (users + equipment kept)."
);
