import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";
import { GROQ_API_BASE, GROQ_API_KEY, MODEL_NAME } from "@/lib/ai-config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

function normalizePageCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2;
  return Math.max(1, Math.min(10, Math.floor(parsed)));
}

function getLengthInstruction(pageCount: number): string {
  const minWords = pageCount * 450;
  const maxWords = pageCount * 650;
  return `\n\nLength requirement for the appended content:\n- Target ${pageCount} pages of detailed expansion\n- Write approximately ${minWords}-${maxWords} words\n- Expand with depth, sub-points, examples, and detailed explanations\n- Avoid short summaries - be comprehensive`;
}

function getMaxTokens(pageCount: number): number {
  return Math.min(8000, 1600 + pageCount * 600);
}

function buildExtendPrompt(title: string, existingContent: string, prompt: string, pageCount: number) {
  return `You are extending an existing study note.

Title: ${title}

Existing note content (for context only - DO NOT repeat this):
${existingContent.slice(0, 5000)}

User request to extend:
${prompt}

Instructions:
- Return ONLY the new markdown section(s) to append
- Do not repeat or include the full existing note
- Make it exam-focused and structured with proper markdown
- Include headers (##), bullet points, examples, important points
- This should be substantial, detailed content
${getLengthInstruction(pageCount)}`;
}

async function generateWithGemini(prompt: string, pageCount: number): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const response = await fetch(GEMINI_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: getMaxTokens(pageCount),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini generation failed: ${error}`);
  }

  const data = (await response.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return text;
}

async function generateWithGrok(prompt: string, pageCount: number): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content:
            "You are an exam-focused note-extension specialist. Generate detailed, substantial markdown to append to existing notes. Return only the new content.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: getMaxTokens(pageCount),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok generation failed: ${error}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty response from Grok");
  }

  return text;
}

async function generateWithFallback(prompt: string, pageCount: number): Promise<string> {
  try {
    return await generateWithGemini(prompt, pageCount);
  } catch (error) {
    console.warn("Gemini failed for note extension, falling back to Grok:", error);
    return generateWithGrok(prompt, pageCount);
  }
}

type Params = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await getNotesUserId();
    await connectDB();

    const note = await Note.findOne({
      _id: new mongoose.Types.ObjectId(params.id),
      userId,
    }).lean();

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const body = await request.json();
    const prompt = body?.prompt?.trim();
    const pageCount = normalizePageCount(body?.pageCount);

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const extendPrompt = buildExtendPrompt(note.title, note.content || "", prompt, pageCount);
    const generatedText = await generateWithFallback(extendPrompt, pageCount);

    return NextResponse.json({ generatedText }, { status: 200 });
  } catch (error) {
    console.error("Failed to extend note:", error);
    const message = error instanceof Error ? error.message : "Failed to extend note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
