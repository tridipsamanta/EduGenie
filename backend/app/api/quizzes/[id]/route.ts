import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Quiz } from "@/models/Quiz";

type Context = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: Context) {
  await connectDB();

  const quiz = await Quiz.findById(params.id).lean();
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: quiz._id.toString(),
    title: quiz.title,
    description: quiz.description,
    totalQuestions: quiz.totalQuestions,
    createdAt: quiz.createdAt,
    questions: (quiz.questions ?? []).map((question: any) => ({
      id: question._id.toString(),
      question: question.question,
      options: question.options,
      explanation: question.explanation || "",
      topic: question.topic || "",
    })),
  });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  await connectDB();

  const quiz = await Quiz.findByIdAndDelete(params.id);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  return NextResponse.json({ 
    message: "Quiz deleted successfully.",
    id: params.id
  });
}
