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
- [ ] Create function in `app/api/ai/tools.ts`
- [ ] Query `equipment` table via Drizzle
- [ ] Return formatted list of available equipment
- [ ] Export as server action or API endpoint

### Task 4.2: Implement Tool: `buildSystemPrompt`
- [ ] Create function in `app/api/ai/tools.ts`
- [ ] Accept userId, recovery data, and equipment list as params
- [ ] Build compact system prompt for the LLM:
  - Include user profile summary
  - List available equipment
  - Include recent recovery log (sleep, mood, injury flags)
  - Include last 3 ai_memories
- [ ] Return formatted system prompt string

### Task 4.3: Implement Tool: `generate_workout_outline`
- [ ] Create function in `app/api/ai/tools.ts`
- [ ] Accept userId and check-in data (sleep quality, mood, injury notes)
- [ ] Call LLM with system prompt + user check-in to generate workout outline
- [ ] Return structured outline (exercises, sets, reps, weights)
- [ ] Store outline in temporary session state or return to client

### Task 4.4: Implement Tool: `log_set`
- [ ] Create function in `app/api/ai/tools.ts`
- [ ] Accept sessionId, exerciseName, weight, reps, rpe
- [ ] Insert into `workout_sets` table via Drizzle
- [ ] Return confirmation with set order/number
- [ ] Export as server action for client-side calls

### Task 4.5: Implement Tool: `finish_workout`
- [ ] Create function in `app/api/ai/tools.ts`
- [ ] Accept sessionId and optional user notes
- [ ] Query `workout_sets` for the session to build workout summary
- [ ] Call LLM to generate ai_memory based on session data
- [ ] Insert memory into `ai_memories` table
- [ ] Update `workout_sessions` endTime and mark complete
- [ ] Return session summary

---

## Phase 5: Core UI & Check-in

### Task 5.1: Build Check-in Form Component
- [ ] Create `app/(components)/CheckInForm.tsx`
- [ ] Add input fields:
  - Sleep quality (1–10 slider)
  - Mood/energy (1–10 slider)
  - Injury flags/notes (text area)
- [ ] Add form validation (Zod)
- [ ] Add submit button that triggers workout session start
- [ ] Style with Tailwind CSS

### Task 5.2: Build Exercise Upload Component
- [ ] Create `app/(components)/ExerciseUpload.tsx`
- [ ] Implement CSV file picker
- [ ] Parse CSV (columns: name, category, equipment)
- [ ] Call seed/import API endpoint to populate `equipment` table
- [ ] Show success/error feedback
- [ ] Style with Tailwind CSS

### Task 5.3: Build Session Start Page
- [ ] Create `app/(components)/SessionStart.tsx`
- [ ] Display pre-session options:
  - Medical conditions / disliked exercises (text input, one-time per session)
  - Check-in form
  - Start workout button
- [ ] On start, create new `workout_sessions` record
- [ ] Pass session ID to workout stepper

### Task 5.4: Build Home UI
- [ ] Update `app/page.tsx`
- [ ] Display:
  - Last workout summary (if any)
  - Quick stats (total workouts, last session date)
  - Button to start new workout
  - Button to upload exercises
- [ ] Add links to settings/history (placeholder for now)

---

## Phase 6: Guided Workout Flow

### Task 6.1: Build Workout Stepper Component
- [ ] Create `app/(components)/WorkoutStepper.tsx`
- [ ] Display:
  - Full workout outline at the top (collapsed/expandable)
  - Current exercise name, target weight/reps
  - Input fields for actual weight, reps, RPE (1–10)
  - "Set complete" button
  - Progress indicator (e.g., 3/10 sets done)
- [ ] On "Set complete", call `log_set` server action
- [ ] Move to next exercise; repeat

### Task 6.2: Build Workout Session Page
- [ ] Create `app/workout/[sessionId]/page.tsx`
- [ ] Load session from DB
- [ ] Display `SessionStart` if session not yet started
- [ ] Display `WorkoutStepper` once started
- [ ] Add "End Workout Early" button
- [ ] Show "Workout Complete" summary screen on finish

### Task 6.3: Implement Finish Workout Flow
- [ ] On last set completion or "End Workout" click, call `finish_workout`
- [ ] Display final summary:
  - Total sets/exercises completed
  - Session duration
  - AI-generated memory note
- [ ] Add button to return home or start another session

---

## Phase 7: Session State & Safety

### Task 7.1: Store Disliked Exercises & Medical Conditions
- [ ] Extend `SessionStart` to accept:
  - Disliked exercises (comma-separated text)
  - Long-term medical conditions (text)
  - Short-term health issues (text)
- [ ] Store in session state or temp DB table (session_metadata)
- [ ] Pass to LLM system prompt to enforce safety rules

### Task 7.2: Enforce Safety Rules in Tool
- [ ] Update `generate_workout_outline` to check disliked exercises & medical flags
- [ ] Implement logic to exclude banned exercises from outline
- [ ] Enforce RPE caps if needed (e.g., skip if injury noted)
- [ ] Return validation errors if outline violates rules

---

## Phase 8: Acceptance & Manual Testing

### Task 8.1: Write Manual Test Plan
- [ ] Document test scenario:
  1. Start app, upload exercises (CSV) if needed
  2. Click "Start Workout"
  3. Fill in session metadata (medical conditions, disliked exercises)
  4. Fill in check-in (sleep, mood, injury notes)
  5. Trigger workout generation
  6. Verify outline appears in LLM response
  7. Complete 2–3 sets manually (enter weight, reps, RPE)
  8. Verify `workout_sets` entries in DB
  9. End workout
  10. Verify `ai_memories` entry created
  11. Verify offline operation (no cloud API calls)

### Task 8.2: Run Manual Test Scenario
- [ ] Start LM-Studio locally with a model loaded
- [ ] Run `npm run dev`
- [ ] Execute test scenario
- [ ] Verify DB state at each step
- [ ] Document any issues or unexpected behavior

### Task 8.3: Validate Data Persistence
- [ ] Restart app without losing data
- [ ] Verify workout history remains in `workout_sessions`
- [ ] Verify equipment list persists across sessions
- [ ] Verify ai_memories are available for next session

---

## Phase 9: Documentation & Environment

### Task 9.1: Create README
- [ ] Document project overview and tech stack
- [ ] Add LM-Studio setup instructions:
  - Download and install LM-Studio
  - Load a GGUF model (recommend Mistral 7B for 8GB VRAM)
  - Start server on `localhost:1234`
- [ ] Add `.env.local` template and variable descriptions
- [ ] Add quick start commands:
  ```bash
  npm install
  npm run seed
  npm run dev
  ```

### Task 9.2: Create .env.local Template
- [ ] Create `.env.local.example`
- [ ] Define variables:
  - `LM_STUDIO_URL=http://localhost:1234/v1`
  - `DATABASE_PATH=./data/ai-trainer.db`
- [ ] Add comments explaining each variable

### Task 9.3: Add Scripts to package.json
- [ ] Add `seed` script pointing to `scripts/seed.ts`
- [ ] Add `dev` script for Next.js dev server
- [ ] Add `build` and `start` scripts
- [ ] Optional: add `lint` and `test` scripts for future use

---

## Phase 10: Final Integration & Polish

### Task 10.1: End-to-End Test
- [ ] Run full scenario: upload → check-in → generate → log sets → finish
- [ ] Verify all data flows correctly through API
- [ ] Check for any console errors or warnings
- [ ] Verify UI is responsive and user-friendly

### Task 10.2: Offline Verification
- [ ] Disconnect from network (or block external requests)
- [ ] Verify app still works with LM-Studio locally
- [ ] Confirm no external API calls are made (check network tab)

### Task 10.3: Prepare for Review
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
