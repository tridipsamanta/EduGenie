import { NextRequest, NextResponse } from "next/server";
import {
  SARVAM_CHAT_MODEL,
  SARVAM_CHAT_PATH,
  extractChatText,
  readSarvamErrorMessage,
  sarvamFetch,
} from "@/lib/sarvam";

type Role = "user" | "assistant";

type StreamHistoryItem = {
  role: Role;
  text: string;
};

const WINDOW_MS = 60_000;
const LIMIT_PER_WINDOW = 18;
const requestWindowByIp = new Map<string, number[]>();

const detectLanguage = (value: string): "en-IN" | "hi-IN" | "bn-IN" => {
  if (/[\u0980-\u09FF]/.test(value)) return "bn-IN";
  if (/[\u0900-\u097F]/.test(value)) return "hi-IN";
  return "en-IN";
};

const sanitizeHistory = (history: unknown): StreamHistoryItem[] => {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (item): item is StreamHistoryItem =>
        Boolean(item) &&
        (item as StreamHistoryItem).role !== undefined &&
        ((item as StreamHistoryItem).role === "user" || (item as StreamHistoryItem).role === "assistant") &&
        typeof (item as StreamHistoryItem).text === "string" &&
        (item as StreamHistoryItem).text.trim().length > 0,
    )
    .slice(-10)
    .map((item) => ({
      role: item.role,
      text: item.text.trim(),
    }));
};

const normalizeAlternatingHistory = (
  history: StreamHistoryItem[],
  currentUserMessage: string,
): StreamHistoryItem[] => {
  const normalized: StreamHistoryItem[] = [];

  for (const item of history) {
    if (!item.text.trim()) continue;

    if (normalized.length === 0 && item.role !== "user") {
      continue;
    }

    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === item.role) {
      normalized[normalized.length - 1] = item;
      continue;
    }

    normalized.push(item);
  }

  const last = normalized[normalized.length - 1];
  if (last?.role === "user") {
    normalized.pop();
  }

  const maybeLast = normalized[normalized.length - 1];
  if (maybeLast?.role === "assistant" && maybeLast.text.trim() === currentUserMessage.trim()) {
    normalized.pop();
  }

  return normalized;
};

const splitForRealtime = (text: string, maxLength: number): string[] => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLength) return [cleaned];

  const parts = cleaned.split(/(?<=[.!?।])\s+/);
  const chunks: string[] = [];
  let current = "";

  const pushByWords = (segment: string) => {
    const words = segment.split(/\s+/).filter(Boolean);
    let local = "";
    for (const word of words) {
      if (word.length > maxLength) {
        if (local) {
          chunks.push(local);
          local = "";
        }
        for (let index = 0; index < word.length; index += maxLength) {
          chunks.push(word.slice(index, index + maxLength));
        }
        continue;
      }

      const candidate = local ? `${local} ${word}` : word;
      if (candidate.length <= maxLength) {
        local = candidate;
      } else {
        chunks.push(local);
        local = word;
      }
    }

    if (local) chunks.push(local);
  };

  for (const part of parts) {
    if (!part) continue;
    if (part.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      pushByWords(part);
      continue;
    }

    const candidate = current ? `${current} ${part}` : part;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = part;
    }
  }

  if (current) chunks.push(current);
  return chunks;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const recent = (requestWindowByIp.get(ip) || []).filter((ts) => now - ts < WINDOW_MS);

    if (recent.length >= LIMIT_PER_WINDOW) {
      return NextResponse.json(
        { error: "Too many voice turns. Please wait a few seconds." },
        { status: 429 },
      );
    }

    recent.push(now);
    requestWindowByIp.set(ip, recent);

    const body = (await request.json()) as {
      message?: string;
      history?: StreamHistoryItem[];
      preferredLanguage?: "en-IN" | "hi-IN" | "bn-IN";
    };

    const userMessage = typeof body?.message === "string" ? body.message.trim() : "";
    if (!userMessage) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const preferredLanguage =
      body?.preferredLanguage === "en-IN" || body?.preferredLanguage === "hi-IN" || body?.preferredLanguage === "bn-IN"
        ? body.preferredLanguage
        : null;

    const language = preferredLanguage ?? detectLanguage(userMessage);
    const languageName = language === "hi-IN" ? "Hindi" : language === "bn-IN" ? "Bengali" : "English";

    const history = sanitizeHistory(body?.history);
    const alternatingHistory = normalizeAlternatingHistory(history, userMessage);

    const contextMessages = alternatingHistory.map((item) => ({
      role: item.role,
      content: item.text,
    }));

    const upstream = await sarvamFetch(SARVAM_CHAT_PATH, {
      method: "POST",
      body: JSON.stringify({
        model: SARVAM_CHAT_MODEL,
        messages: [
          {
            role: "system",
            content: `You are EduGenie advanced voice assistant. Reply naturally in ${languageName}. Keep voice-friendly pacing, short clauses, and conversational tone. Avoid markdown, bullets, and special symbols.`,
          },
          ...contextMessages,
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const reason = await readSarvamErrorMessage(upstream);
      return NextResponse.json({ error: reason }, { status: upstream.status });
    }

    const payload = (await upstream.json()) as unknown;
    const assistantText = extractChatText(payload)?.trim();

    if (!assistantText) {
      return NextResponse.json({ error: "Assistant returned empty output." }, { status: 502 });
    }

    const chunks = splitForRealtime(assistantText, 150);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const write = (event: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          write({ type: "language", language });
          write({ type: "status", state: "processing" });

          for (const chunk of chunks) {
            write({ type: "assistant_chunk", text: chunk });
            await wait(55);
          }

          write({ type: "assistant_done", text: assistantText });
          controller.close();
        } catch (error) {
          write({
            type: "error",
            message: error instanceof Error ? error.message : "Voice stream failed.",
          });
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Voice stream route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to stream voice response." },
      { status: 500 },
    );
  }
}
