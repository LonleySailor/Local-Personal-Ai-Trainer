import type { ExerciseKind } from "@/app/api/ai/tools";

// Shared, dependency-free formatting for exercise kinds so the workout stepper,
// recap/history views, and the AI memory summary all render sets the same way.

export function formatDuration(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  return `${seconds}s`;
}

type LoggedSet = {
  kind: string;
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  rpe: number | null;
};

// Compact detail for an already-logged set (recap, history, AI memory summary).
export function formatLoggedSet(set: LoggedSet): string {
  switch (set.kind) {
    case "timed":
      return set.durationSeconds != null
        ? formatDuration(set.durationSeconds)
        : "done";
    case "mobility":
      return "done";
    case "bodyweight": {
      const parts: string[] = [];
      if (set.reps != null) parts.push(`${set.reps} reps`);
      if (set.rpe != null) parts.push(`RPE ${set.rpe}`);
      return parts.join(" · ") || "done";
    }
    case "strength":
    default: {
      const parts: string[] = [];
      if (set.reps != null) parts.push(`${set.reps} reps`);
      if (set.weight != null) parts.push(`${set.weight}kg`);
      if (set.rpe != null) parts.push(`RPE ${set.rpe}`);
      return parts.join(" · ") || "done";
    }
  }
}

type OutlineTarget = {
  kind: ExerciseKind;
  weight?: string | null;
  reps?: string | null;
  durationSeconds?: number | null;
  rpe?: number | null;
};

// Target line shown above the inputs in the stepper, per kind.
export function formatTarget(target: OutlineTarget): string {
  switch (target.kind) {
    case "timed":
      return target.durationSeconds != null
        ? formatDuration(target.durationSeconds)
        : "timed";
    case "mobility":
      return "mark done when complete";
    case "bodyweight": {
      const parts: string[] = [];
      if (target.reps) parts.push(`${target.reps} reps`);
      if (target.rpe != null) parts.push(`RPE ${target.rpe}`);
      return parts.join(" · ") || "as prescribed";
    }
    case "strength":
    default: {
      const parts: string[] = [];
      if (target.weight) parts.push(target.weight);
      if (target.reps) parts.push(`${target.reps} reps`);
      if (target.rpe != null) parts.push(`RPE ${target.rpe}`);
      return parts.join(" · ") || "as prescribed";
    }
  }
}
