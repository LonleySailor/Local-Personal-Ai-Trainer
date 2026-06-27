"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import CheckInForm, { type CheckInFormData } from "./CheckInForm";
import { generateWorkoutOutline, createWorkoutSession } from "@/app/api/ai/tools";

const sessionMetadataSchema = z.object({
  medicalConditions: z.string().optional(),
  dislikedExercises: z.string().optional(),
  shortTermInjury: z.string().optional(),
});

export type SessionStartProps = {
  userId: number;
};

export default function SessionStart({ userId }: SessionStartProps) {
  const router = useRouter();
  const [medicalConditions, setMedicalConditions] = useState("");
  const [dislikedExercises, setDislikedExercises] = useState("");
  const [shortTermInjury, setShortTermInjury] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCheckInSubmit(formData: CheckInFormData) {
    setIsLoading(true);
    setError(null);

    try {
      const metadata = sessionMetadataSchema.parse({
        medicalConditions,
        dislikedExercises,
        shortTermInjury,
      });

      const outline = await generateWorkoutOutline({
        userId,
        sleepQuality: formData.sleepQuality,
        mood: formData.mood,
        injuryNotes: formData.injuryNotes,
        medicalConditions: splitCommaList(metadata.medicalConditions),
        dislikedExercises: splitCommaList(metadata.dislikedExercises),
        shortTermInjury: metadata.shortTermInjury,
      });

      const session = await createWorkoutSession(userId, outline);

      router.push(`/workout/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-xl font-semibold">Session safety</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="medicalConditions" className="text-sm font-medium">
              Long-term medical conditions
            </label>
            <input
              id="medicalConditions"
              type="text"
              placeholder="e.g. asthma, lower back strain"
              value={medicalConditions}
              onChange={(e) => setMedicalConditions(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="dislikedExercises" className="text-sm font-medium">
              Exercises to avoid this session
            </label>
            <input
              id="dislikedExercises"
              type="text"
              placeholder="e.g. burpees, box jumps"
              value={dislikedExercises}
              onChange={(e) => setDislikedExercises(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="shortTermInjury" className="text-sm font-medium">
              Current injury / short-term issue
            </label>
            <input
              id="shortTermInjury"
              type="text"
              placeholder="e.g. left knee niggle"
              value={shortTermInjury}
              onChange={(e) => setShortTermInjury(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <CheckInForm onSubmit={handleCheckInSubmit} isLoading={isLoading} />
    </div>
  );
}

function splitCommaList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
