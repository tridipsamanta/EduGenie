import { Layout } from "@/components/Layout";
import { useStats, useQuizzes } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Trophy,
  Clock3,
  Plus,
  NotebookPen,
  Sparkles,
  Layers3,
  BookOpen,
  GraduationCap,
  Flame,
  ArrowUpRight,
  Wand2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AIInsightsCard, type AIInsights } from "@/components/dashboard/AIInsightsCard";
import { GoalTracker } from "@/components/dashboard/GoalTracker";
import { HeatmapTable } from "@/components/dashboard/HeatmapTable";
import { ActivityGraph } from "@/components/dashboard/ActivityGraph";
import { useEffect, useMemo, useState } from "react";

type StatsData = {
  totalCourses?: number;
  totalChapters?: number;
  totalLessons?: number;
  totalQuizzes?: number;
  totalMcqGenerated?: number;
  totalNotes?: number;
  averageScore?: number;
  totalStudyTime?: number;
  totalMcqTimeMinutes?: number;
  totalNotesTimeMinutes?: number;
  weakTopics?: string[];
  strongTopics?: string[];
  weeklyStudyStreak?: number;
  weeklyActivity?: Array<{ date: string; activity: number }>;
  dailyStudyMinutes?: Array<{ date: string; minutes: number }>;
  featureUsage?: Array<{ feature: string; value: number }>;
  recentActivity?: Array<{ type?: string; title?: string; at?: string }>;
  topicPerformance?: Array<{
    topic: string;
    attempts: number;
    avgScore: number;
    status: "strong" | "medium" | "weak";
  }>;
  activityTrend?: Array<{
    date: string;
    notesCreated: number;
    mcqGenerated: number;
    notesTimeMin: number;
    mcqTimeMin: number;
  }>;
  performanceHistory?: Array<{ name: string; score: number }>;
};

type QuizItem = {
  id: string;
  title: string;
  createdAt?: string;
};

export default function Dashboard() {
  const { data: rawStats, isLoading: statsLoading } = useStats();
  const { data: quizzes, isLoading: quizzesLoading } = useQuizzes();
  const [insightsLoading, setInsightsLoading] = useState(false);

  const [insights, setInsights] = useState<AIInsights | null>(null);

  const stats = (rawStats || {}) as StatsData;
  const quizList = ((quizzes as QuizItem[] | undefined) || []);

  const recentQuizzes = quizList.slice(0, 3);
  const dailyStudyMinutesData = Array.isArray(stats.dailyStudyMinutes) ? stats.dailyStudyMinutes : [];
  const activityTrendData = Array.isArray(stats.activityTrend) ? stats.activityTrend : [];
  const weeklyActivityData = Array.isArray(stats.weeklyActivity) ? stats.weeklyActivity : [];
  const featureUsageData = Array.isArray(stats.featureUsage) ? stats.featureUsage : [];
  const weakTopics = Array.isArray(stats.weakTopics) ? stats.weakTopics : [];
  const strongTopics = Array.isArray(stats.strongTopics) ? stats.strongTopics : [];
  const recentActivityData = Array.isArray(stats.recentActivity) ? stats.recentActivity : [];
  const topicPerformanceData = Array.isArray(stats.topicPerformance) ? stats.topicPerformance : [];

  const totalStudyHours = Math.round((stats.totalStudyTime || 0) / 3600);
  const weeklyStudyMinutes = useMemo(
    () => dailyStudyMinutesData.reduce((sum, day) => sum + (day.minutes || 0), 0),
    [dailyStudyMinutesData]
  );
  const weeklyMcq = useMemo(
    () => activityTrendData.reduce((sum, day) => sum + (day.mcqGenerated || 0), 0),
    [activityTrendData]
  );

  const smartSuggestions = useMemo(() => {
    const suggestions: string[] = [];
    const weak = weakTopics;

    if (weak[0]) suggestions.push(`Revise ${weak[0]} (Weak topic)`);
    suggestions.push("Practice 10 MCQs on your lowest-scoring area");
    suggestions.push("Continue your current course chapter");

    return suggestions.slice(0, 3);
  }, [weakTopics]);

  async function regenerateInsights() {
    try {
      setInsightsLoading(true);
      const response = await fetch("/api/ai/analyze-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        totalCourses: Number(stats.totalCourses || 0),
        totalNotes: Number(stats.totalNotes || 0),
        avgScore: Number(stats.averageScore || 0),
        weakTopics,
        strongTopics,
        studyTime: Number(stats.totalStudyTime || 0),
        recentActivity: recentActivityData,
      }),
      });

      if (!response.ok) throw new Error("Failed to analyze dashboard insights");
      const data = (await response.json()) as AIInsights;
      setInsights(data);
    } catch {
      setInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  }

  useEffect(() => {
    if (statsLoading) return;
    regenerateInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsLoading, stats.totalCourses, stats.totalNotes, stats.averageScore]);

  const metricCards = [
    {
      title: "Total Courses",
      value: stats.totalCourses || 0,
      icon: BookOpen,
      gradient: "from-primary/10 via-primary/5 to-transparent",
    },
    {
      title: "Total Chapters",
      value: stats.totalChapters || 0,
      icon: Layers3,
      gradient: "from-violet-500/10 via-violet-500/5 to-transparent",
    },
    {
      title: "Total Lessons",
      value: stats.totalLessons || 0,
      icon: GraduationCap,
      gradient: "from-cyan-500/10 via-cyan-500/5 to-transparent",
    },
    {
      title: "Total MCQs Generated",
      value: stats.totalMcqGenerated || 0,
      icon: Sparkles,
      gradient: "from-fuchsia-500/10 via-fuchsia-500/5 to-transparent",
    },
    {
      title: "Total Notes Created",
      value: stats.totalNotes || 0,
      icon: NotebookPen,
      gradient: "from-sky-500/10 via-sky-500/5 to-transparent",
    },
    {
      title: "Average Quiz Score",
      value: `${Math.round(stats.averageScore || 0)}%`,
      icon: Trophy,
      gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    },
    {
      title: "Total Study Time",
      value: `${totalStudyHours}h`,
      icon: Clock3,
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    },
    {
      title: "Weekly Study Streak 🔥",
      value: stats.weeklyStudyStreak || 0,
      icon: Flame,
      gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    },
  ];

  return (
    <Layout>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,theme(colors.primary/.12),transparent_45%)]" />

      <div className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Welcome back!</h1>
          <p className="text-muted-foreground">Here's an overview of your learning progress.</p>
        </div>
        <Link to="/generator">
          <Button className="rounded-full gap-2 shadow-lg shadow-primary/25">
            <Plus className="h-4 w-4" />
            New Quiz
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        {metricCards.map((metric) => (
          <EnhancedStatsCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            gradient={metric.gradient}
            loading={statsLoading}
          />
        ))}
      </div>

      <AIInsightsCard insights={insights} loading={insightsLoading} onRegenerate={regenerateInsights} />

      <Separator className="my-8" />

      <GoalTracker
        avgScore={Number(stats.averageScore || 0)}
        studyMinutes={weeklyStudyMinutes}
        weeklyMcqCount={weeklyMcq}
      />

      <Separator className="my-8" />

      {statsLoading ? (
        <Skeleton className="h-[340px] w-full rounded-2xl" />
      ) : (
        <HeatmapTable rows={topicPerformanceData} />
      )}

      <Separator className="my-8" />

      {statsLoading ? (
        <Skeleton className="h-[620px] w-full rounded-2xl" />
      ) : (
        <ActivityGraph
          weeklyActivity={weeklyActivityData}
          dailyStudyMinutes={dailyStudyMinutesData}
          featureUsage={featureUsageData}
        />
      )}

      <Separator className="my-8" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <Card className="rounded-2xl border-border/60 shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Recommended Next Action
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {smartSuggestions.map((item) => (
              <button
                key={item}
                type="button"
                className="w-full text-left rounded-xl border bg-secondary/30 px-4 py-3 text-sm hover:bg-secondary/50 transition-colors"
              >
                • {item}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Quizzes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quizzesLoading ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
            ) : recentQuizzes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No quizzes taken yet.</div>
            ) : (
              recentQuizzes.map((quiz: QuizItem) => (
                <div key={quiz.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors border border-transparent hover:border-border">
                  <div>
                    <h4 className="font-semibold text-sm leading-tight">{quiz.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(quiz.createdAt || "").toLocaleDateString()}</p>
                  </div>
                  <Link to={`/quiz/${quiz.id}`}>
                    <Button variant="ghost" size="sm" className="rounded-full">
                      View
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function EnhancedStatsCard({
  title,
  value,
  icon: Icon,
  loading,
  gradient,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  gradient: string;
}) {
  return (
    <Card className={`rounded-2xl border-border/50 bg-gradient-to-br ${gradient} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-background/80 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="flex items-end justify-between">
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <h3 className="text-3xl font-display font-bold">{value}</h3>
          )}
          <p className="text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
            <ArrowUpRight className="h-3.5 w-3.5" />
            12% this week
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
