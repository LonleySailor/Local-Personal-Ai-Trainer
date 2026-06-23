# Plan: AI Trainer MVP Implementation

TL;DR: Build a local-first Next.js TypeScript app that uses LM‑Studio for inference, SQLite + Drizzle for persistence, and a small set of server-action tools (generate_workout_outline, log_set, finish_workout). Single-user, offline-only MVP with CSV import for exercises and manual guided workouts (user advances between sets).

## Steps

1. Project scaffold
   - Initialize Next.js TypeScript app and install dependencies (Next, React, TypeScript, Tailwind, Drizzle, better-sqlite3, Vercel AI SDK).
   - Files: package.json, tsconfig.json, next.config.js, tailwind.config.js, app/ layout and entry.

2. Database & seed
   - Create Drizzle schema and DB client (src/db/schema.ts, src/db/client.ts).
   - Implement a CSV import/seed script to populate equipment and exercises (scripts/seed.ts).
   - Define tables: users, equipment, recovery_logs, workout_sessions, workout_sets, ai_memories.

3. LLM integration
   - Add lib/llm.ts to configure the Vercel AI SDK to point at LM‑Studio (env var for URL).
   - Add a simple test API route to validate connectivity to LM‑Studio.

4. Server-action tools & API
   - Implement server actions / API endpoints: generate_workout_outline, log_set, finish_workout, getAvailableEquipment, buildSystemPrompt.
   - Tools will be simple functions that read/write SQLite via Drizzle.

5. Core UI & check-in
   - Build check-in modal (fields: sleep quality, mood/energy, injury flags/notes) and a chat-like session page.
   - Implement exercise upload (CSV) UI.

6. Guided workout flow
   - Stepper UI that shows outline, one exercise at a time; user manually confirms set completion.
   - On each set completion call log_set; at session end call finish_workout which summarizes and saves ai_memories.

7. Acceptance & manual tests
   - Manual test plan: start session, submit check-in, request workout, perform sets, verify DB entries and memory creation.

8. Docs & env
   - Provide README with LM‑Studio setup instructions, .env.local template, and run commands.

## Relevant files (create/reuse)
- app/layout.tsx, app/page.tsx — app shell and home UI
- app/(components)/CheckInForm.tsx — pre-workout check-in
- app/(components)/WorkoutStepper.tsx — guided flow UI
- app/api/ai/tools.ts — generate_workout_outline, log_set, finish_workout exporters
- src/db/schema.ts — Drizzle schema definition
- src/db/client.ts — DB client wrapper
- lib/llm.ts — LM‑Studio / Vercel AI SDK provider config
- scripts/seed.ts — CSV import and seed script
- data/ai-trainer.db — SQLite database file (created at runtime)

## Verification

1. Run seed script and confirm equipment/exercises exist in DB.
2. Start LM‑Studio locally and run Next dev server. Use the test API route to verify the model responds.
3. Run manual acceptance flow: check-in -> generate outline -> step through sets -> confirm log_set entries in workout_sets table -> finish_workout creates ai_memory.
4. Verify offline operation: LM‑Studio + Next running locally, no external API keys required.

## Decisions (from your answers)
- Single-user local profile (no auth) for MVP.
- Offline-only (LM‑Studio) for MVP; cloud LLMs are a later extension.
- Hardware target: 8GB VRAM (5070 mobile) — design for small context windows and externalized state.
- Default data retention: manual deletion only.
- Exercise ingest: CSV import supported for populating exercise DB.
- Check-in fields: sleep quality, mood/energy, injury flags/notes.
- Guided flow: user manually advances between sets.
- Tools allowed: generate_workout_outline, log_set, finish_workout.
- Testing: manual acceptance tests for MVP.

## Further considerations

1. Safety rules: require user to input long-term medical conditions and disliked exercises at session start; enforce banlist and RPE caps in generate_workout_outline logic.
2. Future features: cloud LLM toggle, PWA, voice input, multi-user accounts.
3. Implementation will favor small system prompts + DB-driven context to keep model tokens low and VRAM usage modest.

## Run dev (quick)

```bash
npm install
npm run dev
```
