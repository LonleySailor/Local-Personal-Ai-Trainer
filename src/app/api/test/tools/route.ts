import { NextResponse } from "next/server";
import {
  createWorkoutSession,
  finishWorkout,
  generateWorkoutOutline,
  getAvailableEquipment,
  logSet,
} from "@/app/api/ai/tools";

export const dynamic = "force-dynamic";

/**
 * Rerunnable integration test for the AI server-action tools.
 *
 * Walks through the full tool chain:
 *   1. Read available equipment
 *   2. Generate a workout outline from a check-in
 *   3. Create a session
 *   4. Log a few sets against that session
 *   5. Finish the workout and generate an AI memory
 *
 * Hitting this endpoint with curl is the quickest way to verify that the
 * DB layer, LLM provider, and server-action tools are wired correctly.
 */
export async function GET() {
  try {
    const userId = 1;

    const equipment = await getAvailableEquipment(userId);

    // Disliked exercises and long-term medical conditions now live on the user
    // profile; only short-term/session inputs are passed here.
    const outline = await generateWorkoutOutline({
      userId,
      sleepQuality: 7,
      mood: 8,
      injuryNotes: "mild shoulder tightness",
      shortTermInjury: "left knee niggle",
      timeAvailableMinutes: 60,
    });

    if (!outline.exercises.length) {
      throw new Error("Generated outline did not contain any exercises");
    }

    const session = await createWorkoutSession(userId);

    const first = outline.exercises[0];
    await logSet({
      sessionId: session.id,
      exerciseName: first.name,
      reps: 10,
      weight:
        typeof first.weight === "string" && first.weight.includes("kg")
          ? parseFloat(first.weight.replace(/[^0-9.]/g, ""))
          : undefined,
      rpe: first.rpe,
    });
    await logSet({
      sessionId: session.id,
      exerciseName: first.name,
      reps: 10,
      rpe: first.rpe,
    });

    let secondLogged = false;
    if (outline.exercises.length > 1) {
      const second = outline.exercises[1];
      await logSet({
        sessionId: session.id,
        exerciseName: second.name,
        reps: 12,
        rpe: second.rpe,
      });
      secondLogged = true;
    }

    const finished = await finishWorkout({
      sessionId: session.id,
      notes: "AI tools rerunnable test",
    });

    return NextResponse.json({
      success: true,
      checks: {
        equipmentLoaded: equipment.length > 0,
        outlineGenerated: outline.exercises.length > 0,
        sessionCreated: session.id > 0,
        setsLogged: finished.totalSets > 0 && secondLogged,
        memoryGenerated: finished.memory.length > 0,
      },
      equipmentCount: equipment.length,
      outline,
      session,
      result: finished,
    });
  } catch (error) {
    console.error("AI tools test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
