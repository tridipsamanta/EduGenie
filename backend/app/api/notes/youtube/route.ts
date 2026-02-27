import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";
import { GROQ_API_KEY, GROQ_API_BASE, MODEL_NAME } from "@/lib/ai-config";

const YOUTUBE_NOTES_PROMPT = `You are converting a YouTube lecture transcript into structured exam revision notes.

IMPORTANT: The transcript may have timestamps and rambling. Extract only the educational content.

FORMAT (use markdown):
# [Lecture Topic - extract from content]

## Key Ideas from Lecture
- **Idea 1**: [Main concept explained]
- **Idea 2**: [Second key point]
- **Idea 3**: [Third key point]

## Important Examples Explained
1. **Example 1**: [What was explained? Why is it important?]
2. **Example 2**: [Another example with context]

## Likely Exam Questions
- "What is [main concept]?"
- "Explain [key idea]"
- "How does [concept] work?"

## 3 Most Important Concepts
1. **Concept**: [Why important?]
2. **Concept**: [Why important?]
3. **Concept**: [Why important?]

## Exam Summary (5 quick points)
- 🎯 Point 1
- 🎯 Point 2
- 🎯 Point 3
- 🎯 Point 4
- 🎯 Point 5

Return only markdown, no extra text.`;

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
            content: YOUTUBE_NOTES_PROMPT,
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

export async function POST(request: NextRequest) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const body = await request.json();
    const { transcript, title, videoUrl } = body;

    if (!transcript || transcript.trim().length < 100) {
      return NextResponse.json(
        { error: "Transcript is too short or invalid" },
        { status: 400 }
      );
    }

    // Limit transcript size (max 10000 chars for API)
    const cleanedTranscript = transcript
      .substring(0, 10000)
      .replace(/\[\d{1,2}:\d{2}:\d{2}\]/g, "") // Remove timestamps
      .replace(/\n{3,}/g, "\n\n"); // Clean excessive newlines

    // Generate notes with AI
    const prompt = `Convert this YouTube lecture transcript to exam revision notes:\n\n${cleanedTranscript}`;
    const contentMarkdown = await generateWithGroq(prompt);

    // Create note
    const summary = contentMarkdown.substring(0, 200).replace(/[#*`]/g, "").trim();
    const wordCount = contentMarkdown.split(/\s+/).length;
    const estimatedRevisionTime = Math.ceil(wordCount / 50);

    const note = new Note({
      userId,
      title: title || "YouTube Lecture Notes",
      contentMarkdown,
      summary,
      sourceType: "youtube",
      sourceLink: videoUrl || "",
      tags: ["youtube", "lecture"],
      estimatedRevisionTime,
    });

    await note.save();

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Failed to convert YouTube transcript:", error);
    return NextResponse.json(
      { error: "Failed to convert transcript" },
      { status: 500 }
    );
  }
}
