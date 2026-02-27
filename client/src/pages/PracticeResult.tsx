import { Layout } from "@/components/Layout";
import { useAttempt, useStartAttempt } from "@/hooks/use-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export default function PracticeResult() {
  const { attemptId = "" } = useParams<{ attemptId: string }>();
  const { data, isLoading } = useAttempt(attemptId);
  const { mutateAsync: startAttempt, isPending: isRetrying } = useStartAttempt();
  const navigate = useNavigate();
  const { user } = useAuth();

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
  const quiz = data?.quiz;
  const questions = data?.questions ?? [];
  const answers = data?.answers ?? [];

  if (!attempt || !quiz) {
    return (
      <Layout>
        <div className="p-6">Result not found.</div>
      </Layout>
    );
  }

  const correctCount = answers.filter((answer: any) => answer.isCorrect).length;
  const wrongCount = Math.max(0, questions.length - correctCount);

  const handleRetry = async () => {
    const response = await startAttempt({ quizId: quiz.id, userId: user?.id });
    navigate(`/practice/${response.attemptId}`);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h1 className="text-3xl font-bold">Result</h1>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="text-2xl font-semibold">{Math.round(attempt.score || 0)}%</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Accuracy</p>
                <p className="text-2xl font-semibold">{Math.round(attempt.accuracy || 0)}%</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Correct / Wrong</p>
                <p className="text-2xl font-semibold">{correctCount} / {wrongCount}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Correct vs Wrong</p>
              <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${questions.length ? (correctCount / questions.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-medium">Weak Topics</p>
              {attempt.weakTopics?.length ? (
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {attempt.weakTopics.map((topic: string) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No major weak topic detected.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="font-medium">Recommended Revision</p>
              <p className="text-sm text-muted-foreground">
                Focus on weak topics first, then reattempt this quiz and compare your score trend.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleRetry} disabled={isRetrying}>
                {isRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Retry Quiz"}
              </Button>
              <Button variant="outline" onClick={() => navigate(`/practice/review/${attemptId}`)}>
                Review Answers
              </Button>
              <Button variant="ghost" onClick={() => navigate("/chat")}>
                Generate Revision Plan (AI)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
