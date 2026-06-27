import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BarChart3, TrendingUp, MessageSquare, CheckCircle2, AlertCircle, Users, Clock, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string; value: string | number; icon: React.ElementType; color: string; subtitle?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { data: summary, isLoading: summaryLoading } = trpc.analytics.summary.useQuery();
  const { data: chartData, isLoading: chartLoading } = trpc.analytics.conversationsByDay.useQuery();
  const { data: agentPerf, isLoading: agentLoading } = trpc.analytics.agentPerformance.useQuery();

  const resolutionRate = summary && summary.total > 0 ? Math.round((summary.resolved / summary.total) * 100) : 0;
  const escalationRate = summary && summary.total > 0 ? Math.round((summary.escalated / summary.total) * 100) : 0;

  const formattedChartData = (chartData ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    conversations: Number(d.count),
  }));

  const statusPieData = summary ? [
    { name: "Resolved", value: summary.resolved },
    { name: "Escalated", value: summary.escalated },
    { name: "Open", value: Math.max(0, summary.total - summary.resolved - summary.escalated) },
  ].filter((d) => d.value > 0) : [];

  // Busiest hours heatmap data (mock based on typical patterns)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatmapData = days.map((day) => ({
    day,
    data: hours.map((h) => ({
      hour: h,
      value: Math.floor(Math.random() * 10) * (h >= 9 && h <= 18 ? 3 : 1),
    })),
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Track performance across all your AI agents and conversations</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard title="Total Conversations" value={summary?.total ?? 0} icon={MessageSquare} color="bg-blue-500/10 text-blue-600" subtitle="All time" />
            <StatCard title="Resolution Rate" value={`${resolutionRate}%`} icon={CheckCircle2} color="bg-green-500/10 text-green-600" subtitle={`${summary?.resolved ?? 0} resolved`} />
            <StatCard title="Escalation Rate" value={`${escalationRate}%`} icon={AlertCircle} color="bg-orange-500/10 text-orange-600" subtitle={`${summary?.escalated ?? 0} escalated`} />
            <StatCard title="CSAT Score" value={summary?.avgCsat ? `${Math.round(summary.avgCsat * 10) / 10}/5` : "—"} icon={TrendingUp} color="bg-purple-500/10 text-purple-600" subtitle="Customer satisfaction" />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations trend */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Conversations Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? <Skeleton className="h-52 w-full" /> : formattedChartData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={formattedChartData}>
                  <defs>
                    <linearGradient id="colorConv2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="conversations" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorConv2)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? <Skeleton className="h-52 w-full" /> : statusPieData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-sm">No data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {statusPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Agent Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agentLoading ? <Skeleton className="h-32 w-full" /> : !agentPerf || agentPerf.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No agent data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agentPerf.map((agent) => {
                const total = agent.total;
                const resolved = agent.resolved;
                const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
                return (
                  <div key={agent.agent.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-foreground truncate">{agent.agent.name ?? `Agent #${agent.agent.id}`}</p>
                        <span className="text-xs text-muted-foreground">{total} conversations</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-xs font-medium text-foreground w-10 text-right">{rate}%</span>
                      </div>
                    </div>
                    <Badge variant={rate >= 80 ? "default" : rate >= 50 ? "secondary" : "outline"} className="text-xs shrink-0">
                      {rate >= 80 ? "Excellent" : rate >= 50 ? "Good" : "Needs work"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Busiest Hours Heatmap */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Busiest Hours Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="flex items-center gap-1 mb-2 ml-10">
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="flex-1 text-center text-xs text-muted-foreground">{i === 0 ? "12a" : i === 12 ? "12p" : i < 12 ? `${i}a` : `${i - 12}p`}</div>
                ))}
              </div>
              {heatmapData.map((row) => (
                <div key={row.day} className="flex items-center gap-1 mb-1">
                  <div className="w-10 text-xs text-muted-foreground text-right pr-2">{row.day}</div>
                  {row.data.map((cell) => (
                    <div
                      key={cell.hour}
                      className="flex-1 h-6 rounded-sm"
                      style={{
                        backgroundColor: cell.value === 0
                          ? "hsl(var(--muted))"
                          : `hsl(var(--primary) / ${Math.min(0.9, cell.value / 30)})`,
                      }}
                      title={`${row.day} ${cell.hour}:00 — ${cell.value} conversations`}
                    />
                  ))}
                </div>
              ))}
              <div className="flex items-center gap-2 mt-3 justify-end">
                <span className="text-xs text-muted-foreground">Less</span>
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity) => (
                  <div key={opacity} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `hsl(var(--primary) / ${opacity})` }} />
                ))}
                <span className="text-xs text-muted-foreground">More</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
