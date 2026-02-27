import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { Quiz } from "@/models/Quiz";
import { Attempt } from "@/models/Attempt";

export async function POST(request: NextRequest) {
  await connectDB();

  const body = await request.json();
  const quizId = String(body?.quizId ?? "").trim();
  const userId = body?.userId ? String(body.userId) : undefined;

  if (!mongoose.Types.ObjectId.isValid(quizId)) {
    return NextResponse.json({ error: "Invalid quizId." }, { status: 400 });
  }

  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    return NextResponse.json(
      { error: "Quiz has no questions." },
      { status: 400 }
    );
  }

  const totalTimeSec = quiz.questions.length * (quiz.timePerQuestionSec || 30);

  const attempt = await Attempt.create({
    userId,
    quizId: quiz._id,
    startedAt: new Date(),
    totalTimeSec,
  });

  return NextResponse.json({
    attemptId: attempt._id.toString(),
    quizId: quiz._id.toString(),
  });
}
