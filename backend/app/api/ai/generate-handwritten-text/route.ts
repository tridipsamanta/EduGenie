import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

type RequestBody = {
  topic?: string;
  style?: "Neat Student" | "Fast Notes" | "Exam Revision Style";
};

const VALID_STYLES = ["Neat Student", "Fast Notes", "Exam Revision Style"] as const;

function extractText(response: any): string {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  const candidates = response?.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    const text = parts
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  return "";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const topic = String(body?.topic || "").trim();
    const style = String(body?.style || "").trim() as RequestBody["style"];

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    if (!VALID_STYLES.includes(style as any)) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const prompt = `You are generating handwritten-style study notes.

Topic: ${topic}
Style: ${style}

Return structured markdown with:

# Title
## Definition
## Key Points
- Bullet points
## Example
## Important Terms (bold)

Short sentences.
Exam-oriented.
Clean formatting.
2–3 pages equivalent.

Return markdown only.`;

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    const markdown = extractText(response as any);
    if (!markdown) {
      return NextResponse.json({ error: "Gemini returned empty content" }, { status: 502 });
    }

    return NextResponse.json({ topic, style, markdown });
  } catch (error) {
    console.error("generate-handwritten-text error:", error);
    return NextResponse.json({ error: "Failed to generate handwritten text" }, { status: 500 });
  }
}
