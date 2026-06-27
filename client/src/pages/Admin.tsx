import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Shield, Users, Building2, Bot, MessageSquare, Ticket, Contact, ShieldCheck, ShieldOff, Gift, Wallet, Check, X, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const PLAN_OPTIONS = ["starter", "growth", "enterprise"];

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
  const [adjDrafts, setAdjDrafts] = useState<Record<number, string>>({});
  const setAdjustment = trpc.admin.setAffiliateAdjustment.useMutation({
    onSuccess: () => { utils.admin.affiliates.invalidate(); toast.success("Adjustment saved"); },
    onError: () => toast.error("Failed to save adjustment"),
  });
  const setPayoutStatus = trpc.admin.setPayoutStatus.useMutation({
    onSuccess: () => { utils.admin.payouts.invalidate(); utils.admin.affiliates.invalidate(); toast.success("Payout updated"); },
    onError: () => toast.error("Failed to update payout"),
  });

  if (!isAdmin) {
    return (
      <div className="p-10 text-center">
        <Shield className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-foreground">Admins only</h1>
        <p className="text-sm text-muted-foreground mt-1">You don't have permission to view the admin dashboard.</p>
      </div>
    );
  }


  type U = { id: number; name?: string | null; email?: string | null; role?: string | null; lastSignedIn?: string | Date | null };
  type W = { id: number; companyName?: string | null; plan?: string | null; userId: number };
  const userList = users as U[];
  const wsList = workspaces as W[];
  const ownerEmail = (uid: number) => userList.find((u) => u.id === uid)?.email ?? `user #${uid}`;
  const fmt = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString() : "—");

  type Aff = { id: number; code: string; ownerEmail?: string | null; ownerName?: string | null; referralCount: number; rate: number; earningsCents: number; adjustmentCents: number; availableCents: number; paidCents: number };
  type Payout = { id: number; affiliateCode?: string | null; ownerEmail?: string | null; amountCents: number; method: string; details?: Record<string, string> | null; status?: string | null; adminNote?: string | null; createdAt: string | Date };
  const affList = affiliates as Aff[];
  const payoutList = payouts as Payout[];
  const money = (c?: number | null) => `$${((c ?? 0) / 100).toFixed(2)}`;
  const pendingPayouts = payoutList.filter((p) => p.status === "pending").length;

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

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" />Users ({userList.length})</TabsTrigger>
          <TabsTrigger value="workspaces" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" />Workspaces ({wsList.length})</TabsTrigger>
          <TabsTrigger value="affiliates" className="gap-1.5 text-xs"><Gift className="w-3.5 h-3.5" />Affiliates ({affList.length})</TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1.5 text-xs"><Wallet className="w-3.5 h-3.5" />Payouts{pendingPayouts > 0 ? ` (${pendingPayouts})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">User</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Last seen</th>
                    <th className="px-3 py-2.5 font-medium">Role</th>
                    <th className="px-3 py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{u.name ?? "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground">{fmt(u.lastSignedIn)}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs capitalize">{u.role ?? "user"}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {u.id === user?.id ? (
                          <span className="text-xs text-muted-foreground">You</span>
                        ) : u.role === "admin" ? (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={setRole.isPending} onClick={() => setRole.mutate({ id: u.id, role: "user" })}>
                            <ShieldOff className="w-3 h-3" />Revoke admin
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={setRole.isPending} onClick={() => setRole.mutate({ id: u.id, role: "admin" })}>
                            <ShieldCheck className="w-3 h-3" />Make admin
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

        <TabsContent value="workspaces" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Workspace</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Owner</th>
                    <th className="px-3 py-2.5 font-medium">Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {wsList.map((w) => (
                    <tr key={w.id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium text-foreground">{w.companyName ?? `Workspace #${w.id}`}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground">{ownerEmail(w.userId)}</td>
                      <td className="px-3 py-2.5">
                        <Select value={w.plan ?? "starter"} onValueChange={(v) => setPlan.mutate({ id: w.id, plan: v })}>
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PLAN_OPTIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
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
                        <td className="px-3 py-2.5 text-foreground">{a.referralCount}</td>
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
      </Tabs>
    </div>
  );
}
