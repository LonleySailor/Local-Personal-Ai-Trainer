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
    height_cm INTEGER,
    body_weight_kg REAL,
    medical_conditions TEXT,
    disliked_exercises TEXT,
    strength_benchmarks TEXT,
    profile_completed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    weight TEXT,
    weight_unit TEXT NOT NULL DEFAULT 'kg',
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
    time_budget_minutes INTEGER,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS workout_sets (
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
    // Free weights — static dumbbells as comma-separated list
    { name: "Dumbbells", category: "dumbbell", weight: "5, 10, 12, 15, 20, 25", weightUnit: "kg" },
    // Barbell
    { name: "Barbell", category: "barbell", weight: "20", weightUnit: "kg" },
    // Plates
    { name: "Plates", category: "plate", weight: "5, 10, 20", weightUnit: "kg" },
    // Bench
    { name: "Flat Bench", category: "bench", weight: null, weightUnit: "kg" },
    { name: "Incline Bench", category: "bench", weight: null, weightUnit: "kg" },
    // Rack
    { name: "Power Rack", category: "rack", weight: null, weightUnit: "kg" },
    // Bodyweight
    { name: "Pull-up Bar", category: "bodyweight", weight: null, weightUnit: "kg" },
    // Cables
    { name: "Cable Machine", category: "cable", weight: "5-80", weightUnit: "kg" },
    // Accessories
    { name: "Resistance Bands", category: "accessory", weight: null, weightUnit: "kg" },
    // Kettlebells
    { name: "Kettlebells", category: "kettlebell", weight: "12, 16, 24", weightUnit: "kg" },
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

    // Check if header matches expected columns
    const columns = header.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const nameIdx = columns.findIndex((c) => c === "name");
    const categoryIdx = columns.findIndex((c) => c === "category");
    const weightIdx = columns.findIndex((c) => c === "weight" || c === "equipment");
    const weightUnitIdx = columns.findIndex((c) => c === "weight_unit");

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
      const weightRaw = weightIdx !== -1 ? values[weightIdx].trim() : "";
      const weight = weightRaw || null;
      const unitRaw =
        weightUnitIdx !== -1 ? (values[weightUnitIdx]?.trim().toLowerCase() ?? "") : "";
      const weightUnit = unitRaw === "lb" || unitRaw === "lbs" ? "lb" : "kg";

      if (!name || !category) continue;

      db.insert(equipmentTable).values({ name, category, weight, weightUnit }).run();
      imported++;
    }

    console.log(`✓ Imported ${imported} items from ${path.basename(csvPath)}`);
  }
}

sqlite.close();
console.log("\n✅ Seed complete");
