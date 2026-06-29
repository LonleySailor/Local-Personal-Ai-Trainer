# AI Personal Trainer

A local, privacy-first AI fitness coach. A Next.js app orchestrates a **local** LLM through [LM-Studio](https://lmstudio.ai/) to generate and guide your workouts. All durable state — your equipment inventory, recovery logs, workout history, and AI-generated memories — lives in a local SQLite database rather than in the model's context window, so the whole thing runs comfortably within an ~8GB VRAM budget and never sends your data to the cloud.

> **Status:** Single-user MVP. There is no auth — `userId` is hardcoded to `1`. The app is offline-only (LM-Studio is the sole inference provider) and the interface is a text-based, step-by-step guided workout flow.

## How it works

Pre-workout check-in form → the backend builds a compact system prompt from the database (profile, equipment, latest recovery log, last few AI memories) → LM-Studio generates a structured workout outline → you log sets one at a time → the session closes with an AI-generated memory note saved back to the database for next time.

The app never replays full conversation history to the model — context is reassembled from the DB on each call to stay within the VRAM budget.

## Prerequisites

- **Node.js 20+** (developed against Node 26)
- **[LM-Studio](https://lmstudio.ai/)** installed
- A **GGUF model** to load in LM-Studio. This project was tested with `google/gemma-4-e4b`. 

## Setup & run

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file (defaults work out of the box)
cp .env.local.example .env.local

# 3. Initialize the database (creates tables + seeds the default user/equipment)
npm run seed
```

**4. Start LM-Studio:**

1. Open LM-Studio and download + load a model (e.g. `google/gemma-4-e4b`).
2. Go to the **Developer / Local Server** tab.
3. Start the server on **port `1234`** (this matches `LM_STUDIO_URL` in your env file).

> The LM-Studio server must be running with a model loaded before any AI feature will work.

**5. Start the app:**

```bash
npm run dev
```

Then open **http://localhost:3000**.

### Optional: seed equipment from a CSV

```bash
npm run seed <file.csv>   # columns: name, category, weight, weight_unit
```

## Available scripts

| Command          | Description                                              |
| ---------------- | ------------------------------------------------------- |
| `npm run dev`    | Start the Next.js dev server                            |
| `npm run build`  | Production build                                         |
| `npm run start`  | Run the production build                                |
| `npm run lint`   | Run ESLint                                               |
| `npm run seed`   | Create tables + seed default user/equipment (optional CSV arg) |
| `npm run migrate`| Apply schema migrations                                 |
| `npm run flush`  | Reset / clear database data                             |

## Configuration

`.env.local` holds two variables (defaults shown):

| Variable        | Default                      | Description                                  |
| --------------- | ---------------------------- | -------------------------------------------- |
| `LM_STUDIO_URL` | `http://localhost:1234/v1`   | LM-Studio's OpenAI-compatible endpoint       |
| `DATABASE_PATH` | `./data/ai-trainer.db`       | SQLite database file path (relative to root) |

The `data/` directory is git-ignored, so your database stays local.

## Project layout

- `src/app/api/ai/tools.ts` — server actions: system-prompt building, outline generation, set logging, session close
- `src/lib/llm.ts` — LM-Studio wrapper (Vercel AI SDK pointed at the local endpoint)
- `src/db/` — Drizzle schema (`schema.ts`) and the SQLite client (`client.ts`)
- `scripts/seed.ts` — raw-SQL schema setup + default seed data


## Troubleshooting

- **AI calls fail / hang:** confirm the LM-Studio server is running on port `1234` and a model is loaded.
- **Database errors / missing tables:** run `npm run seed` to create and seed the database.
