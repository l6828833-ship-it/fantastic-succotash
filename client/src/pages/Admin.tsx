import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Shield, Users, Building2, Bot, MessageSquare, Ticket, Contact, ShieldCheck, ShieldOff, Gift, Wallet, Check, X, DollarSign, Eye, CreditCard, Activity, Gauge, Ban, Trash2, Download, Code, TrendingUp, FileText } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const PLAN_OPTIONS = ["free", "starter", "pro", "business", "enterprise"];

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";

  const { data: stats } = trpc.admin.stats.useQuery(undefined, { enabled: isAdmin });
  const { data: users = [] } = trpc.admin.users.useQuery(undefined, { enabled: isAdmin });
  const { data: workspaces = [] } = trpc.admin.workspaces.useQuery(undefined, { enabled: isAdmin });

  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { utils.admin.users.invalidate(); utils.admin.stats.invalidate(); toast.success("Role updated"); },
    onError: () => toast.error("Failed to update role"),
  });
  const setPlan = trpc.admin.setWorkspacePlan.useMutation({
    onSuccess: () => { utils.admin.workspaces.invalidate(); toast.success("Plan updated"); },
    onError: () => toast.error("Failed to update plan"),
  });

  const { data: affiliates = [] } = trpc.admin.affiliates.useQuery(undefined, { enabled: isAdmin });
  const { data: payouts = [] } = trpc.admin.payouts.useQuery(undefined, { enabled: isAdmin });
  const { data: payments = [] } = trpc.admin.payments.useQuery(undefined, { enabled: isAdmin });
  const { data: usageRows = [] } = trpc.admin.usage.useQuery(undefined, { enabled: isAdmin });
  const { data: activity = [] } = trpc.admin.activity.useQuery(undefined, { enabled: isAdmin });
  const { data: revenue } = trpc.admin.revenue.useQuery(undefined, { enabled: isAdmin });
  const { data: health } = trpc.admin.health.useQuery(undefined, { enabled: isAdmin });
  const [adjDrafts, setAdjDrafts] = useState<Record<number, string>>({});
  const [viewAff, setViewAff] = useState<{ id: number; label: string } | null>(null);
  const [search, setSearch] = useState({ users: "", ws: "", billing: "", usage: "" });
  const [rowLimit, setRowLimit] = useState(100);
  const { data: affReferrals = [] } = trpc.admin.affiliateReferrals.useQuery(
    { affiliateId: viewAff?.id ?? 0 },
    { enabled: isAdmin && !!viewAff },
  );
  const setAdjustment = trpc.admin.setAffiliateAdjustment.useMutation({
    onSuccess: () => { utils.admin.affiliates.invalidate(); toast.success("Adjustment saved"); },
    onError: () => toast.error("Failed to save adjustment"),
  });
  const setPayoutStatus = trpc.admin.setPayoutStatus.useMutation({
    onSuccess: () => { utils.admin.payouts.invalidate(); utils.admin.affiliates.invalidate(); toast.success("Payout updated"); },
    onError: () => toast.error("Failed to update payout"),
  });

  // Account moderation + billing + settings.
  const suspendUser = trpc.admin.setUserSuspended.useMutation({
    onSuccess: () => { utils.admin.users.invalidate(); toast.success("Account updated"); },
    onError: (e) => toast.error(e.message || "Failed"),
  });
  const deleteUserM = trpc.admin.deleteUser.useMutation({
    onSuccess: () => { utils.admin.users.invalidate(); utils.admin.workspaces.invalidate(); utils.admin.stats.invalidate(); toast.success("User deleted"); },
    onError: (e) => toast.error(e.message || "Failed to delete user"),
  });
  const deleteWsM = trpc.admin.deleteWorkspace.useMutation({
    onSuccess: () => { utils.admin.workspaces.invalidate(); utils.admin.usage.invalidate(); utils.admin.stats.invalidate(); toast.success("Workspace deleted"); },
    onError: (e) => toast.error(e.message || "Failed to delete workspace"),
  });
  const refundM = trpc.admin.refundPayment.useMutation({
    onSuccess: () => { utils.admin.payments.invalidate(); toast.success("Marked as refunded"); },
    onError: (e) => toast.error(e.message || "Failed to refund"),
  });
  const { data: logs = [] } = trpc.admin.logs.useQuery(undefined, { enabled: isAdmin });
  const { data: growth } = trpc.admin.growth.useQuery(undefined, { enabled: isAdmin });
  const { data: settings } = trpc.admin.getSettings.useQuery(undefined, { enabled: isAdmin });
  const setSettingsM = trpc.admin.setSettings.useMutation({
    onSuccess: () => { utils.admin.getSettings.invalidate(); toast.success("Custom code saved"); },
    onError: (e) => toast.error(e.message || "Failed to save"),
  });
  const [headCode, setHeadCode] = useState("");
  const [bodyCode, setBodyCode] = useState("");
  useEffect(() => {
    if (settings) { setHeadCode(settings.customHeadCode ?? ""); setBodyCode(settings.customBodyCode ?? ""); }
  }, [settings]);

  if (!isAdmin) {
    return (
      <div className="p-10 text-center">
        <Shield className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-foreground">Admins only</h1>
        <p className="text-sm text-muted-foreground mt-1">You don't have permission to view the admin dashboard.</p>
      </div>
    );
  }


  type U = { id: number; name?: string | null; email?: string | null; role?: string | null; lastSignedIn?: string | Date | null; suspended?: boolean | null; lastIp?: string | null; signupIp?: string | null };
  type W = { id: number; companyName?: string | null; plan?: string | null; userId: number };
  const userList = users as U[];
  const wsList = workspaces as W[];
  const ownerEmail = (uid: number) => userList.find((u) => u.id === uid)?.email ?? `user #${uid}`;
  const fmt = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString() : "—");

  // Count accounts per IP so duplicate/abusive sign-ups stand out.
  const ipCounts = new Map<string, number>();
  for (const u of userList) {
    const ip = u.lastIp || u.signupIp;
    if (ip) ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
  }

  // CSV download helper.
  const downloadCsv = (filename: string, rows: (string | number)[][]) => {
    const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  type Aff = { id: number; code: string; ownerEmail?: string | null; ownerName?: string | null; referralCount: number; rate: number; earningsCents: number; adjustmentCents: number; availableCents: number; paidCents: number };
  type Payout = { id: number; affiliateCode?: string | null; ownerEmail?: string | null; amountCents: number; method: string; details?: Record<string, string> | null; status?: string | null; adminNote?: string | null; createdAt: string | Date };
  const affList = affiliates as Aff[];
  const payoutList = payouts as Payout[];
  const money = (c?: number | null) => `$${((c ?? 0) / 100).toFixed(2)}`;
  const pendingPayouts = payoutList.filter((p) => p.status === "pending").length;

  type Pay = { id: number; provider: string; plan: string; status?: string | null; amountCents?: number | null; externalId?: string | null; createdAt: string | Date; workspaceName?: string | null; ownerEmail?: string | null };
  type Usage = { used: number; limit: number | null };
  type UsageRow = { workspaceId: number; workspaceName?: string | null; ownerEmail?: string | null; ownerName?: string | null; plan: string; aiConversations: Usage; contacts: Usage; agents: Usage; seats: Usage; tickets: Usage };
  type ActivityItem = { type: string; title: string; detail: string; at: string | Date };
  const payList = payments as Pay[];
  const usageList = usageRows as UsageRow[];
  const activityList = activity as ActivityItem[];
  const fmtDateTime = (d?: string | Date | null) => (d ? new Date(d).toLocaleString() : "—");
  const cell = (u: Usage) => `${u.used}${u.limit != null ? ` / ${u.limit}` : " / ∞"}`;
  const paidTotal = payList.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amountCents ?? 0), 0);

  // Client-side search filters per tab.
  const inc = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase());
  const filteredUsers = userList.filter((u) => !search.users || inc(`${u.name ?? ""} ${u.email ?? ""}`, search.users));
  const filteredWs = wsList.filter((w) => !search.ws || inc(`${w.companyName ?? ""} ${ownerEmail(w.userId)} ${w.plan ?? ""}`, search.ws));
  const filteredPays = payList.filter((p) => !search.billing || inc(`${p.workspaceName ?? ""} ${p.ownerEmail ?? ""} ${p.plan} ${p.provider} ${p.status ?? ""}`, search.billing));
  const filteredUsage = usageList.filter((w) => !search.usage || inc(`${w.workspaceName ?? ""} ${w.ownerEmail ?? ""} ${w.plan}`, search.usage));

  const exportPayments = () => downloadCsv(
    `payments-${new Date().toISOString().slice(0, 10)}.csv`,
    [["Date", "Workspace", "Owner", "Plan", "Provider", "Amount", "Status"],
      ...filteredPays.map((p) => [new Date(p.createdAt as unknown as string).toISOString(), p.workspaceName ?? "", p.ownerEmail ?? "", p.plan, p.provider, ((p.amountCents ?? 0) / 100).toFixed(2), p.status ?? "pending"])],
  );
  const exportUsage = () => downloadCsv(
    `usage-${new Date().toISOString().slice(0, 10)}.csv`,
    [["Workspace", "Owner", "Plan", "AI conv/mo", "Contacts", "Agents", "Seats", "Tickets/mo"],
      ...filteredUsage.map((w) => [w.workspaceName ?? `#${w.workspaceId}`, w.ownerEmail ?? "", w.plan, cell(w.aiConversations), cell(w.contacts), cell(w.agents), cell(w.seats), cell(w.tickets)])],
  );
  type LogRow = { id: number; actorEmail?: string | null; action: string; targetType?: string | null; targetId?: string | null; detail?: string | null; createdAt: string | Date };
  const logList = logs as LogRow[];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Platform-wide management across all workspaces</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="Users" value={stats?.users ?? 0} icon={Users} />
        <StatCard label="Workspaces" value={stats?.workspaces ?? 0} icon={Building2} />
        <StatCard label="Agents" value={stats?.agents ?? 0} icon={Bot} />
        <StatCard label="Conversations" value={stats?.conversations ?? 0} icon={MessageSquare} />
        <StatCard label="Tickets" value={stats?.tickets ?? 0} icon={Ticket} />
        <StatCard label="Contacts" value={stats?.contacts ?? 0} icon={Contact} />
      </div>

      {/* Revenue + system health */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <Card className="border-border lg:col-span-3">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">MRR</p>
                <p className="text-xl font-bold text-foreground">{money(revenue?.mrrCents)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active paid</p>
                <p className="text-xl font-bold text-foreground">{revenue?.activePaid ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Collected (mo)</p>
                <p className="text-xl font-bold text-foreground">{money(revenue?.collectedThisMonthCents)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Collected (all time)</p>
                <p className="text-xl font-bold text-foreground">{money(revenue?.collectedAllTimeCents)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">System health</p>
            <div className="space-y-1.5">
              {[
                { label: "Stripe", ok: health?.stripe },
                { label: "Cryptomus", ok: health?.cryptomus },
                { label: "Email", ok: health?.email },
              ].map((h) => (
                <div key={h.label} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{h.label}</span>
                  <Badge variant="outline" className={cn("text-xs", h.ok ? "bg-green-500/10 text-green-600 border-green-200" : "bg-muted text-muted-foreground")}>
                    {h.ok ? "Configured" : "Not set"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" />Users ({userList.length})</TabsTrigger>
          <TabsTrigger value="workspaces" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" />Workspaces ({wsList.length})</TabsTrigger>
          <TabsTrigger value="affiliates" className="gap-1.5 text-xs"><Gift className="w-3.5 h-3.5" />Affiliates ({affList.length})</TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1.5 text-xs"><Wallet className="w-3.5 h-3.5" />Payouts{pendingPayouts > 0 ? ` (${pendingPayouts})` : ""}</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5 text-xs"><CreditCard className="w-3.5 h-3.5" />Billing ({payList.length})</TabsTrigger>
          <TabsTrigger value="usage" className="gap-1.5 text-xs"><Gauge className="w-3.5 h-3.5" />Usage</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 text-xs"><Activity className="w-3.5 h-3.5" />Activity</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" />Audit log</TabsTrigger>
          <TabsTrigger value="growth" className="gap-1.5 text-xs"><TrendingUp className="w-3.5 h-3.5" />Growth</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs"><Code className="w-3.5 h-3.5" />Custom code</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Input placeholder="Search users by name or email…" value={search.users} onChange={(e) => setSearch((s) => ({ ...s, users: e.target.value }))} className="mb-3 max-w-sm h-9 text-sm" />
          <Card className="border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">User</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Last seen</th>
                    <th className="px-3 py-2.5 font-medium hidden md:table-cell">IP</th>
                    <th className="px-3 py-2.5 font-medium">Role</th>
                    <th className="px-3 py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.slice(0, rowLimit).map((u) => {
                    const ip = u.lastIp || u.signupIp;
                    const dup = ip ? (ipCounts.get(ip) ?? 0) : 0;
                    return (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground flex items-center gap-1.5">
                          {u.name ?? "Unnamed"}
                          {u.suspended && <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-200">Suspended</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground">{fmt(u.lastSignedIn)}</td>
                      <td className="px-3 py-2.5 hidden md:table-cell whitespace-nowrap">
                        <span className="text-xs font-mono text-muted-foreground">{ip ?? "—"}</span>
                        {dup > 1 && <Badge variant="outline" className="ml-1 text-[10px] bg-amber-500/10 text-amber-600 border-amber-200" title="Accounts sharing this IP">×{dup}</Badge>}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs capitalize">{u.role ?? "user"}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          {u.id === user?.id ? (
                            <span className="text-xs text-muted-foreground">You</span>
                          ) : (
                            <>
                              {u.role === "admin" ? (
                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={setRole.isPending} onClick={() => setRole.mutate({ id: u.id, role: "user" })}>
                                  <ShieldOff className="w-3 h-3" />Revoke
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={setRole.isPending} onClick={() => setRole.mutate({ id: u.id, role: "admin" })}>
                                  <ShieldCheck className="w-3 h-3" />Admin
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={suspendUser.isPending} onClick={() => suspendUser.mutate({ id: u.id, suspended: !u.suspended })}>
                                <Ban className="w-3 h-3" />{u.suspended ? "Unsuspend" : "Suspend"}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" disabled={deleteUserM.isPending} onClick={() => { if (window.confirm(`Delete ${u.email ?? "this user"} and ALL their data? This cannot be undone.`)) deleteUserM.mutate({ id: u.id }); }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
          {filteredUsers.length > rowLimit && (
            <div className="mt-3 text-center">
              <Button variant="outline" size="sm" onClick={() => setRowLimit((n) => n + 100)}>Show more ({filteredUsers.length - rowLimit} more)</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="workspaces" className="mt-4">
          <Input placeholder="Search workspaces by name, owner or plan…" value={search.ws} onChange={(e) => setSearch((s) => ({ ...s, ws: e.target.value }))} className="mb-3 max-w-sm h-9 text-sm" />
          <Card className="border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Workspace</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Owner</th>
                    <th className="px-3 py-2.5 font-medium">Plan</th>
                    <th className="px-3 py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWs.map((w) => (
                    <tr key={w.id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium text-foreground">{w.companyName ?? `Workspace #${w.id}`}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground">{ownerEmail(w.userId)}</td>
                      <td className="px-3 py-2.5">
                        <Select value={w.plan ?? "free"} onValueChange={(v) => setPlan.mutate({ id: w.id, plan: v })}>
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PLAN_OPTIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" disabled={deleteWsM.isPending} onClick={() => { if (window.confirm(`Delete workspace "${w.companyName ?? w.id}" and ALL its data? This cannot be undone.`)) deleteWsM.mutate({ id: w.id }); }}>
                          <Trash2 className="w-3 h-3" />Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="affiliates" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Affiliate</th>
                    <th className="px-3 py-2.5 font-medium">Referrals</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Rate</th>
                    <th className="px-3 py-2.5 font-medium">Earnings</th>
                    <th className="px-3 py-2.5 font-medium">Available</th>
                    <th className="px-3 py-2.5 font-medium">Adjustment ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {affList.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No affiliates yet</td></tr>
                  ) : affList.map((a) => {
                    const draft = adjDrafts[a.id] ?? String((a.adjustmentCents ?? 0) / 100);
                    return (
                      <tr key={a.id} className="border-t border-border">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-foreground">{a.ownerName ?? a.ownerEmail ?? `Affiliate #${a.id}`}</p>
                          <p className="text-xs text-muted-foreground">{a.ownerEmail} · <span className="font-mono">{a.code}</span></p>
                        </td>
                        <td className="px-3 py-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-xs px-2"
                            disabled={a.referralCount === 0}
                            onClick={() => setViewAff({ id: a.id, label: a.ownerEmail ?? a.code })}
                          >
                            <Eye className="w-3 h-3" />{a.referralCount}
                          </Button>
                        </td>
                        <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground">{a.rate}%</td>
                        <td className="px-3 py-2.5 text-foreground">{money(a.earningsCents)}</td>
                        <td className="px-3 py-2.5 font-medium text-foreground">{money(a.availableCents)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              step="0.01"
                              value={draft}
                              onChange={(e) => setAdjDrafts((p) => ({ ...p, [a.id]: e.target.value }))}
                              className="h-8 w-24 text-xs"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              disabled={setAdjustment.isPending}
                              onClick={() => setAdjustment.mutate({ id: a.id, amountCents: Math.round((parseFloat(draft) || 0) * 100) })}
                            >
                              Save
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-2">
            Adjustment is added to an affiliate's balance (use a negative value to deduct an already-settled amount). Earnings = commission rate × referred plan revenue.
          </p>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Affiliate</th>
                    <th className="px-3 py-2.5 font-medium">Method</th>
                    <th className="px-3 py-2.5 font-medium hidden md:table-cell">Details</th>
                    <th className="px-3 py-2.5 font-medium">Amount</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutList.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No withdrawal requests</td></tr>
                  ) : payoutList.map((p) => (
                    <tr key={p.id} className="border-t border-border align-top">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{p.ownerEmail ?? `Request #${p.id}`}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.affiliateCode}</p>
                        <p className="text-xs text-muted-foreground">{fmt(p.createdAt)}</p>
                      </td>
                      <td className="px-3 py-2.5 capitalize text-foreground">{p.method}</td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground max-w-xs">
                        {p.details && Object.keys(p.details).length > 0
                          ? Object.entries(p.details).map(([k, v]) => <div key={k}><span className="capitalize">{k}</span>: {v}</div>)
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{money(p.amountCents)}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={cn(
                          "text-xs capitalize",
                          p.status === "paid" && "bg-green-500/10 text-green-600 border-green-200",
                          p.status === "approved" && "bg-blue-500/10 text-blue-600 border-blue-200",
                          p.status === "rejected" && "bg-red-500/10 text-red-600 border-red-200",
                          (!p.status || p.status === "pending") && "bg-amber-500/10 text-amber-600 border-amber-200",
                        )}>{p.status ?? "pending"}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          {p.status !== "paid" && p.status !== "rejected" && (
                            <>
                              {p.status === "pending" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={setPayoutStatus.isPending} onClick={() => setPayoutStatus.mutate({ id: p.id, status: "approved" })}>
                                  <Check className="w-3 h-3" />Approve
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={setPayoutStatus.isPending} onClick={() => setPayoutStatus.mutate({ id: p.id, status: "paid" })}>
                                <DollarSign className="w-3 h-3" />Mark paid
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive" disabled={setPayoutStatus.isPending} onClick={() => setPayoutStatus.mutate({ id: p.id, status: "rejected" })}>
                                <X className="w-3 h-3" />Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="billing" className="mt-4">
          <Input placeholder="Search transactions by workspace, owner, plan, provider or status…" value={search.billing} onChange={(e) => setSearch((s) => ({ ...s, billing: e.target.value }))} className="mb-3 max-w-md h-9 text-sm" />
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-2 border-b border-border">
              <DollarSign className="w-4 h-4 text-green-600" />
              <p className="text-sm text-muted-foreground">Total collected (paid): <span className="font-semibold text-foreground">{money(paidTotal)}</span> · {payList.length} transactions</p>
              <Button size="sm" variant="outline" className="ml-auto h-8 gap-1.5 text-xs" onClick={exportPayments}><Download className="w-3.5 h-3.5" />Export CSV</Button>
            </CardContent>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Workspace / Owner</th>
                    <th className="px-3 py-2.5 font-medium">Plan</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Provider</th>
                    <th className="px-3 py-2.5 font-medium">Amount</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPays.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No transactions yet</td></tr>
                  ) : filteredPays.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDateTime(p.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-foreground">{p.workspaceName ?? "Workspace"}</p>
                        <p className="text-xs text-muted-foreground">{p.ownerEmail ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2.5 capitalize text-foreground">{p.plan}</td>
                      <td className="px-3 py-2.5 capitalize text-muted-foreground hidden sm:table-cell">{p.provider}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{money(p.amountCents)}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={cn(
                          "text-xs capitalize",
                          p.status === "paid" && "bg-green-500/10 text-green-600 border-green-200",
                          (!p.status || p.status === "pending") && "bg-amber-500/10 text-amber-600 border-amber-200",
                          p.status === "failed" && "bg-red-500/10 text-red-600 border-red-200",
                        )}>{p.status ?? "pending"}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {p.status === "paid" && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={refundM.isPending} onClick={() => { if (window.confirm("Mark this payment as refunded?")) refundM.mutate({ id: p.id }); }}>
                            Refund
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Input placeholder="Search by workspace, owner or plan…" value={search.usage} onChange={(e) => setSearch((s) => ({ ...s, usage: e.target.value }))} className="max-w-sm h-9 text-sm" />
            <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs" onClick={exportUsage}><Download className="w-3.5 h-3.5" />Export CSV</Button>
          </div>
          <Card className="border-border">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Workspace / Owner</th>
                    <th className="px-3 py-2.5 font-medium">Plan</th>
                    <th className="px-3 py-2.5 font-medium">AI conv / mo</th>
                    <th className="px-3 py-2.5 font-medium">Contacts</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Agents</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Seats</th>
                    <th className="px-3 py-2.5 font-medium hidden md:table-cell">Tickets / mo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsage.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No workspaces</td></tr>
                  ) : filteredUsage.map((w) => (
                    <tr key={w.workspaceId} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{w.workspaceName ?? `Workspace #${w.workspaceId}`}</p>
                        <p className="text-xs text-muted-foreground">{w.ownerEmail ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2.5"><Badge variant="secondary" className="text-xs capitalize">{w.plan}</Badge></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{cell(w.aiConversations)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{cell(w.contacts)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{cell(w.agents)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{cell(w.seats)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{cell(w.tickets)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-2">Usage is current calendar month for conversations/tickets; contacts, agents and seats are totals. "∞" = unlimited on the plan.</p>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {activityList.length === 0 ? (
                  <p className="px-4 py-8 text-center text-muted-foreground text-sm">No recent activity</p>
                ) : activityList.map((a, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", a.type.startsWith("payment") ? "bg-green-500" : "bg-blue-500")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(a.at)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Admin</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                  <th className="px-3 py-2.5 font-medium">Target</th>
                  <th className="px-3 py-2.5 font-medium hidden md:table-cell">Detail</th>
                </tr></thead>
                <tbody>
                  {logList.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No admin actions logged yet</td></tr>
                  ) : logList.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                      <td className="px-3 py-2.5 text-foreground">{l.actorEmail ?? "—"}</td>
                      <td className="px-3 py-2.5"><Badge variant="secondary" className="text-xs">{l.action}</Badge></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{l.targetType ? `${l.targetType} #${l.targetId}` : "—"}</td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">{l.detail ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="growth" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-3">New sign-ups (last 30 days)</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={growth?.signups ?? []}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                      <RTooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-3">Revenue collected (last 30 days)</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growth?.revenue ?? []}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} width={36} />
                      <RTooltip formatter={(v: number | string) => `$${Number(v).toFixed(2)}`} />
                      <Line type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">Custom code injection</p>
                <p className="text-xs text-muted-foreground mt-0.5">Paste analytics or tool snippets (Google Analytics, GTM, Search Console, Meta Pixel, chat widgets, etc.). Head code loads in the page &lt;head&gt;; body code loads before &lt;/body&gt;. Applies to every page.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Head code</label>
                <textarea value={headCode} onChange={(e) => setHeadCode(e.target.value)} rows={6} placeholder="<!-- e.g. Google Analytics / GTM / verification meta tag -->" className="w-full rounded-lg border border-border bg-background p-3 text-xs font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Body code</label>
                <textarea value={bodyCode} onChange={(e) => setBodyCode(e.target.value)} rows={5} placeholder="<!-- e.g. chat widgets / noscript pixels -->" className="w-full rounded-lg border border-border bg-background p-3 text-xs font-mono" />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Button size="sm" disabled={setSettingsM.isPending} onClick={() => setSettingsM.mutate({ customHeadCode: headCode, customBodyCode: bodyCode })}>Save custom code</Button>
                <p className="text-xs text-muted-foreground">Note: site-verification that requires server-rendered tags may not be detected via runtime injection; analytics/marketing tools work fine.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewAff} onOpenChange={(o) => !o && setViewAff(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Referred users</DialogTitle>
            <DialogDescription>People who signed up through {viewAff?.label}'s referral link.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {(affReferrals as { id: number; referredName?: string | null; referredEmail?: string | null; plan?: string | null; status?: string | null; createdAt: string | Date }[]).length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No referred users found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 font-medium">User</th>
                    <th className="py-2 font-medium">Plan</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium text-right">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {(affReferrals as { id: number; referredName?: string | null; referredEmail?: string | null; plan?: string | null; status?: string | null; createdAt: string | Date }[]).map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="py-2">
                        <p className="font-medium text-foreground">{r.referredName ?? r.referredEmail ?? "User"}</p>
                        {r.referredEmail && <p className="text-xs text-muted-foreground">{r.referredEmail}</p>}
                      </td>
                      <td className="py-2 capitalize text-muted-foreground">{r.plan ?? "—"}</td>
                      <td className="py-2"><Badge variant="outline" className="text-xs capitalize">{r.status ?? "pending"}</Badge></td>
                      <td className="py-2 text-right text-muted-foreground">{fmt(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
