import { redirect } from "next/navigation";
import { getUserProfile } from "@/app/api/ai/tools";
import ProfileForm from "../(components)/ProfileForm";

export const dynamic = "force-dynamic";

const USER_ID = 1;

export default async function SetupPage() {
  const profile = await getUserProfile(USER_ID);

  // Already set up → no reason to be on the gate; send them home.
  if (profile?.profileCompletedAt) {
    redirect("/");
  }

  return (
    <main className="flex min-h-full flex-col items-center gap-8 px-6 py-12">
      <header className="w-full max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to AI Trainer</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Tell the coach about yourself before your first workout.
        </p>
      </header>

      <ProfileForm userId={USER_ID} initial={profile} mode="setup" />
    </main>
  );
}
