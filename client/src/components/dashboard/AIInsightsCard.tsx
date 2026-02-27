import { useEffect, useMemo, useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type AIInsights = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendedFocus: string[];
  nextGoal: string;
  motivationalMessage: string;
};

type AIInsightsCardProps = {
  insights: AIInsights | null;
  loading?: boolean;
  onRegenerate: () => void;
};

export function AIInsightsCard({ insights, loading, onRegenerate }: AIInsightsCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [typedSummary, setTypedSummary] = useState("");

  const summary = useMemo(() => insights?.summary || "Generate insights to get your personalized learning analysis.", [insights]);

  useEffect(() => {
    setTypedSummary("");
    let index = 0;

    const timer = setInterval(() => {
      index += 1;
      setTypedSummary(summary.slice(0, index));
      if (index >= summary.length) {
        clearInterval(timer);
      }
    }, 18);

    return () => clearInterval(timer);
  }, [summary]);

  return (
    <Card className="rounded-2xl border-white/20 bg-background/60 backdrop-blur-xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            🧠 AI Learning Insights
          </CardTitle>
          <p className="text-sm text-muted-foreground">Personalized trends, strengths, and next best actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading} className="gap-2 rounded-full">
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Regenerate Insights
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setExpanded((value) => !value)} aria-label="Toggle insights">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5">
          <div className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm leading-relaxed">{typedSummary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs mb-2 text-muted-foreground uppercase tracking-wide">Strengths</p>
              <div className="flex flex-wrap gap-2">
                {(insights?.strengths || []).map((item) => (
                  <Badge key={item} className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{item}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-2 text-muted-foreground uppercase tracking-wide">Weaknesses</p>
              <div className="flex flex-wrap gap-2">
                {(insights?.weaknesses || []).map((item) => (
                  <Badge key={item} className="bg-rose-500/10 text-rose-600 border-rose-500/20">{item}</Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Recommended Focus</p>
            <ul className="space-y-1 text-sm">
              {(insights?.recommendedFocus || []).map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border bg-background/70 p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Next Goal</p>
            <p className="font-medium">{insights?.nextGoal || "Set your next measurable goal."}</p>
            <p className="text-sm text-muted-foreground">{insights?.motivationalMessage || "Progress compounds with consistency."}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
