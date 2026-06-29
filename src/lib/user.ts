import { cookies } from "next/headers";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Cookie that pins a visitor to their own demo user. Only consulted when
// DEMO_MODE is enabled; the single-user MVP ignores it entirely.
export const DEMO_USER_COOKIE = "demo_uid";

// Default user for the single-user MVP and for any demo visitor without a
// (valid) cookie — the shared "showcase" profile.
export const DEFAULT_USER_ID = 1;

// Demo mode lets visitors spin up their own isolated profile. Off by default so
// the app behaves exactly like the single-user MVP unless explicitly enabled.
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

// Resolve the user the current request should act as.
// - Not demo mode: always user 1 (today's behavior, no cookie read).
// - Demo mode: the `demo_uid` cookie if it points at a real user, else user 1.
//   Validating against the DB guards against a stale cookie (e.g. after a DB
//   reset) trapping the visitor in a broken setup loop.
export async function getCurrentUserId(): Promise<number> {
  if (!isDemoMode()) return DEFAULT_USER_ID;

  const store = await cookies();
  const raw = store.get(DEMO_USER_COOKIE)?.value;
  if (!raw) return DEFAULT_USER_ID;

  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) return DEFAULT_USER_ID;

  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id));

  return row ? row.id : DEFAULT_USER_ID;
}
