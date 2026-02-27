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

  if (!mongoose.Types.ObjectId.isValid(attemptId)) {
    return NextResponse.json({ error: "Invalid attemptId." }, { status: 400 });
  }

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }

  const quiz = await Quiz.findById(attempt.quizId).lean();
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  const answers = await AttemptAnswer.find({ attemptId: attempt._id }).lean();
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer]));

  let correctCount = 0;
  let wrongCount = 0;
  const weakTopicCounter = new Map<string, number>();

  for (const question of quiz.questions ?? []) {
    const questionId = question._id.toString();
    const answer = answerMap.get(questionId);
    const isCorrect = Boolean(answer?.isCorrect);

    if (isCorrect) {
      correctCount += 1;
    } else {
      wrongCount += 1;
      const topic = (question.topic || quiz.title || "General").trim();
      weakTopicCounter.set(topic, (weakTopicCounter.get(topic) || 0) + 1);
    }
  }

  const totalQuestions = quiz.questions.length || 1;
  const accuracy = Number(((correctCount / totalQuestions) * 100).toFixed(2));
  const score = accuracy;
  const weakTopics = [...weakTopicCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  attempt.completedAt = attempt.completedAt || new Date();
  attempt.score = score;
  attempt.accuracy = accuracy;
  attempt.weakTopics = weakTopics;
  await attempt.save();

  return NextResponse.json({
    attemptId: attempt._id.toString(),
    score,
    accuracy,
    correctCount,
    wrongCount,
    totalQuestions,
    weakTopics,
  });
}
