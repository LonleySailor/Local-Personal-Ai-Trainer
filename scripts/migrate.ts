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
  console.log(
    `⏭  No database at ${dbPath} — nothing to migrate. Run \`npm run seed\` first.`
  );
  process.exit(0);
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

type ColumnInfo = { name: string };

function columns(table: string): string[] {
  return (sqlite.pragma(`table_info(${table})`) as ColumnInfo[]).map(
    (c) => c.name
  );
}

// ── Migration: workout_sets gains `kind` + `duration_seconds`, `reps` becomes
// nullable ──────────────────────────────────────────────────────────────────
//
// SQLite cannot drop a NOT NULL constraint via ALTER, so we rebuild the table.
// The whole migration is guarded on the `kind` column: if it already exists the
// table is up to date and we no-op, making this script idempotent.
const existing = columns("workout_sets");

if (existing.includes("kind")) {
  console.log("⏭  workout_sets already migrated, skipping");
} else {
  console.log("→ Migrating workout_sets (add kind/duration_seconds, nullable reps)…");

  const migrate = sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE workout_sets_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES workout_sessions(id),
        exercise_name TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'strength',
        weight REAL,
        reps INTEGER,
        duration_seconds INTEGER,
        rpe INTEGER,
        "order" INTEGER NOT NULL,
        completed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      INSERT INTO workout_sets_new
        (id, session_id, exercise_name, kind, weight, reps, duration_seconds, rpe, "order", completed_at)
      SELECT
        id, session_id, exercise_name, 'strength', weight, reps, NULL, rpe, "order", completed_at
      FROM workout_sets;

      DROP TABLE workout_sets;
      ALTER TABLE workout_sets_new RENAME TO workout_sets;
    `);
  });

  // Foreign-key enforcement must be off during the table swap (it is off by
  // default in better-sqlite3, but be explicit and restore afterwards).
  sqlite.pragma("foreign_keys = OFF");
  migrate();
  sqlite.pragma("foreign_keys = ON");

  const rowCount = (
    sqlite.prepare("SELECT COUNT(*) AS n FROM workout_sets").get() as {
      n: number;
    }
  ).n;
  console.log(`✓ workout_sets migrated (${rowCount} row(s) preserved)`);
}

// ── Migration: users gains profile columns ───────────────────────────────────
//
// These are all nullable additions, so a simple ALTER TABLE ADD COLUMN per
// missing column is enough — no table rebuild required. Guarded on column
// existence so the script stays idempotent.
{
  const userCols = columns("users");
  const additions: Array<[string, string]> = [
    ["height_cm", "INTEGER"],
    ["body_weight_kg", "REAL"],
    ["medical_conditions", "TEXT"],
    ["disliked_exercises", "TEXT"],
    ["strength_benchmarks", "TEXT"],
    ["profile_completed_at", "INTEGER"],
  ];
  const missing = additions.filter(([name]) => !userCols.includes(name));

  if (missing.length === 0) {
    console.log("⏭  users already has profile columns, skipping");
  } else {
    console.log(`→ Adding ${missing.length} profile column(s) to users…`);
    for (const [name, type] of missing) {
      sqlite.exec(`ALTER TABLE users ADD COLUMN ${name} ${type};`);
    }
    console.log("✓ users profile columns added");
  }
}

// ── Migration: workout_sessions gains time_budget_minutes ────────────────────
{
  const sessionCols = columns("workout_sessions");
  if (sessionCols.includes("time_budget_minutes")) {
    console.log("⏭  workout_sessions already has time_budget_minutes, skipping");
  } else {
    console.log("→ Adding time_budget_minutes to workout_sessions…");
    sqlite.exec(
      `ALTER TABLE workout_sessions ADD COLUMN time_budget_minutes INTEGER;`
    );
    console.log("✓ workout_sessions.time_budget_minutes added");
  }
}

sqlite.close();
console.log("\n✅ Migration complete");
