import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, streamText, tool } from "ai";

// Provider switch. Local development (and the offline MVP) uses LM-Studio;
// the hosted competition demo uses OpenRouter, which has no local GPU.
// Both speak the OpenAI-compatible chat API, so we reuse @ai-sdk/openai for
// both and only swap baseURL / apiKey / model id.
const LLM_PROVIDER = (process.env.LLM_PROVIDER ?? "lmstudio").toLowerCase();

function createModel() {
  if (LLM_PROVIDER === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "LLM_PROVIDER=openrouter but OPENROUTER_API_KEY is not set. " +
          "Add it to .env.local (or unset LLM_PROVIDER to use local LM-Studio)."
      );
    }

    const openrouter = createOpenAI({
      name: "openrouter",
      baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      apiKey,
    });

    return openrouter.chat(
      process.env.OPENROUTER_MODEL ?? "google/gemma-4-26b-a4b-it"
    );
  }

  // Default: LM-Studio exposes an OpenAI-compatible local endpoint. We reuse the
  // @ai-sdk/openai provider, override baseURL, and pass a placeholder API key
  // because the SDK requires one even though LM-Studio ignores it. The model id
  // is a placeholder; LM-Studio routes to whatever model it has loaded.
  const lmStudio = createOpenAI({
    name: "lm-studio",
    baseURL: process.env.LM_STUDIO_URL ?? "http://localhost:1234/v1",
    apiKey: "not-needed",
  });

  return lmStudio.chat("local-model");
}

// Single shared model used by every server action. Named `lmStudioModel` for
// backwards compatibility with existing consumers; `aiModel` is the provider-
// agnostic alias to prefer going forward.
export const aiModel = createModel();
export const lmStudioModel = aiModel;

export { generateObject, generateText, streamText, tool };
