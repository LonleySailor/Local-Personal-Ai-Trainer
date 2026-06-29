import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Single-user for MVP. Profile fields are long-term facts captured once during
// setup and reused for every workout (instead of re-typed per session).
// `profileCompletedAt` is the gate signal: null means the user hasn't set up
// their profile yet.
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  goals: text("goals"),
  heightCm: integer("height_cm"),
  bodyWeightKg: real("body_weight_kg"),
  medicalConditions: text("medical_conditions"),
  dislikedExercises: text("disliked_exercises"),
  strengthBenchmarks: text("strength_benchmarks"),
  profileCompletedAt: integer("profile_completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const equipment = sqliteTable("equipment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  weight: text("weight"),
  weightUnit: text("weight_unit").default("kg").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const recoveryLogs = sqliteTable("recovery_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  sleepQuality: integer("sleep_quality").notNull(),
  mood: integer("mood").notNull(),
  injuryNotes: text("injury_notes"),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const workoutSessions = sqliteTable("workout_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  startTime: integer("start_time", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  endTime: integer("end_time", { mode: "timestamp" }),
  // Minutes the user said they had available when starting this session.
  timeBudgetMinutes: integer("time_budget_minutes"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// kind: "strength" | "bodyweight" | "timed" | "mobility"
// reps is nullable — only strength/bodyweight log reps; timed logs
// durationSeconds; mobility logs neither (just that it was completed).
export const workoutSets = sqliteTable("workout_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => workoutSessions.id),
  exerciseName: text("exercise_name").notNull(),
  kind: text("kind").notNull().default("strength"),
  weight: real("weight"),
  reps: integer("reps"),
  durationSeconds: integer("duration_seconds"),
  rpe: integer("rpe"),
  order: integer("order").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const aiMemories = sqliteTable("ai_memories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  memory: text("memory").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
