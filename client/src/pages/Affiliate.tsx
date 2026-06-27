import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Gift, Copy, Check, Users, Percent, DollarSign, TrendingUp, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Referral = {
  id: number;
  referredName?: string | null;
  referredEmail?: string | null;
  plan?: string | null;
  amount?: number | null;
  status?: string | null;
  createdAt: string | Date;
};

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: React.ElementType }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className="w-4 h-4 text-muted-foreground/50" />
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const money = (cents?: number | null) => `$${((cents ?? 0) / 100).toFixed(2)}`;


export default function Affiliate() {
  const { data, isLoading } = trpc.affiliate.get.useQuery();
  const { data: referrals = [] } = trpc.affiliate.listReferrals.useQuery();
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = data?.code ? `${origin}/?ref=${data.code}` : "";

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const rows = referrals as Referral[];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Gift className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Affiliate Program</h1>
          <p className="text-muted-foreground text-sm">Refer customers and earn up to 30% recurring commission</p>
        </div>
      </div>

      {/* Referral link */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" />Your referral link</CardTitle>
          <CardDescription className="text-xs">Share this link. Anyone who signs up through it is tracked as your referral.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 px-3 py-2 rounded-lg border border-border bg-muted/40 font-mono text-sm text-foreground truncate">
              {isLoading ? "Loading…" : link || "—"}
            </div>
            <Button onClick={() => copy(link)} disabled={!link} className="gap-2 shrink-0">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          {data?.code && (
            <p className="text-xs text-muted-foreground">Referral code: <span className="font-mono font-semibold text-foreground">{data.code}</span></p>
          )}
          {data && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{data.referralCount}</span> sign-up{data.referralCount === 1 ? "" : "s"} from your link
            </p>
          )}
        </CardContent>
      </Card>


      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Sign-ups from link" value={data?.referralCount ?? 0} sub={`${data?.activeReferrals ?? 0} active`} icon={Users} />
        <StatCard label="Commission rate" value={`${data?.rate ?? 0}%`} sub="based on your tier" icon={Percent} />
        <StatCard label="Earnings" value={money(data?.earningsCents)} sub="estimated" icon={DollarSign} />
        <StatCard
          label="Next tier"
          value={data?.nextTier ? `${data.nextTier.rate}%` : "Max"}
          sub={data?.nextTier ? `${data.nextTier.remaining} more referral${data.nextTier.remaining === 1 ? "" : "s"}` : "Top tier reached"}
          icon={TrendingUp}
        />
      </div>

      {/* Tier ladder */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Commission tiers</CardTitle>
          <CardDescription className="text-xs">Your rate increases automatically as you refer more customers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(data?.tiers ?? []).map((t) => {
              const active = (data?.rate ?? 0) === t.rate;
              return (
                <div
                  key={t.rate}
                  className={cn(
                    "rounded-xl border p-4 text-center transition-all",
                    active ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <p className={cn("text-2xl font-bold", active ? "text-primary" : "text-foreground")}>{t.rate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.label}</p>
                  {active && <Badge className="mt-2 text-[10px] bg-primary/10 text-primary border-primary/20">Current</Badge>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>


      {/* Referrals */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Your referrals</CardTitle>
          <CardDescription className="text-xs">Customers who signed up through your link.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No referrals yet</p>
              <p className="text-xs text-muted-foreground mt-1">Share your referral link to start earning commission.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium py-2">Referral</th>
                  <th className="font-medium py-2 hidden sm:table-cell">Plan</th>
                  <th className="font-medium py-2">Status</th>
                  <th className="font-medium py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2.5">
                      <p className="font-medium text-foreground">{r.referredName ?? r.referredEmail ?? "Referral"}</p>
                      {r.referredEmail && <p className="text-xs text-muted-foreground">{r.referredEmail}</p>}
                    </td>
                    <td className="py-2.5 hidden sm:table-cell capitalize text-muted-foreground">{r.plan ?? "—"}</td>
                    <td className="py-2.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs capitalize",
                          r.status === "active" && "bg-green-500/10 text-green-600 border-green-200",
                          r.status === "cancelled" && "text-muted-foreground"
                        )}
                      >
                        {r.status ?? "pending"}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right text-foreground">{money(r.amount)}/mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
