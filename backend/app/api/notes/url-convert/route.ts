import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";
import axios from "axios";
import { load } from "cheerio";
import { GROQ_API_BASE, GROQ_API_KEY, MODEL_NAME } from "@/lib/ai-config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const ARTICLE_TO_NOTES_PROMPT = `Convert this article into structured exam-ready study notes. Use markdown format.

Article Content:
{CONTENT}

Generate EXACTLY this structure:
# Study Notes: {TITLE}

## Summary
[2-3 sentence summary of main points]

## Key Concepts
- **Concept 1**: Explanation
- **Concept 2**: Explanation
- **Concept 3**: Explanation

## Main Points
- Point 1: Details
- Point 2: Details
- Point 3: Details

## Key Formulas/Rules
(if applicable)
- Formula/Rule 1
- Formula/Rule 2

## Examples from Article
- Example 1: Details
- Example 2: Details

## Questions to Remember
- Question 1?
- Question 2?
- Question 3?

## Quick Revision
1. Key takeaway 1
2. Key takeaway 2
3. Key takeaway 3

Rules:
- Use bold (**word**) for keywords
- Keep it structured
- Focus on important information
- Make it exam-ready
- Markdown only`;

function normalizePageCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(10, Math.floor(parsed)));
}

function getLengthInstruction(pageCount: number): string {
  const minWords = pageCount * 450;
  const maxWords = pageCount * 650;
  return `\n\nLength requirement:\n- Target ${pageCount} pages of detailed notes\n- Write approximately ${minWords}-${maxWords} words\n- Expand all sections with richer explanations and examples\n- Avoid short summaries`;
}

function getMaxTokens(pageCount: number): number {
  return Math.min(8000, 1600 + pageCount * 600);
}

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 10000,
    });

    const $ = load(response.data);

    // Remove script, style, nav, footer
    $("script, style, nav, footer, .advertisement, .ads").remove();

    // Get main content
    const mainContent =
      $("article").text() ||
      $("main").text() ||
      $("[role='main']").text() ||
      $("body").text();

    // Clean up whitespace
    const cleanedContent = mainContent
      .replace(/\s+/g, " ")
      .substring(0, 8000)
      .trim();

    if (cleanedContent.length < 100) {
      throw new Error("Article content too short");
    }

    return cleanedContent;
  } catch (error) {
    console.error("Failed to fetch article:", error);
    throw new Error("Unable to fetch article. Check the URL and try again.");
  }
}

async function convertToNotes(
  content: string,
  title: string,
  pageCount: number
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  try {
    const prompt = ARTICLE_TO_NOTES_PROMPT.replace("{CONTENT}", content)
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
      throw new Error(`Failed to process article with Gemini: ${error}`);
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

async function convertToNotesWithGrok(content: string, title: string, pageCount: number): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const prompt = ARTICLE_TO_NOTES_PROMPT.replace("{CONTENT}", content)
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
        { role: "system", content: ARTICLE_TO_NOTES_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: getMaxTokens(pageCount),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to process article with Grok: ${error}`);
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

async function convertToNotesWithFallback(content: string, title: string, pageCount: number): Promise<string> {
  try {
    return await convertToNotes(content, title, pageCount);
  } catch (geminiError) {
    console.warn("Gemini URL conversion failed, falling back to Grok:", geminiError);
    try {
      return await convertToNotesWithGrok(content, title, pageCount);
    } catch (grokError) {
      const geminiMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
      const grokMessage = grokError instanceof Error ? grokError.message : String(grokError);

      if (/token|quota|rate|limit|TPD/i.test(grokMessage)) {
        throw new Error("AI providers are temporarily rate-limited. Please try again in a few minutes.");
      }

      throw new Error(`Failed to convert website content to notes. Gemini error: ${geminiMessage}. Grok error: ${grokMessage}`);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const body = await request.json();
    const { url, title } = body;
    const pageCount = normalizePageCount(body?.pageCount);

    if (!url || url.trim().length === 0) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Fetch article content
    const articleContent = await fetchArticleContent(url);

    // Extract title from URL if not provided
    const noteTitle = title || new URL(url).hostname;

    // Convert to notes with Gemini fallback to Grok
    const generatedNotes = await convertToNotesWithFallback(articleContent, noteTitle, pageCount);

    // Create and save note
    const note = new Note({
      userId,
      title: noteTitle,
      content: generatedNotes,
      sourceType: "url",
      sourceLink: url,
    });

    await note.save();

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Failed to convert URL to notes:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to convert article to notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
