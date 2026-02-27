import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";
import { GROQ_API_KEY, GROQ_API_BASE, MODEL_NAME } from "@/lib/ai-config";

const ARTICLE_NOTES_PROMPT = `Convert this article into structured exam revision notes.

Extract ONLY the educational content. Remove navigation, ads, and author info.

FORMAT (use markdown):
# [Article Title - infer from content]

## Summary
[2-3 sentence overview]

## Main Points
- **Point 1**: [Key takeaway]
- **Point 2**: [Key takeaway]
- **Point 3**: [Key takeaway]

## Detailed Explanation
[Structured content with sub-sections as needed]

## Key Definitions
- **Term**: Definition
- **Term**: Definition

## How to Apply/Practice
- Application 1
- Application 2

## Common Questions
- Q1: Answer
- Q2: Answer

## Quick Summary (5 bullets)
- 🎯 Key point 1
- 🎯 Key point 2
- 🎯 Key point 3
- 🎯 Key point 4
- 🎯 Key point 5

Return only markdown.`;

async function generateWithGroq(prompt: string): Promise<string> {
  try {
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
            content: ARTICLE_NOTES_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Error calling Groq API:", error);
    throw error;
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const body = await request.json();
    const { url, title } = body;

    // Validate URL
    if (!url || !isValidUrl(url)) {
      return NextResponse.json(
        { error: "Valid URL is required" },
        { status: 400 }
      );
    }

    // Fetch content (with safety limits)
    let content = "";
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (educational tool)",
        },
        // 10 second timeout
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      // Simple HTML cleaning (remove scripts, styles, nav, footer)
      let cleaned = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<nav[^>]*>.*?<\/nav>/gi, "")
        .replace(/<footer[^>]*>.*?<\/footer>/gi, "")
        .replace(/<[^>]+>/g, " ") // Remove HTML tags
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ") // Collapse whitespace
        .trim();

      // Limit content size
      content = cleaned.substring(0, 5000);

      if (content.length < 200) {
        throw new Error("Article content too short");
      }
    } catch (error) {
      console.error("Error fetching URL:", error);
      return NextResponse.json(
        { error: "Failed to fetch or read the webpage" },
        { status: 400 }
      );
    }

    // Generate notes with AI
    const prompt = `Convert this article to exam revision notes:\n\n${content}`;
    const contentMarkdown = await generateWithGroq(prompt);

    // Create note
    const summary = contentMarkdown.substring(0, 200).replace(/[#*`]/g, "").trim();
    const wordCount = contentMarkdown.split(/\s+/).length;
    const estimatedRevisionTime = Math.ceil(wordCount / 50);

    const note = new Note({
      userId,
      title: title || "Article Notes",
      contentMarkdown,
      summary,
      sourceType: "url",
      sourceLink: url,
      tags: ["article", "web"],
      estimatedRevisionTime,
    });

    await note.save();

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Failed to convert URL:", error);
    return NextResponse.json(
      { error: "Failed to convert article" },
      { status: 500 }
    );
  }
}
