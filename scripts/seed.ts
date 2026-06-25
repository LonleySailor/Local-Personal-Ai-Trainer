#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/db/schema";

// Load env vars from .env.local
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

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite, { schema });

// ── Table creation ──────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    goals TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    weight REAL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS recovery_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    sleep_quality INTEGER NOT NULL,
    mood INTEGER NOT NULL,
    injury_notes TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    start_time INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    end_time INTEGER,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES workout_sessions(id),
    exercise_name TEXT NOT NULL,
    weight REAL,
    reps INTEGER NOT NULL,
    rpe INTEGER,
    "order" INTEGER NOT NULL,
    completed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS ai_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    memory TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );
`);

console.log("✓ Tables created");

// ── Seed default user ───────────────────────────────────────────
const { users, equipment: equipmentTable } = schema;

const existingUsers = db.select().from(users).all();
if (existingUsers.length === 0) {
  db.insert(users).values({
    name: "Default User",
    goals: "Build strength and stay healthy",
  }).run();
  console.log("✓ Default user created");
} else {
  console.log("⏭  User already exists, skipping");
}

// ── Seed default equipment ──────────────────────────────────────
const existingEquipment = db.select().from(equipmentTable).all();
if (existingEquipment.length === 0) {
  const defaultEquipment = [
    // Free weights
    { name: "Dumbbell 5kg", category: "dumbbell", weight: 5 },
    { name: "Dumbbell 10kg", category: "dumbbell", weight: 10 },
    { name: "Dumbbell 15kg", category: "dumbbell", weight: 15 },
    { name: "Dumbbell 20kg", category: "dumbbell", weight: 20 },
    { name: "Dumbbell 25kg", category: "dumbbell", weight: 25 },
    // Barbell
    { name: "Barbell 20kg", category: "barbell", weight: 20 },
    // Plates
    { name: "Plate 5kg", category: "plate", weight: 5 },
    { name: "Plate 10kg", category: "plate", weight: 10 },
    { name: "Plate 20kg", category: "plate", weight: 20 },
    // Bench
    { name: "Flat Bench", category: "bench", weight: null },
    { name: "Incline Bench", category: "bench", weight: null },
    // Rack
    { name: "Power Rack", category: "rack", weight: null },
    // Bodyweight
    { name: "Pull-up Bar", category: "bodyweight", weight: null },
    // Cables
    { name: "Cable Machine", category: "cable", weight: null },
    // Accessories
    { name: "Resistance Bands", category: "accessory", weight: null },
    { name: "Kettlebell 12kg", category: "kettlebell", weight: 12 },
    { name: "Kettlebell 16kg", category: "kettlebell", weight: 16 },
    { name: "Kettlebell 24kg", category: "kettlebell", weight: 24 },
  ];

  db.insert(equipmentTable).values(defaultEquipment).run();
  console.log(`✓ ${defaultEquipment.length} equipment items seeded`);
} else {
  console.log("⏭  Equipment already exists, skipping");
}

// ── CSV Import (optional) ───────────────────────────────────────
const csvPath = process.argv[2];
if (csvPath) {
  if (!fs.existsSync(csvPath)) {
    console.error(`✗ CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    console.log("⏭  CSV file is empty (no data rows)");
  } else {
    const header = lines[0].toLowerCase();
    const expectedColumns = ["name", "category", "equipment"];

    // Check if header matches expected columns
    const columns = header.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const nameIdx = columns.findIndex((c) => c === "name");
    const categoryIdx = columns.findIndex((c) => c === "category");
    const weightIdx = columns.findIndex((c) => c === "weight" || c === "equipment");

    if (nameIdx === -1 || categoryIdx === -1) {
      console.error(
        `✗ CSV must have 'name' and 'category' columns. Found: ${columns.join(", ")}`
      );
      process.exit(1);
    }

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const name = values[nameIdx];
      const category = values[categoryIdx];
      const weightVal = weightIdx !== -1 ? parseFloat(values[weightIdx]) : null;
      const weight = isNaN(weightVal ?? NaN) ? null : weightVal;

      if (!name || !category) continue;

      db.insert(equipmentTable).values({ name, category, weight }).run();
      imported++;
    }

    console.log(`✓ Imported ${imported} items from ${path.basename(csvPath)}`);
  }
}

sqlite.close();
console.log("\n✅ Seed complete");
