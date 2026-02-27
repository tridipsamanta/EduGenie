import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

type MCQQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

function extractJSONArray(raw: string): string {
  const withoutCodeFence = raw.replace(/```json|```/gi, "").trim();
  const start = withoutCodeFence.indexOf("[");
  const end = withoutCodeFence.lastIndexOf("]");

  if (start >= 0 && end > start) {
    return withoutCodeFence.slice(start, end + 1);
  }

  return withoutCodeFence;
}

function normalizeQuestions(data: unknown): MCQQuestion[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const maybe = item as Partial<MCQQuestion>;
      const options = Array.isArray(maybe.options)
        ? maybe.options.map((option) => String(option).trim()).filter(Boolean)
        : [];

      const question = String(maybe.question ?? "").trim();
      const correctAnswer = String(maybe.correctAnswer ?? "").trim();
      const explanation = String(maybe.explanation ?? "").trim();

      return {
        question,
        options,
        correctAnswer,
        explanation,
      };
    })
    .filter(
      (item) =>
        item.question.length > 0 &&
        item.options.length === 4 &&
        item.correctAnswer.length > 0
    );
}

export async function POST(request: NextRequest) {
  try {
    const groqApiKey =
      process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROCK_API_KEY;

    if (!groqApiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const groq = new Groq({ apiKey: groqApiKey });

    const body = await request.json();
    const topic = String(body?.topic ?? "").trim();
    const difficulty = String(body?.difficulty ?? "medium").trim();
    const questionType = String(body?.questionType ?? "school").trim();
    const sourceText = String(body?.sourceText ?? "").trim();
    const numberOfQuestionsRaw = Number(body?.numberOfQuestions ?? 5);
    const numberOfQuestions = Number.isFinite(numberOfQuestionsRaw)
      ? Math.min(20, Math.max(1, Math.floor(numberOfQuestionsRaw)))
      : 5;

    if (!topic) {
      return NextResponse.json({ error: "Topic is required." }, { status: 400 });
    }

    const prompt = `Generate ${numberOfQuestions} ${difficulty} level ${questionType} multiple choice questions on:

Topic: ${topic}
Source Text: ${sourceText || "General knowledge"}

Rules:
- Make questions tricky but concept-based.
- Avoid obvious answers.
- Ensure options are similar length.
- Ensure only ONE correct answer.

Return ONLY valid JSON in this format:

[
  {
    "question": "string",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "exact correct option text",
    "explanation": "short explanation"
  }
]

Do NOT return text outside JSON.`;

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const responseText = completion.choices?.[0]?.message?.content ?? "";
    const cleaned = extractJSONArray(responseText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Model returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }

    const questions = normalizeQuestions(parsed);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "Could not generate valid MCQs. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("MCQ generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate MCQs" },
      { status: 500 }
    );
  }
}
