import { db } from "@/db/client";
import {
  equipment,
  workoutSessions,
  workoutSets,
} from "@/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import SessionStart from "./(components)/SessionStart";
import EquipmentManager from "./(components)/EquipmentManager";
import ProfileForm from "./(components)/ProfileForm";
import { getUserProfile } from "@/app/api/ai/tools";
import { formatLoggedSet } from "@/lib/workout-format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const USER_ID = 1;

type HomePageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const { view } = await searchParams;

  // Hard gate: no profile yet → onboarding before anything else.
  const profile = await getUserProfile(USER_ID);
  if (!profile?.profileCompletedAt) {
    redirect("/setup");
  }

  const equipmentList = await db.select().from(equipment).orderBy(equipment.name);

  const [equipmentCount] = await db
    .select({ count: count() })
    .from(equipment);

  const totalWorkouts = await db
    .select({ count: count() })
    .from(workoutSessions);

  const latestSession = await db
    .select({
      id: workoutSessions.id,
      startTime: workoutSessions.startTime,
      endTime: workoutSessions.endTime,
    })
    .from(workoutSessions)
    .orderBy(desc(workoutSessions.startTime))
    .limit(1);

  const latestStats = latestSession[0]
    ? await db
      .select({
        setCount: count(workoutSets.id),
        exercises: sql<string>`GROUP_CONCAT(DISTINCT ${workoutSets.exerciseName})`,
      })
      .from(workoutSets)
      .where(eq(workoutSets.sessionId, latestSession[0].id))
    : [{ setCount: 0, exercises: "" }];

  const lastSessionDate = latestSession[0]?.startTime.toLocaleDateString();

  return (
    <main className="flex min-h-full flex-col gap-8 px-6 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">AI Trainer</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Personal, local, privacy-first coaching
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Equipment items" value={equipmentCount?.count ?? 0} />
        <StatCard label="Workouts completed" value={totalWorkouts[0]?.count ?? 0} />
        <StatCard label="Last workout" value={lastSessionDate ?? "—"} />
        {latestSession[0] && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold">Latest workout</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {latestSession[0].endTime ? "Finished" : "In progress"} on{" "}
              {lastSessionDate}
            </p>
            {latestStats[0].exercises && (
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                Exercises: {latestStats[0].exercises}
              </p>
            )}
            {latestStats[0].setCount > 0 && (
              <p className="text-sm text-zinc-500">
                {latestStats[0].setCount} set(s) logged
              </p>
            )}
            {latestSession[0] && !latestSession[0].endTime && (
              <Link
                href={`/workout/${latestSession[0].id}`}
                className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Continue workout
              </Link>
            )}
          </section>
        )}
      </section>



      <section className="flex flex-col md:flex-row" >
        <div className="flex flex-col gap-5 md:w-1/3">
          <Link
            href="/?view=start"
            className="block w-3xs rounded-lg border border-zinc-300 font-large h-15 text-center px-5 py-4"
          >
            Start new workout
          </Link>
          <Link
            href="/?view=upload"
            className="block w-3xs rounded-lg border border-zinc-300 font-large h-15 text-center px-5 py-4"
          >
            Upload equipment
          </Link>
          <Link
            href="/?view=history"
            className="block w-3xs rounded-lg border border-zinc-300 font-large h-15 text-center px-5 py-4"
          >
            Show previous workouts
          </Link>
          <Link
            href="/?view=profile"
            className="block w-3xs rounded-lg border border-zinc-300 font-large h-15 text-center px-5 py-4"
          >
            Profile / settings
          </Link>
        </div>
        <div className="">
          {view === "start" && <SessionStart userId={USER_ID} />}
          {view === "upload" && <EquipmentManager initialEquipment={equipmentList} />}
          {view === "history" && <WorkoutHistory />}
          {view === "profile" && (
            <ProfileForm userId={USER_ID} initial={profile} mode="edit" />
          )}
        </div>
      </section>

      {/* Content column (the thing that opens) */}


    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

async function WorkoutHistory() {
  const sessions = await db
    .select({
      id: workoutSessions.id,
      startTime: workoutSessions.startTime,
      endTime: workoutSessions.endTime,
      notes: workoutSessions.notes,
    })
    .from(workoutSessions)
    .orderBy(desc(workoutSessions.startTime));

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold">Previous workouts</h2>
        <p className="mt-4 text-sm text-zinc-500">
          No workouts yet. Start one to see it here.
        </p>
      </div>
    );
  }

  const sessionsWithStats = await Promise.all(
    sessions.map(async (session) => {
      const sets = await db
        .select({
          exerciseName: workoutSets.exerciseName,
          kind: workoutSets.kind,
          weight: workoutSets.weight,
          reps: workoutSets.reps,
          durationSeconds: workoutSets.durationSeconds,
          rpe: workoutSets.rpe,
          order: workoutSets.order,
        })
        .from(workoutSets)
        .where(eq(workoutSets.sessionId, session.id))
        .orderBy(workoutSets.order);

      const exercises = [...new Set(sets.map((s) => s.exerciseName))];
      const durationMinutes =
        session.startTime && session.endTime
          ? Math.round(
            (session.endTime.getTime() - session.startTime.getTime()) / 60000
          )
          : null;

      return {
        id: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        notes: session.notes,
        setCount: sets.length,
        exercises,
        durationMinutes,
        sets,
      };
    })
  );

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <h2 className="text-xl font-semibold">Previous workouts</h2>
      {sessionsWithStats.map((session) => {
        const isInProgress = !session.endTime;
        return (
          <div
            key={session.id}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {session.startTime.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="text-sm text-zinc-500">
                  {isInProgress ? "In progress" : `Completed`}
                  {session.durationMinutes !== null &&
                    ` • ${session.durationMinutes} min`}
                  {` • ${session.setCount} set(s)`}
                </p>
              </div>
              {isInProgress && (
                <Link
                  href={`/workout/${session.id}`}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Continue
                </Link>
              )}
            </div>

            {session.exercises.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {session.exercises.map((exercise) => (
                  <span
                    key={exercise}
                    className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {exercise}
                  </span>
                ))}
              </div>
            )}

            {session.sets.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                  View set details
                </summary>
                <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {session.sets.map((set) => (
                    <li
                      key={set.order}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {set.order}. {set.exerciseName}
                      </span>
                      <span className="text-zinc-500">{formatLoggedSet(set)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {session.notes && !session.notes.startsWith("{") && (
              <p className="mt-3 border-t border-zinc-100 pt-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                {session.notes}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
