# AI Trainer — Project Context

## Overview

**AI Personal Trainer** is a local-first, privacy-only web application that acts as a dynamic fitness coach. It uses a Next.js backend to orchestrate local LLM calls through LM-Studio and externalizes all state to SQLite so the model only receives compact, relevant context — designed to run within an **8GB VRAM** budget (RTX 5070 mobile target).

The core loop: user checks in (sleep, mood, soreness) → backend builds a system prompt from DB state (equipment, recovery logs, AI memories) → LLM generates a workout outline → user is guided exercise-by-exercise → sets are logged → session ends with an AI-generated memory note for next time.

**Single user, no auth, offline-only for MVP.** Cloud LLMs, PWA, voice input, and multi-user are post-MVP.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Database | SQLite via `better-sqlite3` |
| ORM | Drizzle ORM |
| AI SDK | Vercel AI SDK (`ai`, `@ai-sdk/openai`) |
| Inference | LM-Studio (OpenAI-compatible API at `localhost:1234`) |
| Validation | Zod |

## Building & Running

```bash
# Install dependencies
npm install

# Run seed script (creates DB, populates equipment/exercises)
npm run seed

# Start dev server
npm run dev

# Production build
npm run build
npm start

# Lint
npm run lint
```

## Environment Variables

Copy `.env.local.example` to `.env.local`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `LM_STUDIO_URL` | `http://localhost:1234/v1` | LM-Studio OpenAI-compatible API endpoint |
| `DATABASE_PATH` | `./data/ai-trainer.db` | SQLite database file path |

**Prerequisite:** LM-Studio must be running locally with a GGUF model loaded (Mistral 7B recommended for 8GB VRAM) and the server started on port 1234.

## Project Structure

```
src/
  app/
    layout.tsx          # Root layout (Geist fonts, Tailwind globals)
    page.tsx            # Home screen
    globals.css         # Tailwind import + CSS variables
    (components)/       # UI components (CheckInForm, WorkoutStepper, etc.)
    api/                # API routes
      ai/tools.ts       # LLM tool definitions
      test/route.ts     # LM-Studio connectivity test
  db/
    schema.ts           # Drizzle schema (all tables)
    client.ts           # Singleton DB + Drizzle instance
  lib/
    llm.ts              # Vercel AI SDK provider config for LM-Studio
scripts/
  seed.ts               # CSV import + DB seeder
data/
  ai-trainer.db         # SQLite database (runtime-generated)
```

## Database Schema

Six tables, all defined in `src/db/schema.ts` using Drizzle ORM:

| Table | Purpose |
|-------|---------|
| `users` | Demographics, goals (single-user for MVP) |
| `equipment` | Available weights, machines, gear |
| `recovery_logs` | Sleep quality, mood, soreness per session check-in |
| `workout_sessions` | Session metadata (start/end time, notes) |
| `workout_sets` | Exercise name, weight, reps, RPE — FK to sessions |
| `ai_memories` | LLM-extracted notes from prior workouts |

## Architecture: Externalized State / Tool Use

The app does **not** send full chat history to the model. Instead:

1. Backend queries SQLite for: user profile, equipment list, recent recovery log, last 3 AI memories.
2. A compact system prompt is built from this data.
3. The LLM receives the system prompt + current user message only.
4. The LLM calls tools (`generate_workout_outline`, `log_set`, `finish_workout`) which read/write SQLite directly.

This keeps token usage minimal and fits within 8GB VRAM constraints.

## LLM Tools (Server Actions)

| Tool | Purpose |
|------|---------|
| `getAvailableEquipment` | Query equipment table, return formatted list |
| `buildSystemPrompt` | Assemble compact system prompt from DB state |
| `generate_workout_outline` | Call LLM to produce structured workout plan |
| `log_set` | Insert exercise/weight/reps/RPE into `workout_sets` |
| `finish_workout` | Summarize session, generate AI memory, close session |

## Implementation Status

See `implementation-tasks.md` for the full task list (Phases 1–10). Task 1.1 (Next.js scaffold) is complete. The remaining phases are:

- **Phase 1** — Scaffold & deps (in progress)
- **Phase 2** — Database layer (Drizzle schema, client, seed)
- **Phase 3** — LLM integration (LM-Studio provider, test route)
- **Phase 4** — Server-action tools
- **Phase 5** — Core UI & check-in
- **Phase 6** — Guided workout flow
- **Phase 7** — Session state & safety rules
- **Phase 8** — Acceptance testing
- **Phase 9** — Documentation & env
- **Phase 10** — Final integration & polish

## Key Design Decisions

- **No auth** — single-user local app for MVP.
- **Offline-only** — LM-Studio is the sole inference provider; no external API keys needed.
- **DB-driven context** — prompts are built from database queries, never from conversation history. This is the core VRAM optimization strategy.
- **Manual guided flow** — user advances between sets manually (not auto-advancing).
- **Safety rules** — disliked exercises and medical conditions are collected at session start and enforced in `generate_workout_outline`.
- **Data retention** — manual deletion only; no auto-cleanup.

## Post-MVP Roadmap

- PWA support (`next-pwa`) for mobile install
- Bind to `0.0.0.0` for LAN access
- Voice input (Web Speech API or Whisper)
- Alternative workout mode (full workout upfront, feedback at end)
- Cloud LLM toggle (OpenAI, Anthropic, OpenRouter, Google)
