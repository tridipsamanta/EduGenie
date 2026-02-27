import { Layout } from "@/components/Layout";
import { useAttempt, useFinishAttempt, useSubmitAttemptAnswer } from "@/hooks/use-data";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  question: string;
  options: string[];
  explanation?: string;
  topic?: string;
};

type AnswerState = {
  selectedOption: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
};

function formatSeconds(value: number) {
  const safe = Math.max(0, value);
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function QuizPlayer() {
  const { attemptId = "" } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useAttempt(attemptId);
  const { mutateAsync: submitAnswer, isPending: isSubmittingAnswer } = useSubmitAttemptAnswer();
  const { mutateAsync: finishAttempt, isPending: isFinishing } = useFinishAttempt();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  const [submittedMap, setSubmittedMap] = useState<Record<string, AnswerState>>({});
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const autoFinishedRef = useRef(false);

  const attempt = data?.attempt;
  const quiz = data?.quiz;
  const questions = (data?.questions ?? []) as Question[];

  // Redirect if attempt already completed
  useEffect(() => {
    if (attempt?.completedAt) {
      navigate(`/practice/result/${attemptId}`, { replace: true });
    }
  }, [attempt?.completedAt, attemptId, navigate]);

  useEffect(() => {
    if (!data?.answers) return;

    const nextSelected: Record<string, string> = {};
    const nextSubmitted: Record<string, AnswerState> = {};

    for (const answer of data.answers) {
      nextSelected[answer.questionId] = answer.selectedOption;
      if (typeof answer.isCorrect === "boolean" && answer.correctAnswer) {
        nextSubmitted[answer.questionId] = {
          selectedOption: answer.selectedOption,
          isCorrect: answer.isCorrect,
          correctAnswer: answer.correctAnswer,
          explanation: answer.explanation || "",
        };
      }
    }

    setSelectedMap((prev) => ({ ...nextSelected, ...prev }));
    setSubmittedMap((prev) => ({ ...nextSubmitted, ...prev }));
  }, [data?.answers]);

  useEffect(() => {
    if (!attempt?.startedAt || !attempt?.totalTimeSec || attempt?.completedAt) return;

    const tick = () => {
      const started = new Date(attempt.startedAt).getTime();
      const end = started + attempt.totalTimeSec * 1000;
      const next = Math.floor((end - Date.now()) / 1000);
      setRemainingSec(Math.max(0, next));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.startedAt, attempt?.totalTimeSec, attempt?.completedAt]);

  const finalizeAttempt = async () => {
    if (!attemptId || autoFinishedRef.current) return;
    autoFinishedRef.current = true;
    await finishAttempt({ attemptId });
    await refetch();
    navigate(`/practice/result/${attemptId}`);
  };

  useEffect(() => {
    if (!attempt || attempt.completedAt) return;
    if (remainingSec !== null && remainingSec <= 0 && !autoFinishedRef.current) {
      finalizeAttempt();
    }
  }, [remainingSec, attempt]);

  const currentQuestion = questions[currentIdx];

  const isCurrentSubmitted = useMemo(() => {
    if (!currentQuestion) return false;
    return Boolean(submittedMap[currentQuestion.id]);
  }, [currentQuestion, submittedMap]);

  const handleSelect = (value: string) => {
    if (!currentQuestion || isCurrentSubmitted || attempt?.completedAt) return;
    setSelectedMap((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleSubmitCurrent = async () => {
    if (!currentQuestion || !attemptId) return;
    const selectedOption = selectedMap[currentQuestion.id];
    if (!selectedOption) return;

    const result = await submitAnswer({
      attemptId,
      questionId: currentQuestion.id,
      selectedOption,
    });

    setSubmittedMap((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        selectedOption: result.selectedOption,
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation || "",
      },
    }));
  };

  const handleNext = async () => {
    if (!currentQuestion) return;

    if (currentIdx < questions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
      return;
    }

    await finalizeAttempt();
  };

  const handlePrevious = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center pt-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!attempt || !quiz || questions.length === 0) {
    return (
      <Layout>
        <div className="p-6">Attempt not found or has no questions.</div>
      </Layout>
    );
  }

  const selectedOption = currentQuestion ? selectedMap[currentQuestion.id] : "";
  const submitted = currentQuestion ? submittedMap[currentQuestion.id] : undefined;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">Timer: {remainingSec !== null ? formatSeconds(remainingSec) : "00:00"}</div>
          <div className="text-sm text-muted-foreground">
            Question {currentIdx + 1} / {questions.length}
          </div>
          <Button variant="ghost" onClick={() => navigate("/practice")}>Quit</Button>
        </div>

        <Card className="rounded-2xl shadow-sm border-border/50 min-h-[420px] flex flex-col">
          <CardContent className="p-8 flex-1 flex flex-col">
            <h3 className="text-2xl font-medium mb-8 leading-relaxed">{currentQuestion.question}</h3>

            <RadioGroup
              value={selectedOption || ""}
              onValueChange={handleSelect}
              className="space-y-4 flex-1"
            >
              {currentQuestion.options.map((option, idx) => {
                const isChosen = selectedOption === option;
                const isCorrect = submitted?.correctAnswer === option;
                const isWrongChosen = Boolean(submitted && isChosen && !submitted.isCorrect);

                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center space-x-3 rounded-xl border p-4 transition-all",
                      submitted
                        ? isCorrect
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : isWrongChosen
                            ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                            : "border-border"
                        : isChosen
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-secondary/20"
                    )}
                  >
                    <RadioGroupItem
                      value={option}
                      id={`opt-${idx}`}
                      disabled={Boolean(submitted)}
                    />
                    <Label htmlFor={`opt-${idx}`} className="flex-1 cursor-pointer text-base font-normal">
                      {option}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            {submitted?.explanation && (
              <div className="mt-6 rounded-lg border border-border/50 bg-secondary/20 p-4 text-sm">
                <span className="font-semibold">Explanation:</span> {submitted.explanation}
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-3">
              <Button variant="outline" onClick={handlePrevious} disabled={currentIdx === 0}>
                Previous
              </Button>

              <div className="flex items-center gap-3">
                {!isCurrentSubmitted ? (
                  <Button
                    onClick={handleSubmitCurrent}
                    disabled={!selectedOption || isSubmittingAnswer}
                  >
                    {isSubmittingAnswer ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                  </Button>
                ) : (
                  <Button onClick={handleNext} disabled={isFinishing}>
                    {isFinishing ? <Loader2 className="h-4 w-4 animate-spin" /> : currentIdx === questions.length - 1 ? "Finish" : "Next"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
