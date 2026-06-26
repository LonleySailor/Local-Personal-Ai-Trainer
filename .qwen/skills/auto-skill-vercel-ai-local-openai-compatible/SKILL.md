---
name: vercel-ai-local-openai-compatible
description: Integrate a local OpenAI-compatible LLM server (LM-Studio, Ollama, etc.) with the Vercel AI SDK in a Next.js project
source: auto-skill
extracted_at: '2026-06-25T16:47:33.937Z'
---

# Integrate a Local OpenAI-Compatible LLM with Vercel AI SDK

## Purpose

Wire up a self-hosted, OpenAI-compatible inference server (e.g., LM-Studio, Ollama, llama.cpp, vLLM) to the Vercel AI SDK so the app can call `generateText`, `streamText`, and tools against a local model without cloud API keys.

## When to Use

- The project targets a local-first / offline-only architecture.
- The inference server exposes an OpenAI-compatible `/v1/chat/completions` endpoint.
- You are unsure which provider method and option names the installed SDK version expects.

## Procedure

### 1. Confirm the Server Endpoint

Identify the local base URL, typically:

- LM-Studio: `http://localhost:1234/v1`
- Ollama: `http://localhost:11434/v1`

Store it in `.env.local`:

```bash
LM_STUDIO_URL=http://localhost:1234/v1
```

### 2. Create a Provider Wrapper

Create a file such as `src/lib/llm.ts`:

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, tool } from "ai";

const LM_STUDIO_URL =
  process.env.LM_STUDIO_URL ?? "http://localhost:1234/v1";

const localProvider = createOpenAI({
  name: "lm-studio",      // optional, used in telemetry/provider metadata
  baseURL: LM_STUDIO_URL,
  apiKey: "not-needed",   // SDK requires a string; local servers ignore it
});

// IMPORTANT: use .chat() to hit /v1/chat/completions.
// The default provider() call targets OpenAI's responses API, which local
// servers usually do not implement.
export const localModel = localProvider.chat("local-model");

export { generateText, streamText, tool };
```

### 3. Resolve Version-Specific Option Names

The Vercel AI SDK renames options between major versions. If the build fails with an unknown property, inspect the installed package types instead of guessing:

```bash
# Find the correct max-token option
grep -n "maxOutputTokens\|maxTokens" \
  node_modules/ai/dist/index.d.ts
```

For `ai` v7 use `maxOutputTokens`; older versions often used `maxTokens`.

### 4. Add a Connectivity Test Route

Create `src/app/api/test/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { generateText, localModel } from "@/lib/llm";

export async function GET() {
  try {
    const { text } = await generateText({
      model: localModel,
      prompt: "Say hello and confirm you are running locally.",
      maxOutputTokens: 128,
    });
    return NextResponse.json({ success: true, response: text });
  } catch (error) {
    console.error("Local LLM test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
```

### 5. Verify

Build the project:

```bash
npm run build
```

Then, with the local server running:

```bash
npm run dev
curl http://localhost:3000/api/test
```

## Key Pitfalls

| Pitfall | Why It Happens | Fix |
|---------|---------------|-----|
| `API key is missing` error | `createOpenAI` expects `apiKey` even for local servers | Pass `apiKey: "not-needed"` |
| 404 or unsupported endpoint | Default provider uses `/v1/responses` | Use `provider.chat(modelId)` for `/v1/chat/completions` |
| Type error: `maxTokens` does not exist | SDK v7 renamed it | Use `maxOutputTokens` (verify in `node_modules/ai/dist/index.d.ts`) |
| Build fails because `LM_STUDIO_URL` is undefined at module load | Eager env check | Read env at call time or provide a localhost fallback |

## Output Format

A reusable `src/lib/llm.ts` plus a test route that confirms local inference works end-to-end.

## Handling Reasoning / "Thinking" Local Models

Some local models (e.g., quantized Gemma/Gemma-3 variants in LM-Studio) emit a separate `reasoning_content` stream before producing ordinary `content`. With short token budgets, the model may consume all allocated tokens on reasoning and return empty `content`.

**Symptom:** `generateText` or your `/api/test` route returns `{ response: "" }`, but the LM-Studio server is reachable and curl works for simple prompts.

**Diagnose with a direct curl:**

```bash
curl -X POST http://localhost:1234/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"local-model","messages":[{"role":"user","content":"Say hello"}],"max_tokens":50}'
```

If you see `reasoning_content` with a long chain-of-thought and `content: ""`, you are hitting this behavior.

**Fixes:**

1. **Use `generateObject` for short, structured outputs.** `generateObject` appears to coax the model into producing content inside the JSON object, so it is more reliable than `generateText` for summaries, memory notes, workout outlines, etc.

   ```typescript
   import { generateObject } from "@/lib/llm";

   const { object } = await generateObject({
     model: localModel,
     system: "You are a helpful trainer.",
     prompt: "Summarise this workout in one sentence.",
     schema: z.object({ summary: z.string().min(1) }),
     output: "object",
     maxOutputTokens: 256,
   });
   ```

2. **Always provide a fallback so the app does not store empty strings.**

   ```typescript
   let memoryText = object.summary.trim();
   if (!memoryText) {
     memoryText = `Completed ${sets.length} set(s) over ${durationMinutes} minute(s).`;
   }
   ```

3. **Raise `maxOutputTokens`** to leave room after reasoning finishes (e.g., 512–1024 tokens for summary calls).

4. **Avoid treating an empty `generateText` response as a failed API call** if server health and the direct curl look OK.

## Tips

- Keep the model id as a generic placeholder (e.g., `"local-model"`). Local servers route to whichever GGUF/model they have loaded and generally ignore the request's `model` field.
- Do not commit `.env.local`; keep only `.env.local.example` in version control.
- If the local server requires a real API key, swap `apiKey: "not-needed"` for `apiKey: process.env.MY_LOCAL_API_KEY`.
- If `npm run dev` launches on a different port because an old dev server is still running, kill the old process first; otherwise stale compiled code may mask your latest changes.
