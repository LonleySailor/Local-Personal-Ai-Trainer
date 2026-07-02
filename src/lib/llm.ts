import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, streamText, tool } from "ai";

const LM_STUDIO_URL =
  process.env.LM_STUDIO_URL ?? "http://localhost:1234/v1";

// Placeholder id: LM-Studio routes it to whatever model is loaded. Set
// LM_STUDIO_MODEL to a concrete id (e.g. "google/gemma-4-12b") to pin one
// when several models are loaded at once.
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL ?? "local-model";

const parsesAsJson = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

// Some reasoning models occasionally emit their hidden "start of thought"
// token in the middle of grammar-constrained JSON output (typically right
// after opening a string value). LM-Studio's template parser then reroutes
// everything after that token into `reasoning_content`, so the client sees
// JSON truncated mid-string and `generateObject` fails — even though the
// grammar kept the *combined* stream valid. Repair it here: when `content`
// alone is not valid JSON but `content + reasoning_content` is, stitch the
// two back together before the SDK parses the response. Non-JSON responses
// and streaming requests pass through untouched.
const repairSplitJson: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
    return res;
  }

  try {
    const body = await res.clone().json();
    let repaired = false;

    for (const choice of body?.choices ?? []) {
      const message = choice?.message;
      const content = message?.content;
      const reasoning = message?.reasoning_content;
      if (
        typeof content === "string" &&
        typeof reasoning === "string" &&
        content.length > 0 &&
        reasoning.length > 0 &&
        !parsesAsJson(content) &&
        parsesAsJson(content + reasoning)
      ) {
        message.content = content + reasoning;
        message.reasoning_content = "";
        repaired = true;
      }
    }

    if (!repaired) return res;
    return new Response(JSON.stringify(body), {
      status: res.status,
      statusText: res.statusText,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return res;
  }
};

// LM-Studio exposes an OpenAI-compatible local endpoint. We reuse the
// @ai-sdk/openai provider, override baseURL, and pass a placeholder API key
// because the SDK requires one even though LM-Studio ignores it.
const lmStudio = createOpenAI({
  name: "lm-studio",
  baseURL: LM_STUDIO_URL,
  apiKey: "not-needed",
  fetch: repairSplitJson,
});

// Use the chat completions interface (/v1/chat/completions), which LM-Studio
// supports.
export const lmStudioModel = lmStudio.chat(LM_STUDIO_MODEL);

export { generateObject, generateText, streamText, tool };
