import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Attempt } from "@/models/Attempt";
import { AttemptAnswer } from "@/models/AttemptAnswer";
import { Quiz } from "@/models/Quiz";

type Context = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: Context) {
  await connectDB();

  const attempt = await Attempt.findById(params.id).lean();
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }

  const quiz = await Quiz.findById(attempt.quizId).lean();
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }

  const answers = await AttemptAnswer.find({ attemptId: attempt._id }).lean();
  const isCompleted = Boolean(attempt.completedAt);

  return NextResponse.json({
    attempt: {
      id: attempt._id.toString(),
      quizId: quiz._id.toString(),
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      score: attempt.score,
      accuracy: attempt.accuracy,
      weakTopics: attempt.weakTopics || [],
      totalTimeSec: attempt.totalTimeSec,
    },
    quiz: {
      id: quiz._id.toString(),
      title: quiz.title,
      description: quiz.description,
      totalQuestions: quiz.totalQuestions,
      createdAt: quiz.createdAt,
    },
    questions: (quiz.questions ?? []).map((question: any) => ({
      id: question._id.toString(),
      question: question.question,
      options: question.options,
      explanation: question.explanation || "",
      topic: question.topic || "",
      ...(isCompleted ? { correctAnswer: question.correctAnswer } : {}),
    })),
    answers: answers.map((answer) => {
      const question = (quiz.questions ?? []).find(
        (item: any) => item._id.toString() === answer.questionId
      );

      return {
        questionId: answer.questionId,
        selectedOption: answer.selectedOption,
        isCorrect: answer.isCorrect,
        ...(isCompleted
          ? {
              correctAnswer: question?.correctAnswer ?? "",
              explanation: question?.explanation ?? "",
            }
          : {}),
      };
    }),
  });
}
