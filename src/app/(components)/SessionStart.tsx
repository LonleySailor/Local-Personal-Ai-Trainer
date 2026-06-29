"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import CheckInForm, { type CheckInFormData } from "./CheckInForm";
import { generateWorkoutOutline, createWorkoutSession } from "@/app/api/ai/tools";

const sessionMetadataSchema = z.object({
  shortTermInjury: z.string().optional(),
  timeAvailableMinutes: z
    .number()
    .int()
    .min(5, "Give yourself at least 5 minutes")
    .max(300, "That's a very long session — keep it under 300 minutes"),
});

export type SessionStartProps = {
  userId: number;
};

export default function SessionStart({ userId }: SessionStartProps) {
  const router = useRouter();
  const [shortTermInjury, setShortTermInjury] = useState("");
  const [timeAvailable, setTimeAvailable] = useState("45");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCheckInSubmit(formData: CheckInFormData) {
    setIsLoading(true);
    setError(null);

    try {
      const metadata = sessionMetadataSchema.parse({
        shortTermInjury,
        timeAvailableMinutes: Number(timeAvailable),
      });

      const outline = await generateWorkoutOutline({
        userId,
        sleepQuality: formData.sleepQuality,
        mood: formData.mood,
        injuryNotes: formData.injuryNotes,
        shortTermInjury: metadata.shortTermInjury || undefined,
        timeAvailableMinutes: metadata.timeAvailableMinutes,
      });

      const session = await createWorkoutSession(
        userId,
        outline,
        metadata.timeAvailableMinutes
      );

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
        <h2 className="mb-1 text-xl font-semibold">Today&apos;s session</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Your goals, medical conditions, and disliked exercises come from your{" "}
          <Link href="/?view=profile" className="underline">
            profile
          </Link>
          . Just tell the coach about today.
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="timeAvailable" className="text-sm font-medium">
              Time available today (minutes)
            </label>
            <input
              id="timeAvailable"
              type="number"
              inputMode="numeric"
              min={5}
              max={300}
              step="5"
              value={timeAvailable}
              onChange={(e) => setTimeAvailable(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p className="text-xs text-zinc-500">
              The coach sizes the workout (and rest periods) to fit this window.
            </p>
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
