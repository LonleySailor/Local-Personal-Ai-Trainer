import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, streamText, tool } from "ai";

const LM_STUDIO_URL =
  process.env.LM_STUDIO_URL ?? "http://localhost:1234/v1";

// LM-Studio exposes an OpenAI-compatible local endpoint. We reuse the
// @ai-sdk/openai provider, override baseURL, and pass a placeholder API key
// because the SDK requires one even though LM-Studio ignores it.
const lmStudio = createOpenAI({
  name: "lm-studio",
  baseURL: LM_STUDIO_URL,
  apiKey: "not-needed",
});

// Use the chat completions interface (/v1/chat/completions), which LM-Studio
// supports. The model id is a placeholder; LM-Studio routes to its loaded model.
export const lmStudioModel = lmStudio.chat("local-model");

export { generateObject, generateText, streamText, tool };
