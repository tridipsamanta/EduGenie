import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { Quiz } from "@/models/Quiz";
import { getNotesUserId } from "@/lib/auth";
import { GROQ_API_KEY, GROQ_API_BASE, MODEL_NAME } from "@/lib/ai-config";
import mongoose from "mongoose";

const MCQ_GENERATION_PROMPT = `Generate 5-10 multiple choice questions from this study material for exam practice.

FORMAT (return JSON only):
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0,
      "explanation": "Why this is correct",
      "difficulty": "easy|medium|hard",
      "topic": "main topic"
    }
  ]
}

Rules:
- Make questions clear and exam-oriented
- Mix question types (definition, concept, application, analysis)
- Include varying difficulty levels
- Ensure explanations are educational
- Each question should test one concept
- Make wrong options plausible but clearly incorrect

Return ONLY valid JSON, no markdown markers.`;

async function generateMCQsWithGroq(content: string): Promise<any[]> {
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
            content: MCQ_GENERATION_PROMPT,
          },
          {
            role: "user",
            content: content,
          },
        ],
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content_text = data.choices[0]?.message?.content || "{}";
    
    // Parse JSON from response
    const jsonMatch = content_text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.questions || [];
  } catch (error) {
    console.error("Error generating MCQs with Groq:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const body = await request.json();
    const { noteId } = body;

    if (!noteId) {
      return NextResponse.json(
        { error: "Note ID is required" },
        { status: 400 }
      );
    }

    // Fetch the note
    const note = await Note.findOne({
      _id: new mongoose.Types.ObjectId(noteId),
      userId,
      isDeleted: false,
    }).lean();

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Generate MCQs
    const questions = await generateMCQsWithGroq(note.content);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate questions" },
        { status: 500 }
      );
    }

    // Create quiz from MCQs
    const quiz = new Quiz({
      title: `Quiz: ${note.title}`,
      description: `Auto-generated quiz from note: ${note.title}`,
      totalQuestions: questions.length,
      questions: questions.map((q: any) => ({
        question: q.question,
        options: q.options,
        correctOption: q.correctOptionIndex,
        explanation: q.explanation,
        topic: q.topic || note.tags?.[0] || "General",
      })),
      createdBy: userId,
      sourceNoteId: note._id,
    });

    await quiz.save();

    return NextResponse.json(
      {
        quiz,
        message: "Quiz generated successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to generate MCQ:", error);
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}
