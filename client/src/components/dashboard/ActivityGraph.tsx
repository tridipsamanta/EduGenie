import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WeeklyActivityPoint = { date: string; activity: number };
type DailyMinutesPoint = { date: string; minutes: number };
type FeatureUsage = { feature: string; value: number };

type ActivityGraphProps = {
  weeklyActivity: WeeklyActivityPoint[];
  dailyStudyMinutes: DailyMinutesPoint[];
  featureUsage: FeatureUsage[];
};

const chartPalette = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
];

export function ActivityGraph({ weeklyActivity, dailyStudyMinutes, featureUsage }: ActivityGraphProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card className="rounded-2xl border-border/60 shadow-sm xl:col-span-2">
        <CardHeader>
          <CardTitle>Weekly Activity Line Graph</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="activity" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Feature Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={featureUsage} dataKey="value" nameKey="feature" innerRadius={55} outerRadius={85}>
                {featureUsage.map((entry, index) => (
                  <Cell key={entry.feature} fill={chartPalette[index % chartPalette.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm xl:col-span-3">
        <CardHeader>
          <CardTitle>Daily Study Minutes Bar Chart</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyStudyMinutes}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
              <Tooltip formatter={(value: number) => [`${value} min`, "Study"]} />
              <Bar dataKey="minutes" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
