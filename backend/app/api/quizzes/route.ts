import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Quiz } from "@/models/Quiz";

export async function GET() {
  await connectDB();

  const quizzes = await Quiz.find({})
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(
    quizzes.map((quiz) => ({
      id: quiz._id.toString(),
      title: quiz.title,
      description: quiz.description,
      totalQuestions: quiz.totalQuestions,
      isGenerated: quiz.isGenerated,
      source: quiz.source,
      createdAt: quiz.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  await connectDB();

  const body = await request.json();
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const userId = body?.userId ? String(body.userId) : undefined;
  const timePerQuestionSec = Number(body?.timePerQuestionSec ?? 30);
  const isGenerated = Boolean(body?.isGenerated ?? false);
  const source = String(body?.source ?? "").trim();

  const rawQuestions = Array.isArray(body?.questions) ? body.questions : [];
  const questions = rawQuestions
    .map((item: any) => ({
      question: String(item?.question ?? "").trim(),
      options: Array.isArray(item?.options)
        ? item.options.map((option: unknown) => String(option).trim()).filter(Boolean)
        : [],
      correctAnswer: String(item?.correctAnswer ?? "").trim(),
      explanation: String(item?.explanation ?? "").trim(),
      topic: String(item?.topic ?? body?.topic ?? "").trim(),
    }))
    .filter(
      (item: any) =>
        item.question.length > 0 && item.options.length === 4 && item.correctAnswer.length > 0
    );

  if (!title) {
    return NextResponse.json({ error: "Quiz title is required." }, { status: 400 });
  }

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "At least one valid question is required." },
      { status: 400 }
    );
  }

  const quiz = await Quiz.create({
    userId,
    title,
    description,
    totalQuestions: questions.length,
    timePerQuestionSec: Math.min(120, Math.max(10, timePerQuestionSec || 30)),
    questions,
    isGenerated,
    source,
  });

  return NextResponse.json(
    {
      id: quiz._id.toString(),
      title: quiz.title,
      description: quiz.description,
      totalQuestions: quiz.totalQuestions,
      isGenerated: quiz.isGenerated,
      source: quiz.source,
      createdAt: quiz.createdAt,
    },
    { status: 201 }
  );
}
