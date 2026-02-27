import { NextRequest, NextResponse } from "next/server";
import {
  SARVAM_CHAT_MODEL,
  SARVAM_CHAT_PATH,
  extractChatText,
  readSarvamErrorMessage,
  sarvamFetch,
} from "@/lib/sarvam";

type Role = "system" | "user" | "assistant";

type ChatMessage = {
  role: Role;
  content: string;
};

const SUPPORTED_LANGUAGES: Record<string, string> = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "bn-IN": "Bengali",
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      message?: string;
      messages?: ChatMessage[];
      language?: string;
    };

    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const language =
      typeof body?.language === "string" && body.language in SUPPORTED_LANGUAGES
        ? body.language
        : "en-IN";

    const history = Array.isArray(body?.messages)
      ? body.messages
          .filter(
            (item) =>
              item &&
              (item.role === "user" || item.role === "assistant" || item.role === "system") &&
              typeof item.content === "string" &&
              item.content.trim().length > 0,
          )
          .slice(-12)
      : [];

    const systemInstruction = {
      role: "system" as const,
      content: `You are EduGenie Voice Assistant. Always answer in ${SUPPORTED_LANGUAGES[language]}. Provide a clear, concise, exam-friendly response by:
1. Stating the main concept first
2. Explaining step-by-step with key points
3. Adding a short definition or summary
4. If relevant, add 1-2 practice questions
Keep the answer between 150-250 words to ensure it's fully spoken. Quality and clarity over length.`,
    };

    const messages: ChatMessage[] = [
      systemInstruction,
      ...history,
      {
        role: "user",
        content: message,
      },
    ];

    const upstream = await sarvamFetch(SARVAM_CHAT_PATH, {
      method: "POST",
      body: JSON.stringify({
        model: SARVAM_CHAT_MODEL,
        messages,
      }),
    });

    if (!upstream.ok) {
      const reason = await readSarvamErrorMessage(upstream);
      return NextResponse.json({ error: reason }, { status: upstream.status });
    }

    const payload = (await upstream.json()) as unknown;
    const reply = extractChatText(payload);

    if (!reply) {
      return NextResponse.json(
        { error: "Sarvam chat response did not contain text output." },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Voice assistant chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to chat with voice assistant." },
      { status: 500 },
    );
  }
}
