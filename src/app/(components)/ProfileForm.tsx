"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveUserProfile, type UserProfile } from "@/app/api/ai/tools";

export type ProfileFormProps = {
  userId: number;
  initial: UserProfile | null;
  // "setup" gates first-run and redirects home on save; "edit" stays put and
  // shows a saved confirmation.
  mode: "setup" | "edit";
};

export default function ProfileForm({ userId, initial, mode }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [goals, setGoals] = useState(initial?.goals ?? "");
  const [bodyWeightKg, setBodyWeightKg] = useState(
    initial?.bodyWeightKg != null ? String(initial.bodyWeightKg) : ""
  );
  const [heightCm, setHeightCm] = useState(
    initial?.heightCm != null ? String(initial.heightCm) : ""
  );
  const [medicalConditions, setMedicalConditions] = useState(
    initial?.medicalConditions ?? ""
  );
  const [dislikedExercises, setDislikedExercises] = useState(
    initial?.dislikedExercises ?? ""
  );
  const [strengthBenchmarks, setStrengthBenchmarks] = useState(
    initial?.strengthBenchmarks ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaved(false);

    try {
      const weightNum = bodyWeightKg.trim() ? Number(bodyWeightKg) : undefined;
      const heightNum = heightCm.trim() ? Number(heightCm) : undefined;

      if (weightNum != null && (Number.isNaN(weightNum) || weightNum <= 0)) {
        throw new Error("Body weight must be a positive number.");
      }
      if (heightNum != null && (Number.isNaN(heightNum) || heightNum <= 0)) {
        throw new Error("Height must be a positive number.");
      }

      await saveUserProfile(userId, {
        name,
        goals,
        bodyWeightKg: weightNum,
        heightCm: heightNum,
        medicalConditions,
        dislikedExercises,
        strengthBenchmarks,
      });

      if (mode === "setup") {
        // Full navigation so the server-side gate re-reads the freshly saved
        // profile. A client router.push("/") + router.refresh() can race —
        // refresh re-renders the current /setup route and cancels the pending
        // push, leaving the user stuck on the setup screen.
        window.location.assign("/");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-xl font-semibold">
          {mode === "setup" ? "Set up your profile" : "Your profile"}
        </h2>
        <p className="mb-5 text-sm text-zinc-500">
          These details are saved once and reused for every workout, so the coach
          can plan safely without you re-typing them each session.
        </p>

        <div className="flex flex-col gap-4">
          <Field label="Name" htmlFor="name">
            <input
              id="name"
              type="text"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Fitness goals" htmlFor="goals">
            <textarea
              id="goals"
              rows={2}
              placeholder="e.g. build strength, lose fat, run a 10k"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Body weight (kg)" htmlFor="bodyWeightKg">
              <input
                id="bodyWeightKg"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="e.g. 80"
                value={bodyWeightKg}
                onChange={(e) => setBodyWeightKg(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Height (cm)" htmlFor="heightCm">
              <input
                id="heightCm"
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                placeholder="e.g. 180"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label="Current strength level"
            htmlFor="strengthBenchmarks"
            hint="Free-text benchmarks — helps the coach prescribe realistic loads."
          >
            <textarea
              id="strengthBenchmarks"
              rows={2}
              placeholder="e.g. 100kg deadlift, 10 pullups, 60kg bench"
              value={strengthBenchmarks}
              onChange={(e) => setStrengthBenchmarks(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label="Long-term medical conditions"
            htmlFor="medicalConditions"
            hint="Always honored — you won't be asked again each session."
          >
            <textarea
              id="medicalConditions"
              rows={2}
              placeholder="e.g. asthma, chronic lower back issues"
              value={medicalConditions}
              onChange={(e) => setMedicalConditions(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Exercises to always avoid" htmlFor="dislikedExercises">
            <textarea
              id="dislikedExercises"
              rows={2}
              placeholder="e.g. burpees, box jumps"
              value={dislikedExercises}
              onChange={(e) => setDislikedExercises(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Profile saved.
        </div>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="self-start rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving
          ? "Saving..."
          : mode === "setup"
            ? "Save & continue"
            : "Save changes"}
      </button>
    </form>
  );
}

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
