"use server";

import { db } from "@/db/client";
import {
  aiMemories,
  equipment,
  recoveryLogs,
  users,
  workoutSessions,
  workoutSets,
} from "@/db/schema";
import { generateObject, generateText, lmStudioModel } from "@/lib/llm";
import { formatLoggedSet } from "@/lib/workout-format";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Shape of a single exercise inside a generated workout outline.
//
// `kind` drives which fields are meaningful and how the UI logs it:
//   - strength:  weight + reps (+ rpe)   — concrete load prescribed from history
//   - bodyweight: reps (+ rpe)           — no external load
//   - timed:     durationSeconds         — holds/cardio (plank, bike, jog)
//   - mobility:  none                    — warm-up/stretch, just "mark done"
// ─────────────────────────────────────────────────────────────────────────────
// Not exported as a value: this module is "use server", which may only export
// async functions. Consumers import the `ExerciseKind` type (erased at build).
const EXERCISE_KINDS = ["strength", "bodyweight", "timed", "mobility"] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

const outlineExerciseSchema = z.object({
  name: z.string().describe("The exercise name"),
  kind: z
    .enum(EXERCISE_KINDS)
    .describe(
      "Exercise type: 'strength' (uses weight+reps), 'bodyweight' (reps only), 'timed' (uses durationSeconds, e.g. plank or cardio), or 'mobility' (warm-up/stretch, no weight/reps/duration)"
    ),
  sets: z.number().int().min(1).describe("Number of sets/rounds to perform (use 1 for timed or mobility)"),
  reps: z
    .string()
    .optional()
    .describe("Target reps per set. REQUIRED for strength and bodyweight — always provide a concrete number or range (e.g. '10' or '8-12') and never leave it blank for these. Omit only for timed/mobility."),
  weight: z
    .string()
    .optional()
    .describe("Concrete working load for strength exercises, e.g. '20kg' or '60kg'. Provide ONLY the load value and unit — do NOT include the equipment name (write '10kg', not '10 kg dumbbell'). Prescribe a real number based on the user's recent performance — never a placeholder. Omit for bodyweight/timed/mobility."),
  durationSeconds: z
    .number()
    .int()
    .optional()
    .describe("Duration in seconds for 'timed' exercises, e.g. 60 for a 1-minute plank. Omit for other kinds."),
  rpe: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Target RPE for strength/bodyweight exercises. Omit for timed/mobility."),
  restSeconds: z
    .number()
    .int()
    .optional()
    .describe(
      "Recommended rest between sets in seconds. ALWAYS set this for 'strength' and 'bodyweight' exercises, using the rest range from the Programming guidelines row that matches the user's goal (e.g. 120-240s for strength, 60-90s for hypertrophy). Use a short value (15-45s) for 'timed'/'mobility'. The app shows this as a rest countdown between sets, and it counts toward the session time budget."
    ),
  notes: z.string().optional().describe("Optional coaching notes for the exercise (e.g. stretch instructions for mobility)"),
});

export type OutlineExercise = z.infer<typeof outlineExerciseSchema>;

const workoutOutlineSchema = z.object({
  exercises: z
    .array(outlineExerciseSchema)
    .min(1)
    .describe("The ordered list of exercises for this workout"),
  sessionNotes: z
    .string()
    .optional()
    .describe("High-level notes or motivation for the session"),
});

export type WorkoutOutline = z.infer<typeof workoutOutlineSchema>;

// Generation-time variant of the outline schema with a leading "reasoning"
// scratch field. Under grammar-constrained decoding a reasoning model has no
// free-text outlet, so it tends to "think" inside string values — sometimes
// emitting its hidden thought token mid-JSON, which breaks parsing. Giving it
// a sanctioned place to think first makes generation far more reliable (and
// the plans noticeably better). The field is stripped before the outline is
// returned or stored.
const workoutOutlineGenSchema = z.object({
  reasoning: z
    .string()
    .describe(
      "Think here first, briefly (2-4 sentences): recovery state, safety rules, time budget, and which exercises/loads fit. This is scratch space and is never shown to the user."
    ),
  exercises: workoutOutlineSchema.shape.exercises,
  sessionNotes: workoutOutlineSchema.shape.sessionNotes,
});

// ─────────────────────────────────────────────────────────────────────────────
// Server-side safety net for the model output. The schema keeps reps/weight
// optional so timed/mobility stay valid, which means the LLM is free to omit a
// rep target on a loaded/bodyweight lift — the UI then renders "as prescribed".
// Guarantee strength/bodyweight always carry a concrete rep target, and strip
// equipment names the model sometimes leaks into the weight field
// (e.g. "10 kg dumbbell" → "10kg").
// ─────────────────────────────────────────────────────────────────────────────
function normalizeOutline(outline: WorkoutOutline): WorkoutOutline {
  return {
    ...outline,
    exercises: outline.exercises.map((exercise) => {
      if (exercise.kind !== "strength" && exercise.kind !== "bodyweight") {
        return exercise;
      }

      const next = { ...exercise };

      // Backstop a missing rep target so the UI never shows "as prescribed".
      if (!next.reps || next.reps.trim() === "") {
        next.reps = "8-12";
      }

      // Keep only the leading number + unit from the weight field.
      if (exercise.kind === "strength" && next.weight) {
        const match = next.weight.match(/(\d+(?:\.\d+)?)\s*(kg|lb|lbs)?/i);
        if (match) {
          const unit = (match[2] ?? "kg").toLowerCase();
          next.weight = `${match[1]}${unit}`;
        }
      }

      return next;
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// User profile — long-term facts captured once during setup and reused for every
// workout. `profileCompletedAt` gates access to the rest of the app.
// ─────────────────────────────────────────────────────────────────────────────
export type UserProfile = {
  id: number;
  name: string;
  goals: string | null;
  heightCm: number | null;
  bodyWeightKg: number | null;
  medicalConditions: string | null;
  dislikedExercises: string | null;
  strengthBenchmarks: string | null;
  profileCompletedAt: Date | null;
};

export async function getUserProfile(
  userId: number
): Promise<UserProfile | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    goals: user.goals,
    heightCm: user.heightCm,
    bodyWeightKg: user.bodyWeightKg,
    medicalConditions: user.medicalConditions,
    dislikedExercises: user.dislikedExercises,
    strengthBenchmarks: user.strengthBenchmarks,
    profileCompletedAt: user.profileCompletedAt,
  };
}

const saveUserProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  goals: z.string().trim().optional(),
  heightCm: z.number().positive().optional(),
  bodyWeightKg: z.number().positive().optional(),
  medicalConditions: z.string().trim().optional(),
  dislikedExercises: z.string().trim().optional(),
  strengthBenchmarks: z.string().trim().optional(),
});

export type SaveUserProfileInput = z.input<typeof saveUserProfileSchema>;

export async function saveUserProfile(
  userId: number,
  input: SaveUserProfileInput
) {
  const data = saveUserProfileSchema.parse(input);

  // Empty strings → null so the prompt builder can cleanly skip absent sections.
  const orNull = (v?: string) => (v && v.length > 0 ? v : null);

  await db
    .update(users)
    .set({
      name: data.name,
      goals: orNull(data.goals),
      heightCm: data.heightCm ?? null,
      bodyWeightKg: data.bodyWeightKg ?? null,
      medicalConditions: orNull(data.medicalConditions),
      dislikedExercises: orNull(data.dislikedExercises),
      strengthBenchmarks: orNull(data.strengthBenchmarks),
      profileCompletedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.1  Get available equipment
// ─────────────────────────────────────────────────────────────────────────────
export async function getAvailableEquipment() {
  const rows = await db.select().from(equipment);
  return rows.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    weight: item.weight,
    weightUnit: item.weightUnit,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent performance — derive per-exercise bests from logged history so the LLM
// can prescribe concrete loads. Estimated 1RM uses the Epley formula
// (weight × (1 + reps/30)). Only sets from *completed* sessions count, and the
// result is capped to the `limit` most recently trained exercises so the
// "Recent performance" prompt section stays small.
// ─────────────────────────────────────────────────────────────────────────────
export type ExercisePerformance = {
  exerciseName: string;
  lastWeight: number | null;
  lastReps: number | null;
  lastDurationSeconds: number | null;
  estimated1RM: number | null;
};

export async function getExerciseHistory(
  userId: number,
  limit = 12
): Promise<ExercisePerformance[]> {
  // Recent sets from this user's *completed* sessions, newest first.
  const rows = await db
    .select({
      exerciseName: workoutSets.exerciseName,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      durationSeconds: workoutSets.durationSeconds,
    })
    .from(workoutSets)
    .innerJoin(workoutSessions, eq(workoutSets.sessionId, workoutSessions.id))
    .where(
      and(
        eq(workoutSessions.userId, userId),
        isNotNull(workoutSessions.endTime)
      )
    )
    .orderBy(desc(workoutSets.completedAt))
    .limit(300);

  type Agg = {
    lastWeight: number | null;
    lastReps: number | null;
    lastDurationSeconds: number | null;
    best1RM: number | null;
  };
  const byExercise = new Map<string, Agg>();
  const order: string[] = [];

  for (const r of rows) {
    let agg = byExercise.get(r.exerciseName);
    if (!agg) {
      // First occurrence is the most recent (rows are sorted desc).
      agg = {
        lastWeight: r.weight ?? null,
        lastReps: r.reps ?? null,
        lastDurationSeconds: r.durationSeconds ?? null,
        best1RM: null,
      };
      byExercise.set(r.exerciseName, agg);
      order.push(r.exerciseName);
    }
    if (r.weight != null && r.reps != null && r.weight > 0 && r.reps > 0) {
      const est = r.weight * (1 + r.reps / 30); // Epley
      if (agg.best1RM == null || est > agg.best1RM) agg.best1RM = est;
    }
  }

  return order.slice(0, limit).map((name) => {
    const a = byExercise.get(name)!;
    return {
      exerciseName: name,
      lastWeight: a.lastWeight,
      lastReps: a.lastReps,
      lastDurationSeconds: a.lastDurationSeconds,
      estimated1RM: a.best1RM != null ? Math.round(a.best1RM) : null,
    };
  });
}

function formatPerformance(p: ExercisePerformance): string {
  const parts: string[] = [];
  if (p.lastWeight != null && p.lastReps != null) {
    parts.push(`last ${p.lastWeight}kg×${p.lastReps}`);
  } else if (p.lastReps != null) {
    parts.push(`last ${p.lastReps} reps`);
  } else if (p.lastDurationSeconds != null) {
    parts.push(`last ${p.lastDurationSeconds}s`);
  }
  if (p.estimated1RM != null) parts.push(`est 1RM ~${p.estimated1RM}kg`);
  return `- ${p.exerciseName}: ${parts.length > 0 ? parts.join(", ") : "logged"}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.2  Build a compact system prompt from DB state
//
// The app never sends conversation history to the LLM. Every generation call
// reconstructs its context fresh from SQLite: user profile (incl. medical
// conditions + disliked exercises), equipment list, today's check-in, the last
// 3 AI memories, and recent per-exercise performance. This keeps the prompt
// small enough for 7B–13B models on an 8GB VRAM budget while still giving the
// model everything it needs to program a safe, personalized session.
// ─────────────────────────────────────────────────────────────────────────────
export type RecoverySummary = {
  sleepQuality: number;
  mood: number;
  injuryNotes?: string | null;
};

export async function buildSystemPrompt({
  userId,
  recovery,
  shortTermInjury,
  timeAvailableMinutes,
}: {
  userId: number;
  recovery?: RecoverySummary;
  shortTermInjury?: string;
  timeAvailableMinutes?: number;
}): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const equipmentList = await getAvailableEquipment();

  let latestRecovery = recovery;
  if (!latestRecovery) {
    const rows = await db
      .select()
      .from(recoveryLogs)
      .where(eq(recoveryLogs.userId, userId))
      .orderBy(desc(recoveryLogs.timestamp))
      .limit(1);
    if (rows.length > 0) {
      const row = rows[0];
      latestRecovery = {
        sleepQuality: row.sleepQuality,
        mood: row.mood,
        injuryNotes: row.injuryNotes,
      };
    }
  }

  const memories = await db
    .select({ memory: aiMemories.memory, createdAt: aiMemories.createdAt })
    .from(aiMemories)
    .where(eq(aiMemories.userId, userId))
    .orderBy(desc(aiMemories.createdAt))
    .limit(3);

  const equipmentText = equipmentList
    .map((e) => {
      const weightInfo = e.weight ? `, ${e.weight} ${e.weightUnit ?? "kg"}` : "";
      return `- ${e.name} (${e.category}${weightInfo})`;
    })
    .join("\n");

  const recoveryText = latestRecovery
    ? `Sleep quality: ${latestRecovery.sleepQuality}/10
Mood/energy: ${latestRecovery.mood}/10
Injury notes: ${latestRecovery.injuryNotes ?? "none"}`
    : "No recent recovery log available.";

  const memoryText =
    memories.length > 0
      ? memories.map((m) => `- ${m.memory} (${m.createdAt.toDateString()})`).join("\n")
      : "No prior memories.";

  const history = await getExerciseHistory(userId);
  const performanceText =
    history.length > 0
      ? history.map(formatPerformance).join("\n")
      : "No training history yet — estimate loads conservatively and calibrate over time.";

  // Disliked exercises and medical conditions are long-term profile facts, kept
  // verbatim from the user's setup (free-text). Short-term injury is per session.
  const safetyText = [
    user.dislikedExercises
      ? `NEVER include these exercises: ${user.dislikedExercises}.`
      : null,
    user.medicalConditions
      ? `Long-term medical considerations: ${user.medicalConditions}.`
      : null,
    shortTermInjury ? `Today's injury/issue: ${shortTermInjury}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const profileText = [
    `Name: ${user.name}`,
    `Goals: ${user.goals ?? "General fitness"}`,
    user.bodyWeightKg != null ? `Body weight: ${user.bodyWeightKg}kg` : null,
    user.heightCm != null ? `Height: ${user.heightCm}cm` : null,
    user.strengthBenchmarks
      ? `Strength benchmarks: ${user.strengthBenchmarks}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const timeBudgetText =
    timeAvailableMinutes != null
      ? `The user has about ${timeAvailableMinutes} minutes for today's session, INCLUDING rest between sets. Size the workout (number of exercises and sets) to realistically fit this window — fewer exercises for short sessions, more for long ones. Account for each exercise's restSeconds when estimating total time.`
      : "No fixed time limit was given — aim for a balanced ~60 minute session.";

  return `You are a knowledgeable, safety-first personal trainer coaching a single user.

## User profile
${profileText}

## Available equipment
${equipmentText}

## Latest recovery check-in
${recoveryText}

## Time budget for today
${timeBudgetText}

## Recent performance (use this to prescribe loads)
${performanceText}

## Programming guidelines (apply the row matching the user's goal above)
- Strength: 3-6 reps, target RPE 7-9, rest 120-240s (2-4 min) on compound lifts.
- Hypertrophy / muscle mass: 8-12 reps, target RPE 7-9, rest 60-90s.
- Muscular endurance: 15-20+ reps, target RPE 6-8, rest 30-60s.
- General fitness / mixed / unclear: 8-12 reps, rest 60-90s, leaning toward the user's stated emphasis.

## Prior AI memories
${memoryText}

## Safety rules
${safetyText || "No specific restrictions."}

Instructions:
- Build a single-session workout using only the available equipment.
- Fit the workout to the user's time budget above, counting rest periods.
- Classify every exercise with a "kind": "strength" (weight+reps), "bodyweight" (reps only), "timed" (durationSeconds, e.g. plank/cardio), or "mobility" (warm-up/stretch — no weight, reps, or duration).
- For "strength" exercises, prescribe a CONCRETE working weight and rep target based on the user's recent performance and estimated 1RMs above (progress gradually). Never output placeholders like "bodyweight" or "none" for a loaded lift.
- Set reps, target RPE, and restSeconds from the Programming guidelines row that matches the user's goal. Every strength and bodyweight exercise MUST have a concrete rep target.
- If there is no history for a lift, estimate a conservative starting weight from the user's profile and other lifts.
- Use "timed" with durationSeconds for holds and cardio; do not put durations in the reps field.
- For "mobility"/warm-up exercises, leave weight, reps, durationSeconds, and rpe empty — these are just "mark done".
- Set a sensible "restSeconds" on every strength/bodyweight exercise (the app shows it as a rest countdown and counts it toward the time budget).
- Honor the safety rules strictly (exclude disliked exercises and adjust for injuries).
- Match intensity to the recovery check-in (sleep, mood, injury notes).
- Keep the plan concise and actionable.
- Return ONLY the requested structured output.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.3  Generate a structured workout outline from a check-in
// ─────────────────────────────────────────────────────────────────────────────
export async function generateWorkoutOutline({
  userId,
  sleepQuality,
  mood,
  injuryNotes,
  shortTermInjury,
  timeAvailableMinutes,
}: {
  userId: number;
  sleepQuality: number;
  mood: number;
  injuryNotes?: string | null;
  shortTermInjury?: string;
  timeAvailableMinutes?: number;
}): Promise<WorkoutOutline> {
  if (sleepQuality < 1 || sleepQuality > 10 || mood < 1 || mood > 10) {
    throw new Error("sleepQuality and mood must be between 1 and 10");
  }

  await db.insert(recoveryLogs).values({
    userId,
    sleepQuality,
    mood,
    injuryNotes,
  });

  const systemPrompt = await buildSystemPrompt({
    userId,
    recovery: { sleepQuality, mood, injuryNotes },
    shortTermInjury,
    timeAvailableMinutes,
  });

  const userMessage = `Today's check-in:
- Sleep quality: ${sleepQuality}/10
- Mood/energy: ${mood}/10
- Injury notes: ${injuryNotes ?? "none"}${
    timeAvailableMinutes != null
      ? `\n- Time available: ${timeAvailableMinutes} minutes`
      : ""
  }

Generate a workout outline for me today.`;

  const generate = () =>
    generateObject({
      model: lmStudioModel,
      system: systemPrompt,
      prompt: userMessage,
      schema: workoutOutlineGenSchema,
      output: "object",
      maxOutputTokens: 1024 * 8,
    });

  let object: z.infer<typeof workoutOutlineGenSchema>;
  try {
    ({ object } = await generate());
  } catch {
    // Local models occasionally emit output the SDK can't parse; one retry
    // resolves the vast majority of those.
    ({ object } = await generate());
  }

  // Drop the reasoning scratch field — only the plan itself is kept.
  return normalizeOutline({
    exercises: object.exercises,
    sessionNotes: object.sessionNotes,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create a fresh workout session (used by Phase 5 UI before logging sets)
// ─────────────────────────────────────────────────────────────────────────────
export async function createWorkoutSession(
  userId: number,
  outline?: WorkoutOutline,
  timeBudgetMinutes?: number
) {
  const result = await db
    .insert(workoutSessions)
    .values({
      userId,
      timeBudgetMinutes: timeBudgetMinutes ?? null,
      notes: outline ? JSON.stringify(outline) : null,
    })
    .returning({ id: workoutSessions.id, startTime: workoutSessions.startTime });

  return result[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.4  Log a completed set
// ─────────────────────────────────────────────────────────────────────────────
export async function logSet({
  sessionId,
  exerciseName,
  kind = "strength",
  weight,
  reps,
  durationSeconds,
  rpe,
}: {
  sessionId: number;
  exerciseName: string;
  kind?: ExerciseKind;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  rpe?: number;
}) {
  const [session] = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId));

  if (!session) {
    throw new Error(`Workout session ${sessionId} not found`);
  }

  const [{ count: previousSets }] = await db
    .select({ count: count() })
    .from(workoutSets)
    .where(eq(workoutSets.sessionId, sessionId));

  const order = (previousSets ?? 0) + 1;

  const inserted = await db
    .insert(workoutSets)
    .values({
      sessionId,
      exerciseName,
      kind,
      weight: weight ?? null,
      reps: reps ?? null,
      durationSeconds: durationSeconds ?? null,
      rpe: rpe ?? null,
      order,
    })
    .returning({
      id: workoutSets.id,
      order: workoutSets.order,
    });

  return { success: true, set: inserted[0] };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.5  Finish a workout and generate an AI memory
// ─────────────────────────────────────────────────────────────────────────────
const memorySchema = z.object({
  // Leading scratch field for the same reason as workoutOutlineGenSchema:
  // reasoning models behave much better with a sanctioned place to think.
  reasoning: z
    .string()
    .describe(
      "Think here briefly before writing the note. Scratch space — never stored."
    ),
  memory: z
    .string()
    .min(1)
    .describe("Concise 1-2 sentence memory note summarising the session"),
});

export async function finishWorkout({
  sessionId,
  notes,
}: {
  sessionId: number;
  notes?: string;
}) {
  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId));

  if (!session) {
    throw new Error(`Workout session ${sessionId} not found`);
  }

  const sets = await db
    .select()
    .from(workoutSets)
    .where(eq(workoutSets.sessionId, sessionId))
    .orderBy(workoutSets.order);

  const endTime = new Date();

  const setSummary =
    sets.length === 0
      ? "No sets were logged."
      : sets
          .map((s) => `${s.order}. ${s.exerciseName}: ${formatLoggedSet(s)}`)
          .join("\n");

  const durationMinutes =
    session.startTime && endTime
      ? Math.round((endTime.getTime() - session.startTime.getTime()) / 60000)
      : 0;

  const memoryPrompt = `You are the same personal trainer from this session.

Workout summary:
${setSummary}

Session duration: ${durationMinutes} minutes.
User notes: ${notes ?? "none"}

Write a concise 1-2 sentence memory note summarising what happened and what to remember for next time.`;

  let memoryText: string;
  try {
    const { object } = await generateObject({
      model: lmStudioModel,
      prompt: memoryPrompt,
      schema: memorySchema,
      output: "object",
      // Generous cap: reasoning models spend output tokens on hidden
      // reasoning before the visible note, so 256 can truncate to nothing.
      maxOutputTokens: 2048*2,
    });
    memoryText = object.memory.trim();
  } catch {
    // If the structured call fails, fall back to plain text so the session
    // can still be closed cleanly.
    const { text } = await generateText({
      model: lmStudioModel,
      prompt: memoryPrompt,
      maxOutputTokens: 2048*2,
    });
    memoryText = text.trim();
  }

  if (!memoryText) {
    memoryText = `Completed ${sets.length} set(s) over ${durationMinutes} minute(s).`;
  }

  await db.insert(aiMemories).values({
    userId: session.userId,
    memory: memoryText,
  });

  await db
    .update(workoutSessions)
    .set({
      endTime,
      notes: notes ? `${notes}` : session.notes,
    })
    .where(eq(workoutSessions.id, sessionId));

  return {
    success: true,
    sessionId,
    durationMinutes,
    totalSets: sets.length,
    memory: memoryText,
    exercises: [...new Set(sets.map((s) => s.exerciseName))],
  };
}
