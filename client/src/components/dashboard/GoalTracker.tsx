import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

type GoalTrackerProps = {
  avgScore: number;
  studyMinutes: number;
  weeklyMcqCount: number;
};

export function GoalTracker({ avgScore, studyMinutes, weeklyMcqCount }: GoalTrackerProps) {
  const [targetScore, setTargetScore] = useState(80);
  const [dailyStudyTarget, setDailyStudyTarget] = useState(60);
  const [weeklyMcqTarget, setWeeklyMcqTarget] = useState(50);

  const scoreProgress = clampPercent((avgScore / Math.max(1, targetScore)) * 100);
  const weeklyStudyTargetMinutes = dailyStudyTarget * 7;
  const studyProgress = clampPercent((studyMinutes / Math.max(1, weeklyStudyTargetMinutes)) * 100);
  const practiceProgress = clampPercent((weeklyMcqCount / Math.max(1, weeklyMcqTarget)) * 100);

  const projectedDays = useMemo(() => {
    const scoreGap = Math.max(0, targetScore - avgScore);
    const expectedDailyImprovement = Math.max(0.4, avgScore / 45);
    return Math.max(1, Math.ceil(scoreGap / expectedDailyImprovement));
  }, [avgScore, targetScore]);

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm transition-all hover:shadow-md">
      <CardHeader>
        <CardTitle>Future Goal Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Target Score (%)</p>
            <Input type="number" min={1} max={100} value={targetScore} onChange={(event) => setTargetScore(Number(event.target.value || 0))} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Daily Study Target (min)</p>
            <Input type="number" min={1} value={dailyStudyTarget} onChange={(event) => setDailyStudyTarget(Number(event.target.value || 0))} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Weekly MCQ Target</p>
            <Input type="number" min={1} value={weeklyMcqTarget} onChange={(event) => setWeeklyMcqTarget(Number(event.target.value || 0))} />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span>Score Progress</span>
              <span className="text-muted-foreground">{Math.round(scoreProgress)}%</span>
            </div>
            <Progress value={scoreProgress} />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span>Study Time Progress</span>
              <span className="text-muted-foreground">{Math.round(studyProgress)}%</span>
            </div>
            <Progress value={studyProgress} />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span>Practice Progress</span>
              <span className="text-muted-foreground">{Math.round(practiceProgress)}%</span>
            </div>
            <Progress value={practiceProgress} />
          </div>
        </div>

        <p className="rounded-xl border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          At your current pace, you will reach {targetScore}% in approximately {projectedDays} days.
        </p>
      </CardContent>
    </Card>
  );
}
