import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { Attempt } from "@/models/Attempt";
import { AttemptAnswer } from "@/models/AttemptAnswer";
import { Quiz } from "@/models/Quiz";

export async function POST(request: NextRequest) {
  await connectDB();

  const body = await request.json();
  const attemptId = String(body?.attemptId ?? "").trim();
  const questionId = String(body?.questionId ?? "").trim();
  const selectedOption = String(body?.selectedOption ?? "").trim();

  if (
    !mongoose.Types.ObjectId.isValid(attemptId) ||
    !questionId ||
    !selectedOption
  ) {
    return NextResponse.json({ error: "Invalid answer payload." }, { status: 400 });
  }

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }

  if (attempt.completedAt) {
    return NextResponse.json(
      { error: "Attempt already completed." },
      { status: 400 }
    );
  }

  const quiz = await Quiz.findById(attempt.quizId);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  const question = quiz.questions.find(
    (item: any) => item._id.toString() === questionId
  );

  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  if (!question.options.includes(selectedOption)) {
    return NextResponse.json(
      { error: "Selected option is invalid." },
      { status: 400 }
    );
  }

  const isCorrect = selectedOption === question.correctAnswer;

  await AttemptAnswer.findOneAndUpdate(
    { attemptId: attempt._id, questionId },
    {
      attemptId: attempt._id,
      questionId,
      selectedOption,
      isCorrect,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({
    questionId,
    selectedOption,
    isCorrect,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation || "",
  });
}
