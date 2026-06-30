import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import {
  Sparkles, Check, CreditCard, Bitcoin, Loader2, Zap, Users, Bot, MessageSquare,
  Ticket, BarChart3, Crown, ShieldCheck, ArrowRight, Globe, Mail, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PLAN_ORDER = ["free", "starter", "pro", "business", "enterprise"];
const PURCHASABLE = ["starter", "pro", "business"];

const PLANS = [
  { id: "free", name: "Free", price: "$0", period: "", blurb: "To get started", highlight: false,
    features: ["1 AI agent", "50 AI conversations / mo", "Unlimited human conversations", "30 contacts stored", "30 tickets / mo", "Knowledge base", "Lead capture", "Basic analytics", "Community support"] },
  { id: "starter", name: "Starter", price: "$9.99", period: "/mo", blurb: "For small sites", highlight: false,
    features: ["2 AI agents", "1,000 AI conversations / mo", "1,000 contacts", "Unlimited tickets", "Human handoff & live inbox", "Learn from your website", "Premium icons + remove branding", "Standard analytics", "Email support"] },
  { id: "pro", name: "Pro", price: "$49", period: "/mo", blurb: "For growing teams", highlight: true,
    features: ["5 AI agents", "6,000 AI conversations / mo", "5,000 contacts", "Everything in Starter", "Email branding (logo/reply-to)", "Segments + CSV export", "Advanced analytics", "10 team seats", "Priority support"] },
  { id: "business", name: "Business", price: "$129", period: "/mo", blurb: "For scale", highlight: false,
    features: ["15 AI agents", "20,000 AI conversations / mo", "25,000 contacts", "Everything in Pro", "Advanced analytics + export", "25 team seats", "Priority support + onboarding"] },
];

const FEATURE_MATRIX: { label: string; values: string[] }[] = [
  { label: "AI agents", values: ["1", "2", "5", "15", "Unlimited"] },
  { label: "AI conversations / mo", values: ["50", "1,000", "6,000", "20,000", "Unlimited"] },
  { label: "Human conversations", values: ["Unlimited", "Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Contacts stored", values: ["30", "1,000", "5,000", "25,000", "Unlimited"] },
  { label: "Tickets (create & respond)", values: ["30 / mo", "Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Team seats", values: ["1", "2", "10", "25", "Unlimited"] },
  { label: "Knowledge base (Q&A + articles)", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Learn from website URL", values: ["—", "✓", "✓", "✓", "✓"] },
  { label: "Widget styling", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Premium launcher icons", values: ["—", "✓", "✓", "✓", "✓"] },
  { label: 'Remove "Powered by Chatrico"', values: ["—", "✓", "✓", "✓", "✓"] },
  { label: "Lead capture", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Email-to-ticket + reply portal", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Human handoff / live Inbox + escalation", values: ["—", "✓", "✓", "✓", "✓"] },
  { label: "Email branding (logo/reply-to/signature)", values: ["—", "—", "✓", "✓", "✓"] },
  { label: "Segments + CSV export", values: ["—", "—", "✓", "✓", "✓"] },
  { label: "Analytics", values: ["Basic", "Standard", "Advanced", "Advanced + export", "Advanced + export"] },
  { label: "Multi-language replies", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Support", values: ["Community", "Email", "Priority", "Priority + onboarding", "SLA + dedicated"] },
  { label: "Affiliate program", values: ["✓", "✓", "✓", "✓", "✓"] },
];

const HERO_HIGHLIGHTS = [
  { icon: Bot, title: "More AI agents", desc: "Run multiple assistants, each with its own knowledge and voice." },
  { icon: MessageSquare, title: "More conversations", desc: "Handle thousands of AI chats every month as you grow." },
  { icon: Users, title: "Human handoff", desc: "Escalate to your team with full context on paid plans." },
  { icon: BarChart3, title: "Advanced analytics", desc: "Track resolution rates, trends and performance." },
];

function fmt(n: number) {
  return n.toLocaleString();
}

function UsageMeter({ icon: Icon, label, used, limit }: { icon: React.ElementType; label: string; used: number; limit: number | null }) {
  const unlimited = limit == null;
  const pct = unlimited || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const near = pct >= 80;
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-lg font-bold text-foreground">{fmt(used)}</span>
          <span className="text-xs text-muted-foreground">{unlimited ? "Unlimited" : `of ${fmt(limit)}`}</span>
        </div>
        {!unlimited && <Progress value={pct} className={cn("h-2", near && "[&>div]:bg-amber-500")} />}
        {unlimited && <div className="h-2 rounded-full bg-emerald-500/15" />}
      </CardContent>
    </Card>
  );
}

export default function Billing() {
  const { data: workspace } = trpc.workspace.get.useQuery();
  const { data: usage } = trpc.billing.usage.useQuery();
  const { data: billingConfig } = trpc.billing.config.useQuery();
  const utils = trpc.useUtils();

  const currentPlan = workspace?.plan === "growth" ? "pro" : (workspace?.plan ?? "free");
  const planIdx = Math.max(0, PLAN_ORDER.indexOf(currentPlan));
  const [payPlan, setPayPlan] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const createCheckout = trpc.billing.createCheckout.useMutation({
    onSuccess: (d) => { if (d?.url) window.location.href = d.url; },
    onError: (e) => toast.error(e.message || "Could not start checkout"),
  });
  const cancelSubscription = trpc.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("Your subscription won't renew. You keep access until the end of the billing period.");
      setConfirmCancel(false);
      utils.workspace.get.invalidate();
    },
    onError: (e) => toast.error(e.message || "Could not cancel the subscription"),
  });

  // Surface payment-return state + handle the ?upgrade=<plan> deep link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (billing === "success") toast.success("Payment received — your plan will update momentarily.");
    else if (billing === "cancelled") toast.info("Checkout cancelled — no charge was made.");
    const up = params.get("upgrade");
    if (up && PURCHASABLE.includes(up)) setPayPlan(up);
    if (billing || up) {
      params.delete("billing"); params.delete("upgrade");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  const startCheckout = (provider: "stripe" | "cryptomus") => {
    if (!payPlan) return;
    createCheckout.mutate({ plan: payPlan as "starter" | "pro" | "business", provider });
  };

  const cancelsAtPeriodEnd = !!(workspace as { subscriptionCancelAtPeriodEnd?: boolean })?.subscriptionCancelAtPeriodEnd;
  const hasActiveSub = !!(workspace as { stripeSubscriptionId?: string | null })?.stripeSubscriptionId;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">
      {/* ─── Hero ─── */}
      <div className="rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
        <Badge className="mb-3 bg-primary/15 text-primary border-primary/20">Plans & Billing</Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground max-w-2xl">
          Grow faster with the right plan for your business
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base">
          You're currently on the <span className="font-semibold text-foreground capitalize">{currentPlan}</span> plan.
          Upgrade any time for more AI conversations, more agents, human handoff and advanced analytics — and cancel whenever you want.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {HERO_HIGHLIGHTS.map((h) => (
            <div key={h.title} className="rounded-xl bg-background/70 border border-border p-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                <h.icon className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-foreground">{h.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{h.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Usage this month ─── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Zap className="w-5 h-5 text-primary" />Your usage this month</h2>
            <p className="text-sm text-muted-foreground">Live usage against your plan limits. Human conversations are always unlimited.</p>
          </div>
          <Badge variant="outline" className="capitalize gap-1"><Crown className="w-3.5 h-3.5 text-amber-500" />{currentPlan} plan</Badge>
        </div>
        {usage ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <UsageMeter icon={MessageSquare} label="AI conversations" used={usage.aiConversations.used} limit={usage.aiConversations.limit} />
            <UsageMeter icon={Users} label="Contacts" used={usage.contacts.used} limit={usage.contacts.limit} />
            <UsageMeter icon={Bot} label="AI agents" used={usage.agents.used} limit={usage.agents.limit} />
            <UsageMeter icon={ShieldCheck} label="Team seats" used={usage.seats.used} limit={usage.seats.limit} />
            <UsageMeter icon={Ticket} label="Tickets" used={usage.tickets.used} limit={usage.tickets.limit} />
          </div>
        ) : (
          <div className="h-24 rounded-xl border border-border bg-muted/30 animate-pulse" />
        )}
      </section>

      {/* ─── Plans ─── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Choose your plan</h2>
          <p className="text-sm text-muted-foreground">Upgrades open secure checkout — pay by card or crypto. Cancel anytime; your plan simply won't renew.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((p) => {
            const idx = PLAN_ORDER.indexOf(p.id);
            const isCurrent = p.id === currentPlan;
            const isDowngrade = idx < planIdx;
            return (
              <Card key={p.id} className={cn("relative flex flex-col border-border", p.highlight && "border-primary shadow-lg shadow-primary/10", isCurrent && "ring-2 ring-emerald-500")}>
                {p.highlight && !isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1"><Star className="w-3 h-3" />Most popular</span>
                )}
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1 rounded-full">Your plan</span>
                )}
                <CardContent className="p-5 flex flex-col flex-1">
                  <p className="font-bold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground mb-2">{p.blurb}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-extrabold text-foreground">{p.price}</span>
                    <span className="text-sm text-muted-foreground">{p.period}</span>
                  </div>
                  <ul className="space-y-2 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {isCurrent ? (
                      <Button className="w-full" variant="outline" disabled>Current plan</Button>
                    ) : p.id === "free" || isDowngrade ? (
                      <Button className="w-full" variant="outline" disabled>{p.id === "free" ? "Free forever" : "Included"}</Button>
                    ) : (
                      <Button className="w-full gap-1.5" onClick={() => setPayPlan(p.id)}>
                        Upgrade to {p.name} <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" />Cancel anytime · no setup fees · keep your data</p>
      </section>

      {/* ─── Manage subscription ─── */}
      {currentPlan !== "free" && (
        <section>
          <Card className="border-border">
            <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-foreground">Manage subscription</p>
                <p className="text-sm text-muted-foreground">
                  {cancelsAtPeriodEnd
                    ? "Your plan is set to not renew — you keep access until the end of the current period."
                    : "Cancelling stops auto-renewal. You keep access until the end of the billing period (no refund for the current period)."}
                </p>
              </div>
              {hasActiveSub && !cancelsAtPeriodEnd && (
                <Button variant="destructive" onClick={() => setConfirmCancel(true)}>Cancel subscription</Button>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ─── Full feature comparison ─── */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Compare all features</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left font-medium text-muted-foreground p-3">Feature</th>
                {["Free", "Starter", "Pro", "Business", "Enterprise"].map((c, i) => (
                  <th key={c} className={cn("text-center font-semibold p-3", i === planIdx ? "text-primary" : "text-foreground")}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className={cn("text-center p-3", i === planIdx && "bg-primary/5")}>
                      {v === "✓" ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : v === "—" ? <span className="text-muted-foreground/40">—</span> : <span className="text-foreground">{v}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Trust / content ─── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: ShieldCheck, title: "Secure payments", desc: "Card payments via Stripe and crypto via Cryptomus. We never store your card details." },
          { icon: Globe, title: "Cancel anytime", desc: "No long-term contracts. Downgrade or cancel whenever you like, right from this page." },
          { icon: Mail, title: "Here to help", desc: "Questions about a plan? Reach our team from Help & Support inside your dashboard." },
        ].map((c) => (
          <Card key={c.title} className="border-border">
            <CardContent className="p-5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2"><c.icon className="w-5 h-5" /></div>
              <p className="font-semibold text-foreground text-sm">{c.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ─── Payment-method picker ─── */}
      <Dialog open={!!payPlan} onOpenChange={(o) => { if (!o) setPayPlan(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />Upgrade to {payPlan ? payPlan.charAt(0).toUpperCase() + payPlan.slice(1) : ""}</DialogTitle>
            <DialogDescription>Choose how you'd like to pay. You'll be redirected to a secure checkout.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {billingConfig?.stripe && (
              <Button className="w-full justify-start gap-3 h-12" variant="outline" disabled={createCheckout.isPending} onClick={() => startCheckout("stripe")}>
                {createCheckout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                <div className="text-left">
                  <p className="text-sm font-medium">Credit / debit card</p>
                  <p className="text-xs text-muted-foreground">Secure card payment via Stripe</p>
                </div>
              </Button>
            )}
            {billingConfig?.cryptomus && (
              <Button className="w-full justify-start gap-3 h-12" variant="outline" disabled={createCheckout.isPending} onClick={() => startCheckout("cryptomus")}>
                {createCheckout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bitcoin className="w-4 h-4" />}
                <div className="text-left">
                  <p className="text-sm font-medium">Cryptocurrency</p>
                  <p className="text-xs text-muted-foreground">Pay with crypto via Cryptomus</p>
                </div>
              </Button>
            )}
            {!billingConfig?.stripe && !billingConfig?.cryptomus && (
              <p className="text-sm text-muted-foreground text-center py-2">No payment methods are configured yet. Please contact support.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel confirmation ─── */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel your subscription?</DialogTitle>
            <DialogDescription>
              Your plan will not renew next billing period. You keep all features until then. This does not refund the current period.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>Keep my plan</Button>
            <Button variant="destructive" disabled={cancelSubscription.isPending} onClick={() => cancelSubscription.mutate()}>
              {cancelSubscription.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel subscription"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
