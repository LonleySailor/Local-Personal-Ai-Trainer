# Product Requirements Document (PRD) & Development Plan

## 1. Executive Summary
The AI Personal Trainer is a local, privacy-first web application that acts as a dynamic fitness coach. It uses a Next.js backend to orchestrate local LLM calls through LM-Studio and keeps state outside the model so the system can run efficiently within an 8GB VRAM constraint. The application generates workout plans from saved equipment, recovery data, and prior session memory instead of sending full chat history back to the model.

## 2. Architecture and Tech Stack

### 2.1 Core Infrastructure
*   **Framework:** Next.js (App Router, Server Actions).
*   **Language:** TypeScript.
*   **Styling:** Tailwind CSS.
*   **PWA Support:** `next-pwa` for future mobile installation support.

### 2.2 Data Layer and State Management
*   **Database:** SQLite.
*   **ORM:** Drizzle ORM.
*   **Data Model:** User profile, equipment inventory, recovery logs, workout sessions, workout sets, and AI memories.

### 2.3 AI Integration Layer
*   **SDK:** Vercel AI SDK (`ai` and `@ai-sdk/openai`).
*   **Local Inference Server:** LM-Studio with an OpenAI-compatible API.
*   **Cloud / External APIs:** OpenAI, Anthropic, OpenRouter, and Google via standard API keys.

### 2.4 Context Flow
Instead of sending the full chat history, the backend queries SQLite for the user profile, equipment, recent memories, and the latest recovery log. Next.js then builds a compact dynamic system prompt and sends it to LM-Studio.

---

## 3. Product Roadmap

### 3.1 MVP
The MVP focuses on a fully local, text-based training assistant that can generate a workout from scratch, adapt to recovery status, and guide the user step by step.

**Core Features:**
1. **Local execution:** Frontend, backend, and LLM all run on the host laptop.
2. **Equipment-driven planning:** The workout is generated strictly from the stored equipment inventory.
3. **Pre-workout check-in:** The user provides sleep quality/duration, overall well-being, and muscle soreness level/location.
4. **Guided workout flow:** The AI first gives an outline of the full workout, then leads the user exercise by exercise and waits for feedback after each set or exercise.
5. **Text-only interface:** All interactions happen through standard chat.
6. **Context optimization:** The backend builds the prompt from database state instead of injecting the full conversation.

### 3.2 MVP Milestones

#### Milestone 1: Project and Database Setup
*   Initialize the app with `npx create-next-app@latest ai-trainer`.
*   Install `drizzle-orm` and `better-sqlite3`.
*   Create the initial schemas for `users`, `equipment`, `workouts`, `workout_sets`, and `memories`.
*   Add a seed script with the starting equipment inventory.

#### Milestone 2: LLM Integration
*   Install `ai` and `@ai-sdk/openai`.
*   Configure a custom provider for LM-Studio.
*   Add a simple chat interface with `useChat` to verify model communication.

#### Milestone 3: Dynamic Context and Check-in
*   Build the workout start screen and check-in form.
*   Merge the check-in results with equipment data into a single system prompt.

#### Milestone 4: Tool Calling
*   Define `generate_workout_outline` to return the workout outline.
*   Define `log_set` to store the exercise name, weight, reps, and RPE in SQLite.
*   Define `finish_workout` to summarize the session and store a memory for the next workout.

### 3.3 After-MVP
The After-MVP phase extends the MVP with mobility, workflow flexibility, and cloud LLM support.

**Core Features:**
1. **External access:** Bind Next.js to `0.0.0.0` so the app is reachable from the local network or through a tunnel.
2. **PWA support:** Add a manifest and installable mobile experience through `next-pwa`.
3. **Voice input:** Use the Web Speech API or Whisper for hands-free logging.
4. **Alternative workflow:** Add a mode where the AI gives the whole workout at once and the user submits feedback at the end.
5. **Cloud LLM switch:** Add a UI toggle for local LM-Studio versus cloud providers through the same AI SDK abstraction.
6. **Mid-session exercise substitution/introduction (to be planned):** During set logging the AI may suggest or introduce an exercise that wasn't in the original generated outline (e.g. a swap when a machine is busy, or because an exercise feels wrong on the day). Today the stepper only walks the fixed outline, so there is no supported path for this. Needs design before implementation — see Stage 3 below.

### 3.4 After-MVP Roadmap Details

#### Stage 1: Mobility
*   Expose the app on the local Wi-Fi network.
*   Add PWA support for a mobile-friendly full-screen experience.

#### Stage 2: Multimodality
*   Add Web Speech API support or a Whisper-based fallback for voice-to-text.

#### Stage 3: Training Flow Options
*   Support both guided step-by-step coaching and full-workout delivery with end-of-session feedback.
*   **Mid-session exercise substitution/introduction (to be planned).** Allow the live workout to deviate from the generated outline when the AI introduces or swaps an exercise mid-session. Open design questions:
    *   How the user requests a swap/addition (UI affordance in the stepper), and how the request reaches the model with only compact context.
    *   How a newly introduced exercise is validated against available equipment, long-term medical conditions, and disliked exercises (the same safety rules used at generation time).
    *   How the new exercise is inserted into the live, flattened step list (ordering, set count, `kind`, targets) and persisted so history/recovery and resume still work.
    *   Whether the stored outline JSON in `workout_sessions.notes` is rewritten or the deviation is tracked separately.

#### Stage 4: LLM Scaling
*   Support OpenAI, Anthropic, OpenRouter, and Google through environment-based provider switching.

---

## 4. Architecture and Data Flow

The application uses an externalized state and tool-use architecture so that the model only handles short, relevant context while the database stores the durable training history.

### 4.1 Database Schema Outline
1. **`users`**: Demographics and goals.
2. **`equipment`**: Available weights, machines, and gear.
3. **`recovery_logs`**: Sleep, mood, soreness, and timestamps.
4. **`workout_sessions`**: Session metadata such as start and end time.
5. **`workout_sets`**: Exercise name, weight, reps, and RPE linked to a session.
6. **`ai_memories`**: Notes extracted from prior workouts.

### 4.2 System Prompt Generation
When the user starts a session, Next.js builds a compact context payload from the database and sends it to the model.

```json
{
  "system": "You are an elite personal trainer. Use the user's equipment, recent memories, and latest recovery data to generate a safe, effective workout plan for today.",
  "messages": [
    { "role": "user", "content": "I'm ready for today's workout. Sleep was good, minor soreness in chest." }
  ],
  "tools": [
    { "name": "generate_workout_outline", "...": "..." },
    { "name": "log_set", "...": "..." },
    { "name": "finish_workout", "...": "..." }
  ]
}
```

### 4.3 Development Steps
1. Initialize the Next.js app.
2. Set up SQLite and Drizzle ORM.
3. Build the core UI: chat interface and check-in modal.
4. Connect the API routes to `http://localhost:1234/v1` for LM-Studio.
5. Implement the server actions used by the model, such as `saveSetToDB`, `getAvailableEquipment`, `log_set`, and `finish_workout`.
6. Load a GGUF model in LM-Studio and test the guided workout flow.

---

## 4. Architecture & Data Flow

To ensure the 8GB VRAM is not exhausted by infinite context windows, the application uses an **Externalized State / Tool Use Architecture**.

### 4.1 Database Schema Outline
1.  **`users`**: Demographics, goals.
2.  **`equipment`**: List of available weights, machines, and gear.
3.  **`recovery_logs`**: Timestamps, sleep (hrs), mood (scale), soreness (text/scale).
4.  **`workout_sessions`**: Session metadata (start/end time).
5.  **`workout_sets`**: Foreign key to `workout_sessions`. Tracks exercise name, weight, reps, RPE.
6.  **`ai_memories`**: Extracted notes generated by the LLM (e.g., "User experiences pain in left shoulder during lateral raises").

### 4.2 System Prompt Generation (Pre-Inference)
When a user sends a message, Next.js intercepts it and builds the context payload:
```json
{
  "system": "You are an elite personal trainer. User equipment: [Query DB]. Recent memories: [Query DB]. Last recovery log: [Query DB]. Goal: Generate a safe, effective workout plan for today.",
  "messages": [
    { "role": "user", "content": "I'm ready for today's workout. Sleep was good, minor soreness in chest." }
  ],
  "tools": [ { "name": "log_set", ... }, { "name": "end_workout", ... } ]
}
```
### 4.3 Execution Steps for Development

1.  Initialize Next.js App: npx create-next-app@latest ai-trainer

2.  Setup Database: Configure SQLite and Drizzle ORM. Create schemas.

3.   Build Core UI: Chat interface and check-in modal.

4.  Integrate Vercel AI SDK: Connect the Next.js API routes to http://localhost:1234/v1 (LM-Studio default port).

5.  Implement Tools: Write the server actions in Next.js that the LLM will call (e.g., saveSetToDB, getAvailableEquipment).

6.  Test Local Inference: Load the GGUF model in LM-Studio, ensure "Context Shift" is enabled, and test the step-by-step logic.