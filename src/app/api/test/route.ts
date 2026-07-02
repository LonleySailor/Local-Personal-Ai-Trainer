import { NextResponse } from "next/server";
import { generateText, lmStudioModel } from "@/lib/llm";

export async function GET() {
  try {
    const { text } = await generateText({
      model: lmStudioModel,
      prompt: "Say hello and confirm you are running locally.",
      // Reasoning models spend output tokens on hidden reasoning first;
      // a small cap can truncate before any visible text is emitted.
      maxOutputTokens: 1024*8,
    });

    return NextResponse.json({ success: true, response: text });
  } catch (error) {
    console.error("LM-Studio connectivity test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
