import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";
import { GROQ_API_KEY, GROQ_API_BASE, MODEL_NAME } from "@/lib/ai-config";

const NOTES_SYSTEM_PROMPT = `You are an exam-focused study note generator. 
Your task is to create concise, structured revision notes from a topic.

Rules:
- Use short sentences
- Prefer bullet points
- Highlight key concepts with **bold**
- Keep it simple and direct
- No fluff, no storytelling
- Structured like textbook revision points
- Include memory tricks
- Add likely exam questions
- Focus on clarity and exam-readiness

FORMAT (use markdown):
# [Topic Title]

## Definition
[Clear definition in 1-2 lines]

## Why Important
- [Reason 1]
- [Reason 2]
- [Reason 3]

## Key Concepts
- **Concept 1**: Brief explanation
- **Concept 2**: Brief explanation
- **Concept 3**: Brief explanation

## Detailed Explanation
1. **Core Idea**: [1-2 sentences]
2. **How it works**: [2-3 bullet points]
3. **Real example**: [Practical example]

## Exam-Oriented Points
- Often asked: [Question type]
- Definition-based: [Common question]
- Scenario-based: [Real application]

## Common Mistakes
- ❌ Wrong concept: Correct understanding
- ❌ Misunderstanding: Actual meaning
- ❌ Common confusion: Clarification

## Quick Revision (5 bullets)
- 🎯 Point 1
- 🎯 Point 2
- 🎯 Point 3
- 🎯 Point 4
- 🎯 Point 5

## Memory Trick
[Create a mnemonic or memory technique to remember this topic easily]

Return only the markdown, no additional text.`;

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
            content: NOTES_SYSTEM_PROMPT,
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
    const { topic, title } = body;

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    // Generate content with AI
    const prompt = `Create comprehensive exam-focused revision notes for: "${topic}"`;
    const contentMarkdown = await generateWithGroq(prompt);

    // Extract auto-generated tags
    const autoTags = extractTagsFromContent(topic, contentMarkdown);

    // Create note
    const summary = contentMarkdown.substring(0, 200).replace(/[#*`]/g, "").trim();
    const wordCount = contentMarkdown.split(/\s+/).length;
    const estimatedRevisionTime = Math.ceil(wordCount / 50);

    const note = new Note({
      userId,
      title: title || topic,
      contentMarkdown,
      summary,
      sourceType: "ai",
      tags: autoTags,
      estimatedRevisionTime,
    });

    await note.save();

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Failed to generate note:", error);
    return NextResponse.json(
      { error: "Failed to generate note" },
      { status: 500 }
    );
  }
}

function extractTagsFromContent(topic: string, content: string): string[] {
  const tags = [topic.toLowerCase()];
  
  // Extract capitalized words (likely key concepts)
  const keywords = content.match(/\*\*([^*]+)\*\*/g) || [];
  keywords.slice(0, 5).forEach(kw => {
    const cleaned = kw.replace(/\*\*/g, "").toLowerCase();
    if (cleaned.length > 3) {
      tags.push(cleaned);
    }
  });

  return [...new Set(tags)];
}
