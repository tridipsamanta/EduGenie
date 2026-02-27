import type { MessageRole } from "@/models/Message";
import { askGemini } from "@/lib/gemini";

const GROK_API_KEY =
  process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROCK_API_KEY;
const GROK_API_BASE = process.env.GROQ_API_BASE || "https://api.groq.com/openai/v1";
const MODEL_NAME =
  process.env.GROQ_MODEL || process.env.GROK_MODEL || "llama-3.3-70b-versatile";

function requireGrokApiKey() {
  if (!GROK_API_KEY) {
    throw new Error("GROQ_API_KEY (or GROK_API_KEY) is not set in backend environment variables.");
  }

  return GROK_API_KEY;
}

export const SYSTEM_PROMPT = `You are an educational AI tutor.
Explain clearly.
Prefer examples.
If student asks short question → short answer.
If concept → structured explanation.
Never hallucinate facts.
If unsure → say you don’t know.`;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function buildGeminiPrompt(messages: ChatMessage[]) {
  const recent = messages.slice(-12);
  return recent
    .filter((message) => message.role !== "system")
    .map((message) => {
      const label = message.role === "assistant" ? "Assistant" : "User";
      return `${label}: ${message.content}`;
    })
    .join("\n\n");
}

export const buildContents = (
  messages: Array<{ role: MessageRole; content: string }>
) : ChatMessage[] => [
  { role: "system", content: SYSTEM_PROMPT },
  ...messages
    .filter((message) => message.role !== "system")
    .map((message): ChatMessage => {
      const role: ChatMessage["role"] =
        message.role === "assistant" ? "assistant" : "user";
      return {
        role,
        content: message.content,
      };
    }),
];

async function grokRequest<T>(payload: Record<string, unknown>): Promise<T> {
  const apiKey = requireGrokApiKey();

  const response = await fetch(`${GROK_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: string };
        message?: string;
      };
      message = parsed.error?.message || parsed.message || raw;
    } catch {
      // keep raw response text
    }
    throw new Error(message || `Grok request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

type GrokChunk = { text?: string };

async function* streamGrokResponse(messages: ChatMessage[]): AsyncGenerator<GrokChunk> {
  const apiKey = requireGrokApiKey();

  const response = await fetch(`${GROK_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: string };
        message?: string;
      };
      message = parsed.error?.message || parsed.message || raw;
    } catch {
      // keep raw response text
    }
    throw new Error(message || `Grok stream failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error("Grok stream returned no body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const lines = event
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"));

      for (const line of lines) {
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") {
          continue;
        }

        try {
          const json = JSON.parse(data) as {
            choices?: Array<{
              delta?: { content?: string | null };
              message?: { content?: string | null };
            }>;
          };

          const content =
            json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? "";

          if (content) {
            yield { text: content };
          }
        } catch {
          // ignore malformed event chunks and continue reading stream
        }
      }
    }
  }
}

export async function generateTitleFromPrompt(prompt: string) {
  const response = await grokRequest<{
    choices?: Array<{ message?: { content?: string | null } }>;
  }>({
    model: MODEL_NAME,
    messages: [
      {
        role: "system",
        content: "Create very short, plain conversation titles.",
      },
      {
        role: "user",
        content: `Summarize this into a short 5-word title. Use plain words, no quotes: ${prompt}`,
      },
    ],
    temperature: 0.2,
  });

  const text = response.choices?.[0]?.message?.content ?? "New Chat";
  const cleaned = text
    .replace(/[\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 5)
    .join(" ");

  return cleaned || "New Chat";
}

export async function generateAssistantResponse(contents: ReturnType<typeof buildContents>) {
  try {
    const response = await grokRequest<{
      choices?: Array<{ message?: { content?: string | null } }>;
    }>({
      model: MODEL_NAME,
      messages: contents,
      temperature: 0.7,
    });

    return response.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    console.warn("Grok chat response failed, trying Gemini fallback:", error);
    try {
      const prompt = buildGeminiPrompt(contents);
      return await askGemini(prompt || "Please answer the user's last question.");
    } catch (fallbackError) {
      const primary = error instanceof Error ? error.message : String(error);
      const fallback = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Primary AI failed: ${primary}. Fallback failed: ${fallback}`);
    }
  }
}

export async function generateAssistantResponseStream(contents: ReturnType<typeof buildContents>) {
  async function* streamWithFallback() {
    try {
      for await (const chunk of streamGrokResponse(contents)) {
        yield chunk;
      }
    } catch (error) {
      console.warn("Grok stream failed, using Gemini fallback:", error);
      const fallbackText = await generateAssistantResponse(contents);
      if (fallbackText) {
        yield { text: fallbackText };
      }
    }
  }

  return streamWithFallback();
}
