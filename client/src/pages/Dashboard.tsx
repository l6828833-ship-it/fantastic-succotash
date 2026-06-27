import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Bot,
  MessageSquare,
  TrendingUp,
  Users,
  Ticket,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  BarChart3,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function StatCard({ title, value, icon: Icon, trend, color }: {
  title: string; value: string | number; icon: React.ElementType; trend?: string; color: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: workspace } = trpc.workspace.get.useQuery();
  const { data: summary, isLoading: summaryLoading } = trpc.analytics.summary.useQuery();
  const { data: chartData, isLoading: chartLoading } = trpc.analytics.conversationsByDay.useQuery();
  const { data: agents } = trpc.agent.list.useQuery();
  const { data: conversations } = trpc.inbox.listConversations.useQuery({ status: "open" });
  const { data: tickets } = trpc.tickets.list.useQuery({ status: "open" });

  const resolutionRate = summary && summary.total > 0
    ? Math.round((summary.resolved / summary.total) * 100)
    : 0;
  const escalationRate = summary && summary.total > 0
    ? Math.round((summary.escalated / summary.total) * 100)
    : 0;

  const formattedChartData = (chartData ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    conversations: Number(d.count),
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {workspace?.companyName ? `${workspace.companyName} · ` : ""}Here's what's happening today
          </p>
        </div>
        <Link href="/agents">
          <Button className="gap-2">
            <Bot className="w-4 h-4" />
            Manage Agents
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard title="Total Conversations" value={summary?.total ?? 0} icon={MessageSquare} trend="All time" color="bg-blue-500/10 text-blue-600" />
            <StatCard title="Resolution Rate" value={`${resolutionRate}%`} icon={CheckCircle2} trend={`${summary?.resolved ?? 0} resolved`} color="bg-green-500/10 text-green-600" />
            <StatCard title="Escalation Rate" value={`${escalationRate}%`} icon={AlertCircle} trend={`${summary?.escalated ?? 0} escalated`} color="bg-orange-500/10 text-orange-600" />
            <StatCard title="CSAT Score" value={summary?.avgCsat ? `${Math.round(summary.avgCsat * 10) / 10}/5` : "—"} icon={TrendingUp} trend="Customer satisfaction" color="bg-purple-500/10 text-purple-600" />
          </>
        )}
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Conversations (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : formattedChartData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No conversation data yet</p>
                <p className="text-xs">Start chatting to see analytics</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={formattedChartData}>
                  <defs>
                    <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="conversations" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorConv)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {[
                { href: "/agents", icon: Bot, label: "Configure Agent", desc: "Customize AI behavior" },
                { href: "/inbox", icon: MessageSquare, label: "Open Inbox", desc: `${conversations?.length ?? 0} open conversations`, badge: conversations?.length },
                { href: "/tickets", icon: Ticket, label: "View Tickets", desc: `${tickets?.length ?? 0} open tickets`, badge: tickets?.length },
                { href: "/campaigns", icon: Megaphone, label: "New Campaign", desc: "Send broadcast message" },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Agents overview */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              AI Agents
            </CardTitle>
            <Link href="/agents">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!agents || agents.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No agents configured yet</p>
              <Link href="/agents">
                <Button size="sm" className="mt-3 gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Create Your First Agent
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.slice(0, 6).map((agent) => (
                <Link key={agent.id} href={`/agents/${agent.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/30 cursor-pointer transition-all group">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant={agent.isActive ? "default" : "secondary"} className="text-xs px-1.5 py-0 h-4">
                          {agent.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {agent.handoffMode?.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
