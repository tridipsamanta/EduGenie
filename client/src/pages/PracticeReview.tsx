import { Layout } from "@/components/Layout";
import { useAttempt } from "@/hooks/use-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function PracticeReview() {
  const { attemptId = "" } = useParams<{ attemptId: string }>();
  const { data, isLoading } = useAttempt(attemptId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center pt-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Layout>
    );
  }

  const attempt = data?.attempt;
  const questions = data?.questions ?? [];
  const answerMap = new Map<string, any>(
    (data?.answers ?? []).map((answer: any) => [answer.questionId, answer])
  );

  if (!attempt || !attempt.completedAt) {
    return (
      <Layout>
        <div className="p-6">Review is available only after finishing the attempt.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Review Answers</h1>
          <Button variant="outline" onClick={() => navigate(`/practice/result/${attemptId}`)}>
            Back to Result
          </Button>
        </div>

        {questions.map((question: any, idx: number) => {
          const answer = answerMap.get(question.id);
          const selectedOption = answer?.selectedOption || "Not answered";
          const isCorrect = Boolean(answer?.isCorrect);
          const correctAnswer = answer?.correctAnswer || question.correctAnswer || "";
          const explanation = answer?.explanation || question.explanation || "";

          return (
            <Card key={question.id} className={cn("border-l-4", isCorrect ? "border-l-green-500" : "border-l-red-500")}>
              <CardContent className="p-6 space-y-3">
                <p className="font-semibold">Q{idx + 1}. {question.question}</p>
                <p className="text-sm">
                  Your answer: <span className={cn("font-medium", isCorrect ? "text-green-600" : "text-red-600")}>{selectedOption}</span>
                </p>
                <p className="text-sm">
                  Correct answer: <span className="font-medium text-green-700">{correctAnswer}</span>
                </p>
                {explanation && (
                  <div className="rounded-md bg-secondary/30 border border-border/50 p-3 text-sm">
                    <span className="font-semibold">Explanation:</span> {explanation}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Layout>
  );
}
