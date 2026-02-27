import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";
import { GROQ_API_BASE, GROQ_API_KEY, MODEL_NAME } from "@/lib/ai-config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const TRANSCRIPT_TO_NOTES_PROMPT = `Convert this lecture transcript into structured study notes for exam preparation.

Transcript:
{TRANSCRIPT}

Generate EXACTLY this structure:
# {TITLE}

## Overview
[2-3 sentence summary of the lecture]

## Key Ideas
- **Idea 1**: Explanation
- **Idea 2**: Explanation
- **Idea 3**: Explanation
- **Idea 4**: Key takeaway

## Teacher's Explanation Summary
[Paragraph 1: Main concept explanation]
[Paragraph 2: Supporting details]
[Paragraph 3: Practical implications]

## Topics Covered
1. Topic 1 - Brief description
2. Topic 2 - Brief description
3. Topic 3 - Brief description
4. Topic 4 - Brief description

## Likely Exam Questions
- Q1: Key concept question?
- Q2: Definition question?
- Q3: Application question?
- Q4: Analysis question?

## Important Formulas/Rules
(if applicable)
- Formula/Rule 1: What it means
- Formula/Rule 2: When to use

## Examples Mentioned
- Example 1: Context and significance
- Example 2: Context and significance

## Quick Revision (One-liner for each topic)
1. Concept 1: One sentence summary
2. Concept 2: One sentence summary
3. Concept 3: One sentence summary
4. Concept 4: One sentence summary

Rules:
- Use bold (**word**) for keywords
- Stay academic and exam-focused
- Extract only important points
- Make it easy to memorize
- Markdown only
- Length: 1-2 pages equivalent`;

function normalizePageCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(10, Math.floor(parsed)));
}

function getLengthInstruction(pageCount: number): string {
  const minWords = pageCount * 450;
  const maxWords = pageCount * 650;
  return `\n\nLength requirement:\n- Target ${pageCount} pages of detailed notes\n- Write approximately ${minWords}-${maxWords} words\n- Expand all sections deeply using transcript insights\n- Avoid short summaries`;
}

function getMaxTokens(pageCount: number): number {
  return Math.min(8000, 1600 + pageCount * 600);
}

async function convertTranscriptToNotes(
  transcript: string,
  title: string,
  pageCount: number
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  try {
    const prompt = TRANSCRIPT_TO_NOTES_PROMPT.replace(
      "{TRANSCRIPT}",
      transcript.substring(0, 8000)
    )
      .replace("{TITLE}", title)
      .trim() + getLengthInstruction(pageCount);

    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
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
      console.error("Gemini API error:", error);
      throw new Error(`Failed to process transcript with Gemini: ${error}`);
    }

    const data = (await response.json()) as any;
    const generatedText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Failed to generate content";

    return generatedText;
  } catch (error) {
    console.error("Conversion error:", error);
    throw error;
  }
}

async function convertTranscriptToNotesWithGrok(
  transcript: string,
  title: string,
  pageCount: number
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const prompt = TRANSCRIPT_TO_NOTES_PROMPT.replace(
    "{TRANSCRIPT}",
    transcript.substring(0, 8000)
  )
    .replace("{TITLE}", title)
    .trim() + getLengthInstruction(pageCount);

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: TRANSCRIPT_TO_NOTES_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: getMaxTokens(pageCount),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to process transcript with Grok: ${error}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const generatedText = data.choices?.[0]?.message?.content?.trim();
  if (!generatedText) {
    throw new Error("Empty response from Grok");
  }

  return generatedText;
}

async function convertTranscriptWithFallback(
  transcript: string,
  title: string,
  pageCount: number
): Promise<string> {
  try {
    return await convertTranscriptToNotes(transcript, title, pageCount);
  } catch (geminiError) {
    console.warn("Gemini transcript conversion failed, falling back to Grok:", geminiError);
    try {
      return await convertTranscriptToNotesWithGrok(transcript, title, pageCount);
    } catch (grokError) {
      const geminiMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
      const grokMessage = grokError instanceof Error ? grokError.message : String(grokError);

      if (/token|quota|rate|limit|TPD/i.test(grokMessage)) {
        throw new Error("AI providers are temporarily rate-limited. Please try again in a few minutes.");
      }

      throw new Error(`Failed to convert YouTube transcript to notes. Gemini error: ${geminiMessage}. Grok error: ${grokMessage}`);
    }
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const body = await request.json();
    const { transcript, videoUrl, title } = body;
    const pageCount = normalizePageCount(body?.pageCount);

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: "Transcript is required. Please paste the transcript text." },
        { status: 400 }
      );
    }

    if (transcript.length > 15000) {
      return NextResponse.json(
        {
          error: "Transcript too long. Please provide a shorter transcript or split it into parts.",
        },
        { status: 400 }
      );
    }

    // Get title from URL if available
    let noteTitle = title;
    if (!noteTitle && videoUrl) {
      try {
        const url = new URL(videoUrl);
        noteTitle =
          url.searchParams.get("v") || "YouTube Lecture Notes";
      } catch {
        noteTitle = "YouTube Lecture Notes";
      }
    }
    if (!noteTitle) {
      noteTitle = "YouTube Lecture Notes";
    }

    // Convert transcript to notes with Gemini fallback to Grok
    const generatedNotes = await convertTranscriptWithFallback(
      transcript,
      noteTitle,
      pageCount
    );

    // Create and save note
    const note = new Note({
      userId,
      title: noteTitle,
      content: generatedNotes,
      sourceType: "youtube",
      sourceLink: videoUrl || "",
    });

    await note.save();

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Failed to convert YouTube transcript to notes:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to convert transcript to notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
