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
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Shape of a single exercise inside a generated workout outline.
// ─────────────────────────────────────────────────────────────────────────────
const outlineExerciseSchema = z.object({
  name: z.string().describe("The exercise name"),
  sets: z.number().int().min(1).describe("Number of sets to perform"),
  reps: z.string().describe("Target reps per set, e.g. '8-12' or '10'"),
  weight: z.string().describe("Suggested weight or load, e.g. 'bodyweight' or '20kg'"),
  rpe: z.number().int().min(1).max(10).describe("Target RPE for this exercise"),
  restSeconds: z.number().int().optional().describe("Recommended rest between sets in seconds"),
  notes: z.string().optional().describe("Optional coaching notes for the exercise"),
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
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.2  Build a compact system prompt from DB state
// ─────────────────────────────────────────────────────────────────────────────
export type RecoverySummary = {
  sleepQuality: number;
  mood: number;
  injuryNotes?: string | null;
};

export async function buildSystemPrompt({
  userId,
  recovery,
  dislikedExercises = [],
  medicalConditions = [],
  shortTermInjury,
}: {
  userId: number;
  recovery?: RecoverySummary;
  dislikedExercises?: string[];
  medicalConditions?: string[];
  shortTermInjury?: string;
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
    .map((e) => `- ${e.name} (${e.category}${e.weight ? `, ${e.weight}kg` : ""})`)
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

  const safetyText = [
    dislikedExercises.length > 0
      ? `NEVER include these exercises: ${dislikedExercises.join(", ")}.`
      : null,
    medicalConditions.length > 0
      ? `Medical considerations: ${medicalConditions.join(", ")}.`
      : null,
    shortTermInjury ? `Current injury/issue: ${shortTermInjury}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a knowledgeable, safety-first personal trainer coaching a single user.

## User profile
Name: ${user.name}
Goals: ${user.goals ?? "General fitness"}

## Available equipment
${equipmentText}

## Latest recovery check-in
${recoveryText}

## Prior AI memories
${memoryText}

## Safety rules
${safetyText || "No specific restrictions."}

Instructions:
- Build a single-session workout using only the available equipment.
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
  dislikedExercises = [],
  medicalConditions = [],
  shortTermInjury,
}: {
  userId: number;
  sleepQuality: number;
  mood: number;
  injuryNotes?: string | null;
  dislikedExercises?: string[];
  medicalConditions?: string[];
  shortTermInjury?: string;
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
    dislikedExercises,
    medicalConditions,
    shortTermInjury,
  });

  const userMessage = `Today's check-in:
- Sleep quality: ${sleepQuality}/10
- Mood/energy: ${mood}/10
- Injury notes: ${injuryNotes ?? "none"}

Generate a workout outline for me today.`;

  const { object } = await generateObject({
    model: lmStudioModel,
    system: systemPrompt,
    prompt: userMessage,
    schema: workoutOutlineSchema,
    output: "object",
    maxOutputTokens: 2048,
  });

  return object;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create a fresh workout session (used by Phase 5 UI before logging sets)
// ─────────────────────────────────────────────────────────────────────────────
export async function createWorkoutSession(userId: number) {
  const result = await db
    .insert(workoutSessions)
    .values({ userId })
    .returning({ id: workoutSessions.id, startTime: workoutSessions.startTime });

  return result[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.4  Log a completed set
// ─────────────────────────────────────────────────────────────────────────────
export async function logSet({
  sessionId,
  exerciseName,
  weight,
  reps,
  rpe,
}: {
  sessionId: number;
  exerciseName: string;
  weight?: number;
  reps: number;
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
      weight: weight ?? null,
      reps,
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
          .map(
            (s) =>
              `${s.order}. ${s.exerciseName}: ${s.reps} reps ${s.weight ? `@ ${s.weight}kg` : ""} (RPE ${s.rpe ?? "n/a"})`
          )
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
      maxOutputTokens: 256,
    });
    memoryText = object.memory.trim();
  } catch {
    // If the structured call fails, fall back to plain text so the session
    // can still be closed cleanly.
    const { text } = await generateText({
      model: lmStudioModel,
      prompt: memoryPrompt,
      maxOutputTokens: 256,
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
