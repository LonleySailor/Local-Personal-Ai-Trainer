# Implementation Task List: AI Trainer MVP

## Phase 1: Project Scaffold & Setup

### Task 1.1: Initialize Next.js App
- [x] Run `npx create-next-app@latest ai-trainer --typescript --tailwind --app`
- [x] Verify Next.js app structure is created
- [x] Check `package.json` for default dependencies

### Task 1.2: Install Core Dependencies
- [x] Install Drizzle ORM: `npm install drizzle-orm better-sqlite3`
- [x] Install Vercel AI SDK: `npm install ai @ai-sdk/openai`
- [x] Install utilities: `npm install zod dotenv`
- [x] Verify all dependencies in `package.json`

### Task 1.3: Configure TypeScript & Build
- [x] Review and update `tsconfig.json` for strict mode
- [x] Verify `next.config.ts` exists and is configured
- [x] Create `.env.local` template with `LM_STUDIO_URL=http://localhost:1234/v1`
- [x] Test build: `npm run build`

### Task 1.4: Project Structure Setup
- [x] Create directory structure: `src/db`, `src/lib`, `scripts`, `data`, `app/(components)`, `app/api`
- [x] Create `app/layout.tsx` with Tailwind + global styles
- [x] Create `app/page.tsx` as entry point (home screen)

---

## Phase 2: Database Layer

### Task 2.1: Define Drizzle Schema
- [x] Create `src/db/schema.ts`
- [x] Define table: `users` (id, name, goals, createdAt)
- [x] Define table: `equipment` (id, name, category, weight, createdAt)
- [x] Define table: `recovery_logs` (id, userId, sleepQuality, mood, injuryNotes, timestamp)
- [x] Define table: `workout_sessions` (id, userId, startTime, endTime, notes, createdAt)
- [x] Define table: `workout_sets` (id, sessionId, exerciseName, weight, reps, rpe, order, completedAt)
- [x] Define table: `ai_memories` (id, userId, memory, createdAt)

### Task 2.2: Create Database Client
- [x] Create `src/db/client.ts`
- [x] Export singleton DB client instance using `better-sqlite3`
- [x] Export Drizzle ORM instance wrapping the SQLite client
- [x] Test client initialization and schema creation

### Task 2.3: Create Seed Script
- [x] Create `scripts/seed.ts`
- [x] Implement CSV parser for exercises (columns: name, category, equipment)
- [x] Implement seed function to populate `users` table with default user
- [x] Implement seed function to populate `equipment` table from CSV or hardcoded data
- [x] Export CLI command: `npm run seed`

### Task 2.4: Test Database Setup
- [x] Run seed script and verify DB file is created at `data/ai-trainer.db`
- [x] Manually inspect DB with SQLite CLI or tool to confirm tables and data
- [x] Verify schema matches Drizzle definitions

---

## Phase 3: LLM Integration

### Task 3.1: Configure LM-Studio Provider
- [x] Create `lib/llm.ts`
- [x] Import Vercel AI SDK components (`generateText`, `streamText`, `tool`)
- [x] Create custom provider for LM-Studio using `LM_STUDIO_URL` env var
- [x] Export initialized LLM client instance

### Task 3.2: Create Test API Route
- [x] Create `app/api/test/route.ts`
- [x] Implement simple GET endpoint that calls LM-Studio with a test prompt
- [x] Return model response as JSON
- [x] Test locally: curl or fetch against `/api/test`

### Task 3.3: Verify LM-Studio Connectivity
- [x] Start LM-Studio locally on `localhost:1234`
- [x] Load a small GGUF model (e.g., Mistral 7B)
- [x] Run Next dev server: `npm run dev`
- [x] Call test endpoint and verify response

---

## Phase 4: Server-Action Tools & API

### Task 4.1: Implement Tool: `getAvailableEquipment`
- [x] Create function in `app/api/ai/tools.ts`
- [x] Query `equipment` table via Drizzle
- [x] Return formatted list of available equipment
- [x] Export as server action or API endpoint

### Task 4.2: Implement Tool: `buildSystemPrompt`
- [x] Create function in `app/api/ai/tools.ts`
- [x] Accept userId, recovery data, and equipment list as params
- [x] Build compact system prompt for the LLM:
  - Include user profile summary
  - List available equipment
  - Include recent recovery log (sleep, mood, injury flags)
  - Include last 3 ai_memories
- [x] Return formatted system prompt string

### Task 4.3: Implement Tool: `generate_workout_outline`
- [x] Create function in `app/api/ai/tools.ts`
- [x] Accept userId and check-in data (sleep quality, mood, injury notes)
- [x] Call LLM with system prompt + user check-in to generate workout outline
- [x] Return structured outline (exercises, sets, reps, weights)
- [x] Store outline in temporary session state or return to client

### Task 4.4: Implement Tool: `log_set`
- [x] Create function in `app/api/ai/tools.ts`
- [x] Accept sessionId, exerciseName, weight, reps, rpe
- [x] Insert into `workout_sets` table via Drizzle
- [x] Return confirmation with set order/number
- [x] Export as server action for client-side calls

### Task 4.5: Implement Tool: `finish_workout`
- [x] Create function in `app/api/ai/tools.ts`
- [x] Accept sessionId and optional user notes
- [x] Query `workout_sets` for the session to build workout summary
- [x] Call LLM to generate ai_memory based on session data
- [x] Insert memory into `ai_memories` table
- [x] Update `workout_sessions` endTime and mark complete
- [x] Return session summary

---

## Phase 5: Core UI & Check-in

### Task 5.1: Build Check-in Form Component
- [x] Create `app/(components)/CheckInForm.tsx`
- [x] Add input fields:
  - Sleep quality (1–10 slider)
  - Mood/energy (1–10 slider)
  - Injury flags/notes (text area)
- [x] Add form validation (Zod)
- [x] Add submit button that triggers workout session start
- [x] Style with Tailwind CSS

### Task 5.2: Build Exercise Upload Component
- [x] Create `app/(components)/ExerciseUpload.tsx`
- [x] Implement CSV file picker
- [x] Parse CSV (columns: name, category, equipment)
- [x] Call seed/import API endpoint to populate `equipment` table
- [x] Show success/error feedback
- [x] Style with Tailwind CSS

### Task 5.3: Build Session Start Page
- [x] Create `app/(components)/SessionStart.tsx`
- [x] Display pre-session options:
  - Medical conditions / disliked exercises (text input, one-time per session)
  - Check-in form
  - Start workout button
- [x] On start, create new `workout_sessions` record
- [x] Pass session ID to workout stepper

### Task 5.4: Build Home UI
- [x] Update `app/page.tsx`
- [x] Display:
  - Last workout summary (if any)
  - Quick stats (total workouts, last session date)
  - Button to start new workout
  - Button to upload exercises
- [x] Add links to settings/history (placeholder for now)

### Task 5.5: Build Equipment Manager UI
- [x] Create `app/(components)/EquipmentManager.tsx`
- [x] Display current equipment list with category + weight
- [x] Add delete button for each equipment item
- [x] Add single-item form (name, category, weight) to create new equipment
- [x] Show clear CSV example/template in upload area
- [x] Wire component into `/?view=upload` page
- [x] Style with Tailwind CSS

---

## Phase 6: Guided Workout Flow

> Re-planned after manual testing: exercises now carry a `kind` so warm-ups and
> timed work aren't forced into weight/reps fields, and the AI prescribes
> concrete loads from auto-derived training history. See
> `plan-localPersonalAiTrainer.md` and the plan note for full context.

### Task 6.1: Exercise kinds in the data model
- [x] Add `kind` ("strength" | "bodyweight" | "timed" | "mobility"),
  `durationSeconds`, and make `reps` nullable on `workout_sets` (`src/db/schema.ts`)
- [x] Update `CREATE TABLE workout_sets` for fresh installs (`scripts/seed.ts`)
- [x] Add idempotent, data-preserving migration `scripts/migrate.ts` +
  `npm run migrate` (rebuilds `workout_sets`, guarded on the `kind` column)

### Task 6.2: AI load prescription from history
- [x] Add `getExerciseHistory(userId)` — recent bests + estimated 1RM (Epley)
  from completed sessions (`src/app/api/ai/tools.ts`)
- [x] Add a "Recent performance" section to `buildSystemPrompt`
- [x] Update `generateWorkoutOutline` prompt: classify each exercise with a
  `kind`, prescribe concrete strength loads, use `durationSeconds` for timed,
  leave mobility unloaded
- [x] Extend `outlineExerciseSchema` with `kind`/`durationSeconds`, optional
  reps/weight/rpe

### Task 6.3: Adaptive Workout Stepper
- [x] Create `app/(components)/WorkoutStepper.tsx`
- [x] Display: collapsible plan, progress indicator, per-kind target line,
  kind badge
- [x] Render inputs per kind: strength (weight+reps+RPE), bodyweight (reps+RPE),
  timed (duration), mobility ("Mark done", no numbers)
- [x] Kind-aware validation; on complete, call `log_set` with the right fields
- [x] Shared `src/lib/workout-format.ts` for target/logged-set formatting

### Task 6.4: Workout Session Page
- [x] Create `app/workout/[sessionId]/page.tsx`
- [x] Load session + outline (from session notes JSON) and logged sets
- [x] Resume in-progress sessions; render kind-aware completed recap
- [x] "End Workout Early" button; "Workout Complete" summary on finish

### Task 6.5: Finish Workout Flow
- [x] On last step or "End early", call `finish_workout`
- [x] `finish_workout` summarises sets per kind for the AI memory
- [x] Final summary: total sets, duration, AI memory note; return home / restart
- [x] Update recap (`workout/[sessionId]`) and history (`page.tsx`) to render
  per kind (reps vs duration vs "done")

---

## Phase 7: User Profile & Setup Gate

> Re-planned after manual testing: long-term facts (medical conditions, disliked
> exercises, goals, body weight, height, strength benchmarks) were being re-typed
> every session. They now live on a persistent **user profile** captured once via
> a hard onboarding gate, and are reused for every workout. See the plan note for
> full context.

### Task 7.1: Extend the data model with profile fields
- [x] Add `heightCm`, `bodyWeightKg`, `medicalConditions`, `dislikedExercises`,
  `strengthBenchmarks`, `profileCompletedAt` to `users` (`src/db/schema.ts`)
- [x] Mirror columns in the `CREATE TABLE users` raw SQL (`scripts/seed.ts`)
- [x] Add idempotent, column-guarded `ALTER TABLE users ADD COLUMN …` block to
  `scripts/migrate.ts` (nullable additions — no table rebuild)

### Task 7.2: Profile server actions
- [x] `getUserProfile(userId)` — returns profile fields + `profileCompletedAt`
- [x] `saveUserProfile(userId, …)` — Zod-validated; sets `profileCompletedAt`
  (`src/app/api/ai/tools.ts`)

### Task 7.3: Profile UI
- [x] `ProfileForm.tsx` — name, goals, body weight, height, strength benchmarks
  (free text), medical conditions, disliked exercises; `mode` "setup" | "edit"
- [x] `src/app/setup/page.tsx` — standalone onboarding route

### Task 7.4: Hard gate + edit path
- [x] Redirect `/` → `/setup` when `profileCompletedAt` is null (`page.tsx`)
- [x] `?view=profile` branch renders `ProfileForm` in edit mode + nav link

---

## Phase 8: Time-Budgeted, Profile-Driven Generation

> The session form no longer collects long-term safety fields (now from profile),
> and the user states how much time they have **today** so the AI can size the
> workout. The old "Safety Rules" enforcement is folded in here: profile medical
> conditions + disliked exercises are always present in the system prompt.

### Task 8.1: Source safety/profile data from the profile
- [x] Drop `medicalConditions` / `dislikedExercises` params from
  `buildSystemPrompt` / `generateWorkoutOutline`; read them from the user row
- [x] Add profile fields (body weight, height, strength benchmarks) to the
  "User profile" section of the system prompt
- [x] Remove the medical/disliked inputs from `SessionStart` (keep short-term
  injury); update the test route (`api/test/tools`)

### Task 8.2: Per-session time budget
- [x] Add "Time available today (minutes)" input to `SessionStart`
- [x] Thread `timeAvailableMinutes` through `generateWorkoutOutline` →
  `buildSystemPrompt`
- [x] Add `timeBudgetMinutes` column to `workout_sessions` (schema + seed +
  migrate) and persist it via `createWorkoutSession`

### Task 8.3: Prompt fits the budget and prescribes rest
- [x] "Time budget" prompt section instructs the model to size exercises/sets to
  fit, counting rest
- [x] Strengthen `restSeconds` schema description + instruction so strength/
  bodyweight exercises always carry a realistic rest value

---

## Phase 9: Rest Timer in the Stepper

> `restSeconds` was carried in the outline but only shown as static text. The
> stepper now runs an actual rest countdown between sets.

### Task 9.1: Rest countdown phase
- [x] Add a `"resting"` phase to `WorkoutStepper`'s state machine
- [x] After logging a set, if a next set exists and `restSeconds > 0`, enter
  `"resting"` instead of going straight to the next entry
- [x] `RestTimer` component: MM:SS countdown + next-set preview (`formatTarget`)

### Task 9.2: Auto-advance and skip
- [x] Auto-advance to the next set at 0:00; "Skip timer" jumps immediately
- [x] No rest screen after the final set (goes straight to the finish panel)

---

## Phase 10: Acceptance & Manual Testing

> Requires LM-Studio running with a model loaded.

### Task 10.1: Write Manual Test Plan
- [ ] Document test scenario:
  1. Fresh DB → loading `/` redirects to `/setup`; complete the profile
  2. Start app, upload exercises (CSV) if needed
  3. Click "Start Workout"
  4. Enter **time available today** + any short-term injury
  5. Fill in check-in (sleep, mood, injury notes)
  6. Trigger workout generation; verify the outline fits the time budget and
     carries `restSeconds`
  7. Complete 2–3 sets manually (enter weight, reps, RPE)
  8. Verify the **rest countdown** appears between sets and "Skip timer" works
  9. Verify `workout_sets` entries in DB
  10. End workout; verify `ai_memories` entry created
  11. Edit the profile via `?view=profile`; confirm changes reach the next prompt
  12. Verify offline operation (no cloud API calls)

### Task 10.2: Run Manual Test Scenario
- [ ] Start LM-Studio locally with a model loaded
- [ ] Run `npm run migrate` (existing DBs) then `npm run dev`
- [ ] Execute test scenario
- [ ] Verify DB state at each step
- [ ] Document any issues or unexpected behavior

### Task 10.3: Validate Data Persistence
- [ ] Restart app without losing data
- [ ] Verify profile + workout history persist
- [ ] Verify equipment list persists across sessions
- [ ] Verify ai_memories are available for next session

---

## Phase 11: Documentation & Environment

### Task 11.1: Create README
- [ ] Document project overview and tech stack
- [ ] Add LM-Studio setup instructions:
  - Download and install LM-Studio
  - Load a GGUF model (recommend Mistral 7B for 8GB VRAM)
  - Start server on `localhost:1234`
- [ ] Document the first-run `/setup` profile flow
- [ ] Note that existing databases must run `npm run migrate` after pulling the
  profile/time-budget schema changes
- [ ] Add `.env.local` template and variable descriptions
- [ ] Add quick start commands:
  ```bash
  npm install
  npm run seed
  npm run dev
  ```

### Task 11.2: Create .env.local Template
- [ ] Create `.env.local.example`
- [ ] Define variables:
  - `LM_STUDIO_URL=http://localhost:1234/v1`
  - `DATABASE_PATH=./data/ai-trainer.db`
- [ ] Add comments explaining each variable

### Task 11.3: Add Scripts to package.json
- [ ] Add `seed` script pointing to `scripts/seed.ts`
- [ ] Add `migrate` script pointing to `scripts/migrate.ts`
- [ ] Add `dev` script for Next.js dev server
- [ ] Add `build` and `start` scripts
- [ ] Optional: add `lint` and `test` scripts for future use

---

## Phase 12: Final Integration & Polish

### Task 12.1: End-to-End Test
- [ ] Run full scenario: setup profile → start (time budget) → check-in →
  generate → log sets (with rest timer) → finish
- [ ] Verify all data flows correctly through API
- [ ] Check for any console errors or warnings
- [ ] Verify UI is responsive and user-friendly

### Task 12.2: Offline Verification
- [ ] Disconnect from network (or block external requests)
- [ ] Verify app still works with LM-Studio locally
- [ ] Confirm no external API calls are made (check network tab)

### Task 12.3: Prepare for Review
- [ ] Clean up temporary code or logs
- [ ] Add comments to complex functions
- [ ] Verify `.gitignore` excludes `data/`, `node_modules/`, `.env.local`
- [ ] Create a quick demo walkthrough document (optional)

---

## Summary of Deliverables

By end of Phase 10, the following will be complete:

1. ✅ Fully functional Next.js + TypeScript app
2. ✅ SQLite database with Drizzle ORM schema and client
3. ✅ LM-Studio integration via Vercel AI SDK
4. ✅ Server-action tools for workout generation, set logging, and session completion
5. ✅ UI for check-in, exercise upload, and guided workout flow
6. ✅ Safety rules enforcing (medical conditions, disliked exercises)
7. ✅ Manual acceptance tests passing
8. ✅ README and environment setup documentation
9. ✅ Offline-only MVP ready for local use on 8GB VRAM machine

---

## Notes for Implementation

- **Context Optimization**: All prompts are built from DB state, not chat history. This keeps token usage low.
- **VRAM Efficiency**: Use small models (7B–13B) on 8GB VRAM. Drizzle + SQLite runs on CPU, no GPU overhead.
- **Safety First**: Validate user input (medical conditions, disliked exercises) before sending to LLM.
- **Future Extensions**: Cloud LLM toggle, PWA, voice input, multi-user accounts are out of scope for MVP but documented in plan-localPersonalAiTrainer.md.
