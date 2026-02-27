import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type TopicPerformance = {
  topic: string;
  attempts: number;
  avgScore: number;
  status: "strong" | "medium" | "weak";
};

type HeatmapTableProps = {
  rows: TopicPerformance[];
};

function statusBadge(status: TopicPerformance["status"]) {
  if (status === "strong") {
    return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Strong</Badge>;
  }

  if (status === "medium") {
    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">Improving</Badge>;
  }

  return <Badge className="bg-rose-500/10 text-rose-700 border-rose-500/20">Weak</Badge>;
}

export function HeatmapTable({ rows }: HeatmapTableProps) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle>📊 Topic Performance Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Topic</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Avg Score</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">No performance data yet.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.topic}>
                  <TableCell className="font-medium">{row.topic}</TableCell>
                  <TableCell>{row.attempts}</TableCell>
                  <TableCell>{row.avgScore}%</TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
