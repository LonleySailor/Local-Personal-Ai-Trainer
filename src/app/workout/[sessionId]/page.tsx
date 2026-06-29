import { db } from "@/db/client";
import { workoutSessions, workoutSets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import WorkoutStepper from "@/app/(components)/WorkoutStepper";
import type { WorkoutOutline } from "@/app/api/ai/tools";
import { formatLoggedSet } from "@/lib/workout-format";

export const dynamic = "force-dynamic";

type WorkoutPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function WorkoutPage({ params }: WorkoutPageProps) {
  const { sessionId: sessionIdParam } = await params;
  const sessionId = Number(sessionIdParam);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    notFound();
  }

  const [session] = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId));

  if (!session) {
    notFound();
  }

  const sets = await db
    .select()
    .from(workoutSets)
    .where(eq(workoutSets.sessionId, sessionId))
    .orderBy(workoutSets.order);

  // The generated outline is stashed as JSON in the session's notes column when
  // the session is created. Once the session is finished, notes may be replaced
  // by the user's free-text note, so parsing is best-effort.
  let outline: WorkoutOutline | null = null;
  if (session.notes && session.notes.startsWith("{")) {
    try {
      outline = JSON.parse(session.notes) as WorkoutOutline;
    } catch {
      outline = null;
    }
  }

  // Already finished → static recap of what was logged.
  if (session.endTime) {
    return (
      <CompletedRecap
        startTime={session.startTime}
        endTime={session.endTime}
        sets={sets}
      />
    );
  }

  if (!outline || outline.exercises.length === 0) {
    return (
      <main className="flex min-h-full flex-col gap-6 px-6 py-12">
        <Header />
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">No workout plan found</h2>
          <p className="mt-2 text-sm text-zinc-500">
            This session doesn&apos;t have a generated outline. Start a new
            workout to get a fresh plan.
          </p>
          <Link
            href="/?view=start"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Start new workout
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-col gap-8 px-6 py-12">
      <Header />
      <WorkoutStepper
        sessionId={sessionId}
        outline={outline}
        initialCompletedCount={sets.length}
      />
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workout</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Log each set as you go
        </p>
      </div>
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
      >
        ← Home
      </Link>
    </header>
  );
}

function CompletedRecap({
  startTime,
  endTime,
  sets,
}: {
  startTime: Date;
  endTime: Date;
  sets: (typeof workoutSets.$inferSelect)[];
}) {
  const durationMinutes = Math.round(
    (endTime.getTime() - startTime.getTime()) / 60000
  );
  const exercises = [...new Set(sets.map((s) => s.exerciseName))];

  return (
    <main className="flex min-h-full flex-col gap-8 px-6 py-12">
      <Header />
      <div className="flex w-full max-w-xl flex-col gap-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xl font-semibold">This workout is complete</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {startTime.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}{" "}
            · {durationMinutes} min · {sets.length} set
            {sets.length === 1 ? "" : "s"}
          </p>

          {exercises.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {exercises.map((exercise) => (
                <span
                  key={exercise}
                  className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  {exercise}
                </span>
              ))}
            </div>
          )}

          {sets.length > 0 && (
            <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
              {sets.map((set) => (
                <li
                  key={set.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {set.order}. {set.exerciseName}
                  </span>
                  <span className="text-zinc-500">{formatLoggedSet(set)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link
          href="/"
          className="inline-block w-fit rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
