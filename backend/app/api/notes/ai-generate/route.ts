import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";
import { GROQ_API_BASE, GROQ_API_KEY, MODEL_NAME } from "@/lib/ai-config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const NOTES_GENERATION_PROMPT = `You are an intelligent AI study material generator. Analyze the user's request and generate content accordingly.

Topic/Request: {TOPIC}
Language: {LANGUAGE}
Pages: {PAGE_COUNT}

IMPORTANT: Write the ENTIRE content in {LANGUAGE} language.

INSTRUCTIONS:
1. **Analyze the request carefully** - If user asks for "questions", "Q&A", "practice problems", generate questions with answers. Otherwise, generate study notes.

2. **For Questions/Practice Format:**
   - Generate the EXACT number of questions requested
   - Each question must have:
     * Clear question statement
     * Detailed answer
     * Step-by-step explanation
     * Diagrams in markdown (ASCII art or structured text for chemical formulas, circuits, etc.)
   - Format:
     ### Question 1: [Question text]
     **Answer:** [Complete answer]
     **Explanation:** [Detailed step-by-step explanation]
     **Diagram/Formula:** [Use markdown code blocks, ASCII art, or chemical notation]
     
3. **For Study Notes Format:**
   Generate structured notes with:
   # {Topic Title}
   
   ## Definition
   [Clear definition with context]
   
   ## Key Concepts
   - **Concept 1**: Detailed explanation
   - **Concept 2**: Detailed explanation
   
   ## Detailed Explanation
   [Comprehensive explanation with examples]
   
   ## Examples & Applications
   [Real-world examples and applications]
   
   ## Important Points for Exam
   [Key facts, formulas, and exam tips]
   
   ## Common Mistakes
   [What to avoid and why]
   
   ## Quick Revision Summary
   [Bullet points for quick review]

4. **Content Length Rules:**
   - {PAGE_COUNT} pages means {MIN_WORDS}-{MAX_WORDS} words total
   - Distribute content evenly across all sections/questions
   - More pages = more detail, examples, and depth
   - Less pages = concise but complete coverage

5. **Special Requirements:**
   - Chemical diagrams: Use structural formulas in code blocks or ASCII
   - Mathematical formulas: Use standard notation
   - Be comprehensive and accurate
   - Focus on exam/study preparation
   - Use bold (**text**) for keywords
   - Use bullet points and numbered lists

Generate content that EXACTLY matches the user's request.`;

function normalizePageCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(10, Math.floor(parsed)));
}

function getLengthInstruction(pageCount: number): string {
  const minWords = pageCount * 450;
  const maxWords = pageCount * 650;
  return `${minWords}-${maxWords}`;
}

function getMaxTokens(pageCount: number): number {
  return Math.min(8000, 1600 + pageCount * 800);
}

async function generateWithGemini(prompt: string, pageCount: number): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  try {
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
      throw new Error(`Failed to generate notes with Gemini: ${error}`);
    }

    const data = (await response.json()) as any;
    const generatedText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Failed to generate content";

    return generatedText;
  } catch (error) {
    console.error("Gemini generation error:", error);
    throw error;
  }
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
        { role: "system", content: "You are an expert educational content generator. Follow the user's instructions precisely." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: getMaxTokens(pageCount),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate notes with Grok: ${error}`);
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

async function generateNotesWithFallback(topic: string, pageCount: number, language: string = "english"): Promise<string> {
  const languageNames: Record<string, string> = {
    english: "English",
    hindi: "Hindi (हिंदी)",
    bengali: "Bengali (বাংলা)"
  };
  
  const languageName = languageNames[language] || "English";
  const minWords = pageCount * 450;
  const maxWords = pageCount * 650;
  
  const prompt = NOTES_GENERATION_PROMPT
    .replace(/{TOPIC}/g, topic)
    .replace(/{LANGUAGE}/g, languageName)
    .replace(/{PAGE_COUNT}/g, String(pageCount))
    .replace(/{MIN_WORDS}/g, String(minWords))
    .replace(/{MAX_WORDS}/g, String(maxWords));

  try {
    return await generateWithGemini(prompt, pageCount);
  } catch (geminiError) {
    console.warn("Gemini note generation failed, falling back to Grok:", geminiError);
    try {
      return await generateWithGrok(prompt, pageCount);
    } catch (grokError) {
      const geminiMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
      const grokMessage = grokError instanceof Error ? grokError.message : String(grokError);

      if (/token|quota|rate|limit|TPD/i.test(grokMessage)) {
        throw new Error("AI providers are temporarily rate-limited. Please try again in a few minutes.");
      }

      throw new Error(`Failed to generate notes. Gemini error: ${geminiMessage}. Grok error: ${grokMessage}`);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("🤖 AI Generate - POST request received");
    const userId = await getNotesUserId();
    console.log("✅ User authenticated:", userId);

    await connectDB();
    console.log("✅ Database connected");

    const body = await request.json();
    const {
      topic,
      title,
      language = "english",
      sourceType = "ai",
      sourceLink,
    } = body;
    const pageCount = normalizePageCount(body?.pageCount);
    console.log("📝 Request body:", {
      topic: topic?.substring(0, 50),
      title,
      language,
      sourceType,
      hasSourceLink: Boolean(sourceLink),
    });

    if (!topic || topic.trim().length === 0) {
      console.error("❌ Topic is empty");
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    if (sourceLink && sourceType) {
      const existing = await Note.findOne({
        userId,
        sourceType,
        sourceLink,
      }).lean();

      if (existing) {
        return NextResponse.json(
          {
            note: existing,
            existing: true,
            message: "A note already exists for this source",
          },
          { status: 200 }
        );
      }
    }

    // Generate notes with Gemini, fallback to Grok
    console.log("🔄 Generating notes for topic:", topic, "in language:", language);
    const generatedContent = await generateNotesWithFallback(topic, pageCount, language);
    console.log("✅ Generated content length:", generatedContent.length);

    // Create and save note
    console.log("💾 Creating note in database");
    const note = new Note({
      userId,
      title: title || topic,
      content: generatedContent,
      sourceType,
      sourceLink: sourceLink || "",
      tags: [topic.toLowerCase()],
    });

    await note.save();
    console.log("✅ Note saved successfully:", note._id);

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Failed to generate note:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
