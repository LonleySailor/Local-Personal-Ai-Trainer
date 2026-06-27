"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const checkInSchema = z.object({
  sleepQuality: z.number().min(1).max(10),
  mood: z.number().min(1).max(10),
  injuryNotes: z.string().optional(),
});

export type CheckInFormData = z.infer<typeof checkInSchema>;

export type CheckInFormProps = {
  onSubmit: (data: CheckInFormData) => void;
  isLoading?: boolean;
};

export default function CheckInForm({ onSubmit, isLoading }: CheckInFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CheckInFormData>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      sleepQuality: 7,
      mood: 7,
      injuryNotes: "",
    },
  });

  const sleepQuality = useWatch({ control, name: "sleepQuality" });
  const mood = useWatch({ control, name: "mood" });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-xl font-semibold">Pre-workout check-in</h2>

      <div className="flex flex-col gap-3">
        <label htmlFor="sleepQuality" className="text-sm font-medium">
          Sleep quality: <span className="font-semibold">{sleepQuality}/10</span>
        </label>
        <input
          id="sleepQuality"
          type="range"
          min={1}
          max={10}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-900 dark:bg-zinc-700"
          {...register("sleepQuality", { valueAsNumber: true })}
        />
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Terrible</span>
          <span>Excellent</span>
        </div>
        {errors.sleepQuality && (
          <p className="text-sm text-red-600">{errors.sleepQuality.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="mood" className="text-sm font-medium">
          Mood / energy: <span className="font-semibold">{mood}/10</span>
        </label>
        <input
          id="mood"
          type="range"
          min={1}
          max={10}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-900 dark:bg-zinc-700"
          {...register("mood", { valueAsNumber: true })}
        />
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Low</span>
          <span>High</span>
        </div>
        {errors.mood && (
          <p className="text-sm text-red-600">{errors.mood.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="injuryNotes" className="text-sm font-medium">
          Injury flags / notes
        </label>
        <textarea
          id="injuryNotes"
          rows={3}
          placeholder="Anything hurting today? New aches or restrictions?"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          {...register("injuryNotes")}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Generating workout..." : "Generate workout"}
      </button>
    </form>
  );
}
