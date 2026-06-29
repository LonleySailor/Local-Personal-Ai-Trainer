"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  logSet,
  finishWorkout,
  type ExerciseKind,
  type WorkoutOutline,
} from "@/app/api/ai/tools";
import { formatTarget } from "@/lib/workout-format";

// One step = one set/round of an exercise. The outline groups sets under an
// exercise (e.g. 3x squats), so we flatten it into a sequential list to step
// through. `kind` decides which inputs the step shows.
type SetStep = {
  exerciseIndex: number;
  exerciseName: string;
  kind: ExerciseKind;
  setNumber: number;
  totalSets: number;
  targetReps?: string;
  targetWeight?: string;
  targetDurationSeconds?: number;
  targetRpe?: number;
  restSeconds?: number;
  notes?: string;
};

type SetValues = {
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  rpe?: number;
};

type FinishSummary = Awaited<ReturnType<typeof finishWorkout>>;

export type WorkoutStepperProps = {
  sessionId: number;
  outline: WorkoutOutline;
  // Number of sets already logged for this session (for resuming in-progress work).
  initialCompletedCount?: number;
};

export default function WorkoutStepper({
  sessionId,
  outline,
  initialCompletedCount = 0,
}: WorkoutStepperProps) {
  const steps = useMemo<SetStep[]>(() => {
    const out: SetStep[] = [];
    outline.exercises.forEach((exercise, exerciseIndex) => {
      for (let setNumber = 1; setNumber <= exercise.sets; setNumber++) {
        out.push({
          exerciseIndex,
          exerciseName: exercise.name,
          kind: exercise.kind,
          setNumber,
          totalSets: exercise.sets,
          targetReps: exercise.reps,
          targetWeight: exercise.weight,
          targetDurationSeconds: exercise.durationSeconds,
          targetRpe: exercise.rpe,
          restSeconds: exercise.restSeconds,
          notes: exercise.notes,
        });
      }
    });
    return out;
  }, [outline]);

  const [currentStep, setCurrentStep] = useState(() =>
    Math.min(initialCompletedCount, steps.length)
  );
  const [phase, setPhase] = useState<
    "stepping" | "resting" | "finishing" | "done"
  >(initialCompletedCount >= steps.length ? "finishing" : "stepping");
  const [restDuration, setRestDuration] = useState(0);
  const [sessionNotes, setSessionNotes] = useState("");
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = steps[currentStep];
  const completedSets = currentStep;

  async function handleSetComplete(values: SetValues) {
    if (!step) return;
    setIsLogging(true);
    setError(null);

    try {
      await logSet({
        sessionId,
        exerciseName: step.exerciseName,
        kind: step.kind,
        weight: values.weight,
        reps: values.reps,
        durationSeconds: values.durationSeconds,
        rpe: values.rpe,
      });

      const next = currentStep + 1;
      setCurrentStep(next);
      if (next >= steps.length) {
        // Last set logged — straight to the finish panel, no rest.
        setPhase("finishing");
      } else if (step.restSeconds && step.restSeconds > 0) {
        // More work to do and the coach prescribed rest — run a countdown
        // before the next set.
        setRestDuration(step.restSeconds);
        setPhase("resting");
      }
      // else: stay on "stepping"; SetEntry remounts for the next step.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log set");
    } finally {
      setIsLogging(false);
    }
  }

  async function handleFinish() {
    setIsFinishing(true);
    setError(null);

    try {
      const result = await finishWorkout({
        sessionId,
        notes: sessionNotes.trim() || undefined,
      });
      setSummary(result);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish workout");
    } finally {
      setIsFinishing(false);
    }
  }

  // ── Completed summary ──────────────────────────────────────────────────────
  if (phase === "done" && summary) {
    return (
      <div className="flex w-full max-w-xl flex-col gap-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-2xl font-bold tracking-tight">Workout complete 🎉</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SummaryStat label="Sets logged" value={summary.totalSets} />
            <SummaryStat
              label="Duration"
              value={`${summary.durationMinutes} min`}
            />
          </div>

          {summary.exercises.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {summary.exercises.map((exercise) => (
                <span
                  key={exercise}
                  className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  {exercise}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Coach&apos;s note for next time
            </p>
            <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              {summary.memory}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/"
            className="rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Back home
          </Link>
          <Link
            href="/?view=start"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Start another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      {/* Progress + collapsible outline */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {completedSets} / {steps.length} steps done
            </p>
            <p className="text-xs text-zinc-500">
              {outline.exercises.length} exercise
              {outline.exercises.length === 1 ? "" : "s"} this session
            </p>
          </div>
          <button
            onClick={() => setShowOutline((v) => !v)}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          >
            {showOutline ? "Hide plan" : "View plan"}
          </button>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-100"
            style={{
              width: `${steps.length === 0 ? 0 : (completedSets / steps.length) * 100}%`,
            }}
          />
        </div>

        {showOutline && (
          <ol className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {outline.exercises.map((exercise, i) => (
              <li
                key={`${exercise.name}-${i}`}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span
                  className={
                    step && i === step.exerciseIndex
                      ? "font-semibold"
                      : "text-zinc-600 dark:text-zinc-400"
                  }
                >
                  {exercise.name}
                </span>
                <span className="text-right text-zinc-500">
                  {exercise.sets > 1 ? `${exercise.sets} × ` : ""}
                  {formatTarget(exercise)}
                </span>
              </li>
            ))}
          </ol>
        )}

        {outline.sessionNotes && (
          <p className="mt-4 border-t border-zinc-100 pt-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            {outline.sessionNotes}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Rest countdown between sets */}
      {phase === "resting" && step && (
        <RestTimer
          key={`rest-${currentStep}`}
          seconds={restDuration}
          nextStep={step}
          onDone={() => setPhase("stepping")}
        />
      )}

      {/* Current set entry */}
      {phase === "stepping" && step && (
        <SetEntry
          key={currentStep}
          step={step}
          isLogging={isLogging}
          onComplete={handleSetComplete}
          onEndEarly={() => setPhase("finishing")}
        />
      )}

      {/* Finish panel — reached after the last set or via "End early" */}
      {phase === "finishing" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="text-xl font-semibold">
              {completedSets >= steps.length
                ? "All done — nice work!"
                : "Finish workout early?"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {completedSets} step{completedSets === 1 ? "" : "s"} logged. The
              coach will save a short note for next time.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="session-notes" className="text-sm font-medium">
              Session notes (optional)
            </label>
            <textarea
              id="session-notes"
              rows={3}
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="How did it feel? Anything to remember?"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleFinish}
              disabled={isFinishing}
              className="rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFinishing ? "Saving..." : "Finish & save"}
            </button>
            {completedSets < steps.length && (
              <button
                onClick={() => setPhase("stepping")}
                disabled={isFinishing}
                className="rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                Keep going
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-step entry form. Keyed by step index so it remounts with fresh defaults
// (pulled from the exercise's targets) on every step. Inputs adapt to `kind`.
// ─────────────────────────────────────────────────────────────────────────────
function SetEntry({
  step,
  isLogging,
  onComplete,
  onEndEarly,
}: {
  step: SetStep;
  isLogging: boolean;
  onComplete: (values: SetValues) => void;
  onEndEarly: () => void;
}) {
  const [weight, setWeight] = useState(() =>
    parseLeadingNumber(step.targetWeight)
  );
  const [reps, setReps] = useState(() => parseLeadingNumber(step.targetReps));
  const [duration, setDuration] = useState(() =>
    step.targetDurationSeconds != null ? String(step.targetDurationSeconds) : ""
  );
  const [rpe, setRpe] = useState<number>(step.targetRpe ?? 7);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const needsReps = step.kind === "strength" || step.kind === "bodyweight";
  const needsWeight = step.kind === "strength";
  const needsDuration = step.kind === "timed";
  const showRpe = step.kind === "strength" || step.kind === "bodyweight";

  function handleSubmit() {
    const values: SetValues = {};

    if (needsReps) {
      const repsNum = Number(reps);
      if (!Number.isInteger(repsNum) || repsNum < 1) {
        setFieldError("Reps must be a whole number of at least 1.");
        return;
      }
      values.reps = repsNum;
    }

    if (needsWeight && weight.trim()) {
      const weightNum = Number(weight.trim());
      if (Number.isNaN(weightNum) || weightNum < 0) {
        setFieldError("Weight must be a non-negative number (or left blank).");
        return;
      }
      values.weight = weightNum;
    }

    if (needsDuration) {
      const durationNum = Number(duration);
      if (!Number.isInteger(durationNum) || durationNum < 1) {
        setFieldError("Duration must be a whole number of seconds (at least 1).");
        return;
      }
      values.durationSeconds = durationNum;
    }

    if (showRpe) values.rpe = rpe;

    setFieldError(null);
    onComplete(values);
  }

  const primaryLabel = isLogging
    ? "Saving..."
    : step.kind === "mobility"
      ? "Mark done"
      : "Set complete";

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {step.totalSets > 1
              ? `Set ${step.setNumber} of ${step.totalSets}`
              : "Exercise"}
          </p>
          <KindBadge kind={step.kind} />
        </div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">
          {step.exerciseName}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Target:{" "}
          {formatTarget({
            kind: step.kind,
            weight: step.targetWeight,
            reps: step.targetReps,
            durationSeconds: step.targetDurationSeconds,
            rpe: step.targetRpe,
          })}
          {step.restSeconds ? ` · rest ${step.restSeconds}s` : ""}
        </p>
        {step.notes && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {step.notes}
          </p>
        )}
      </div>

      {(needsWeight || needsReps) && (
        <div className="grid grid-cols-2 gap-4">
          {needsWeight && (
            <div className="flex flex-col gap-2">
              <label htmlFor="set-weight" className="text-sm font-medium">
                Weight (kg)
              </label>
              <input
                id="set-weight"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 20"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          )}
          {needsReps && (
            <div className="flex flex-col gap-2">
              <label htmlFor="set-reps" className="text-sm font-medium">
                Reps
              </label>
              <input
                id="set-reps"
                type="number"
                inputMode="numeric"
                min={1}
                step="1"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="e.g. 10"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          )}
        </div>
      )}

      {needsDuration && (
        <div className="flex flex-col gap-2">
          <label htmlFor="set-duration" className="text-sm font-medium">
            Duration (seconds)
          </label>
          <input
            id="set-duration"
            type="number"
            inputMode="numeric"
            min={1}
            step="1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 60"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      )}

      {showRpe && (
        <div className="flex flex-col gap-3">
          <label htmlFor="set-rpe" className="text-sm font-medium">
            RPE: <span className="font-semibold">{rpe}/10</span>
          </label>
          <input
            id="set-rpe"
            type="range"
            min={1}
            max={10}
            value={rpe}
            onChange={(e) => setRpe(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-900 dark:bg-zinc-700"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Easy</span>
            <span>Max effort</span>
          </div>
        </div>
      )}

      {step.kind === "mobility" && (
        <p className="text-sm text-zinc-500">
          No logging needed — mark it done when you&apos;ve finished.
        </p>
      )}

      {fieldError && <p className="text-sm text-red-600">{fieldError}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={isLogging}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {primaryLabel}
        </button>
        <button
          onClick={onEndEarly}
          disabled={isLogging}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          End early
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rest countdown shown between sets. Counts down `seconds`, previews the next
// set, and auto-advances at 0. "Skip timer" jumps straight to the next set.
// ─────────────────────────────────────────────────────────────────────────────
function RestTimer({
  seconds,
  nextStep,
  onDone,
}: {
  seconds: number;
  nextStep: SetStep;
  onDone: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onDone();
      return;
    }
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [remaining, onDone]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const clock = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Rest
        </p>
        <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight">
          {clock}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Up next
        </p>
        <p className="mt-1 text-sm font-semibold">
          {nextStep.exerciseName}
          {nextStep.totalSets > 1
            ? ` · set ${nextStep.setNumber} of ${nextStep.totalSets}`
            : ""}
        </p>
        <p className="mt-0.5 text-sm text-zinc-500">
          {formatTarget({
            kind: nextStep.kind,
            weight: nextStep.targetWeight,
            reps: nextStep.targetReps,
            durationSeconds: nextStep.targetDurationSeconds,
            rpe: nextStep.targetRpe,
          })}
        </p>
      </div>

      <button
        onClick={onDone}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
      >
        Skip timer
      </button>
    </div>
  );
}

function KindBadge({ kind }: { kind: ExerciseKind }) {
  const label =
    kind === "bodyweight"
      ? "Bodyweight"
      : kind === "timed"
        ? "Timed"
        : kind === "mobility"
          ? "Mobility"
          : "Strength";
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      {label}
    </span>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

// Pulls the first number out of a target string ("20kg" → "20", "8-12" → "8",
// "bodyweight" → ""). Used only to pre-fill an input; the user can override.
function parseLeadingNumber(value?: string | null): string {
  if (!value) return "";
  const match = value.match(/\d+(\.\d+)?/);
  return match ? match[0] : "";
}
