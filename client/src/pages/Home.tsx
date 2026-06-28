import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useState } from "react";
import {
  Bot, MessageSquare, Users, BookOpen, BarChart3, Code2, Zap, ShieldCheck,
  Sparkles, Check, ArrowRight, Sun, Moon, Globe, Send, Plug, Clock, TrendingUp,
  Star, HeartHandshake, Languages, Workflow, Quote, ChevronDown, Ticket, Gift,
} from "lucide-react";

const BRAND = "Chatrico";

const FEATURES = [
  { icon: Bot, title: "AI agents that actually help", desc: "Train an agent on your content and let it answer customers 24/7 in your brand's voice and tone." },
  { icon: Users, title: "Seamless human handoff", desc: "Escalate to a teammate the moment a conversation needs a human — with full context, no repetition." },
  { icon: BookOpen, title: "Per-agent knowledge base", desc: "Give each agent its own Q&A and articles, or let it learn directly from your website's pages." },
  { icon: MessageSquare, title: "Lead capture built in", desc: "Ask for name and email before a chat starts and sync every visitor straight into your contacts." },
  { icon: Ticket, title: "Tickets & escalations", desc: "Turn unresolved chats into support tickets automatically so nothing slips through the cracks." },
  { icon: BarChart3, title: "Analytics you'll use", desc: "See conversations, resolution rates and trends — know exactly how your assistant is performing." },
  { icon: Code2, title: "Embed anywhere", desc: "One lightweight snippet works on WordPress, Webflow, Shopify or plain HTML. Style it from the dashboard." },
  { icon: Languages, title: "Speaks your customers' language", desc: "Reply in English, Arabic, French, Spanish and more — set per agent or auto-detect." },
  { icon: ShieldCheck, title: "Your data stays yours", desc: "Conversations and knowledge live in your workspace. No reselling, no surprises." },
];

const STEPS = [
  { n: "1", title: "Create your agent", desc: "Pick a tone, add your knowledge, and customize the widget's color, position, size and theme." },
  { n: "2", title: "Drop in one snippet", desc: "Copy the embed code once. Every setting you change later applies automatically — no re-copying, ever." },
  { n: "3", title: "Convert & support", desc: "Your agent answers instantly, captures leads, opens tickets, and hands off to your team when it matters." },
];

const USE_CASES = [
  { icon: TrendingUp, title: "E-commerce", desc: "Answer sizing, shipping and returns questions instantly and recover carts before they're abandoned." },
  { icon: Workflow, title: "SaaS & startups", desc: "Deflect repetitive support tickets, onboard trial users, and book demos around the clock." },
  { icon: HeartHandshake, title: "Agencies", desc: "Spin up a branded assistant per client in minutes and manage them all from one dashboard." },
  { icon: Users, title: "Support teams", desc: "Let AI handle tier-1 questions so your humans focus on the conversations that need them." },
];

const DEEP_DIVES = [
  {
    eyebrow: "Always on",
    title: "An assistant that never sleeps",
    desc: "Chatrico greets every visitor instantly and answers from your knowledge base — at 2pm or 2am. When it can't help, it hands off to a human and keeps the full conversation context.",
    points: ["Instant first response", "Trained on your content", "Smart human handoff"],
    icon: Clock,
  },
  {
    eyebrow: "Grow your list",
    title: "Turn conversations into customers",
    desc: "Capture leads right inside the chat, sync them to your contacts, and follow up. Every visitor becomes a known contact you can segment and reach later.",
    points: ["Pre-chat lead capture", "Contacts auto-synced", "Export & segment anytime"],
    icon: TrendingUp,
  },
  {
    eyebrow: "One snippet",
    title: "Set it once, change it anytime",
    desc: "Paste a single script tag on your site. Update colors, position, theme, size, welcome message or knowledge from the dashboard and it applies everywhere live — no re-copying code.",
    points: ["Works on any site", "Live dashboard control", "No developer needed"],
    icon: Code2,
  },
];

const INTEGRATIONS = ["WordPress", "Webflow", "Shopify", "Plain HTML", "React", "Next.js"];

const STATS = [
  { v: "24/7", l: "Always-on support", icon: Zap },
  { v: "1 snippet", l: "Works everywhere", icon: Globe },
  { v: "9+", l: "Languages supported", icon: Languages },
  { v: "Secure", l: "Your data stays yours", icon: ShieldCheck },
];

const TESTIMONIALS = [
  { quote: "We cut first-response time to seconds and our team finally stopped answering the same five questions all day.", name: "Sara M.", role: "Head of Support, DTC brand" },
  { quote: "Setup took one afternoon. The handoff to our agents is seamless and customers can't tell where AI ends and we begin.", name: "Daniel K.", role: "Founder, B2B SaaS" },
  { quote: "Running a branded assistant per client used to be a project. With Chatrico it's a 10-minute task.", name: "Lina R.", role: "Director, Digital Agency" },
];

const PLANS = [
  { id: "free", name: "Free", price: "$0", period: "", highlight: false, blurb: "To get started", highlights: ["1 AI agent", "50 AI conversations / mo", "Unlimited human conversations", "30 contacts stored", "30 tickets / mo"], features: [
    "1 AI agent", "50 AI conversations / mo", "Unlimited human conversations", "30 contacts stored",
    "30 tickets / mo (create & respond)", "Knowledge base", "Embed on any site", "Widget styling",
    "Lead capture", "Multi-language replies", "Basic analytics", "Community support", "Affiliate program",
  ] },
  { id: "starter", name: "Starter", price: "$9.99", period: "/mo", highlight: false, blurb: "For small sites", highlights: ["2 AI agents", "1,000 AI conversations / mo", "Unlimited tickets", "Human handoff & live inbox", "Remove branding"], features: [
    "2 AI agents", "1,000 AI conversations / mo", "Unlimited human conversations", "1,000 contacts",
    "Unlimited tickets (create & respond)", "Knowledge base", "Embed on any site", "Learn from your website",
    "Widget styling", "Premium icons + remove branding", "Lead capture", "Human handoff & live inbox",
    "Escalation rules", "Tickets & email-to-ticket", "Standard analytics", "Multi-language replies",
    "Email support", "Affiliate program",
  ] },
  { id: "pro", name: "Pro", price: "$49", period: "/mo", highlight: true, blurb: "For growing teams", highlights: ["5 AI agents", "6,000 AI conversations / mo", "5,000 contacts", "Email branding + CSV export", "Advanced analytics", "10 team seats"], features: [
    "5 AI agents", "6,000 AI conversations / mo", "Unlimited human conversations", "5,000 contacts",
    "Unlimited tickets (create & respond)", "Knowledge base", "Embed on any site", "Learn from your website",
    "Widget styling", "Premium icons + remove branding", "Lead capture", "Human handoff & live inbox",
    "Escalation rules", "Tickets & email-to-ticket", "Email branding (logo / reply-to / signature)",
    "Segments + CSV export", "Advanced analytics", "Multi-language replies", "10 team seats",
    "Priority support", "Affiliate program",
  ] },
  { id: "business", name: "Business", price: "$129", period: "/mo", highlight: false, blurb: "For scale", highlights: ["15 AI agents", "20,000 AI conversations / mo", "25,000 contacts", "Advanced analytics + export", "25 team seats", "Priority support + onboarding"], features: [
    "15 AI agents", "20,000 AI conversations / mo", "Unlimited human conversations", "25,000 contacts",
    "Unlimited tickets (create & respond)", "Knowledge base", "Embed on any site", "Learn from your website",
    "Widget styling", "Premium icons + remove branding", "Lead capture", "Human handoff & live inbox",
    "Escalation rules", "Tickets & email-to-ticket", "Email branding (logo / reply-to / signature)",
    "Segments + CSV export", "Advanced analytics + export", "Multi-language replies", "25 team seats",
    "Priority support + onboarding", "Affiliate program",
  ] },
];

// Full feature comparison across plans (incl. Enterprise). "✓" = included,
// "—" = not included. Shown in the comparison table under the pricing cards.
const COMPARE_COLS = ["Free", "Starter", "Pro", "Business", "Enterprise"];
const COMPARE_ROWS: { label: string; values: string[] }[] = [
  { label: "AI agents", values: ["1", "2", "5", "15", "Unlimited"] },
  { label: "AI conversations / mo", values: ["50", "1,000", "6,000", "20,000", "Unlimited"] },
  { label: "Human conversations", values: ["Unlimited", "Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Contacts stored", values: ["30", "1,000", "5,000", "25,000", "Unlimited"] },
  { label: "Tickets (create & respond)", values: ["30 / mo", "Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Team seats", values: ["1", "2", "10", "25", "Unlimited"] },
  { label: "Knowledge base (Q&A + articles)", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Embed on any site", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Learn from website URL", values: ["—", "✓", "✓", "✓", "✓"] },
  { label: "Widget styling (color/position/theme/size/font)", values: ["✓", "✓", "✓", "✓", "✓"] },
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

const FAQS = [
  { q: "Do I need to know how to code?", a: "No. Create your agent in the dashboard, copy one snippet, and paste it into your site. WordPress, Shopify, Webflow and plain HTML are all supported." },
  { q: "What happens when the AI can't answer?", a: "It can hand the conversation to a human on your team, show a fallback message, or open a support ticket — you decide per agent." },
  { q: "Will my widget settings update without re-copying the code?", a: "Yes. The snippet only carries your agent ID. Color, position, theme, size, welcome message and knowledge are all read live from your dashboard." },
  { q: "Can each agent have its own knowledge?", a: "Absolutely. Every agent has its own Q&A and articles, and can also learn directly from a website URL — perfect if you manage multiple brands." },
  { q: "Is there a free plan?", a: "Yes — the Free plan includes one agent, 50 conversations per month and 30 stored contacts. Upgrade to Starter ($9.99/mo) or higher whenever you're ready." },
  { q: "Do you have an affiliate program?", a: "We do — earn up to 30% recurring commission for every customer you refer, with withdrawals via PayPal, bank transfer, Wise or crypto." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="w-full text-left rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/30"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium text-foreground">{q}</span>
        <ChevronDown className={"w-4 h-4 text-muted-foreground shrink-0 transition-transform " + (open ? "rotate-180" : "")} />
      </div>
      {open && <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </button>
  );
}

function PlanCard({ p }: { p: (typeof PLANS)[number] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? p.features : p.highlights;
  return (
    <div className={"rounded-2xl border p-6 bg-card relative flex flex-col " + (p.highlight ? "border-primary shadow-xl md:scale-[1.03]" : "border-border")}>
      {p.highlight && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">Most popular</Badge>
      )}
      <h3 className="font-semibold text-lg">{p.name}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{p.blurb}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold">{p.price}</span>
        <span className="text-muted-foreground text-sm">{p.period}</span>
      </div>
      <Link href="/login">
        <Button className="w-full mt-5" variant={p.highlight ? "default" : "outline"}>
          {p.id === "free" ? "Get started free" : "Get started"}
        </Button>
      </Link>
      <ul className="mt-5 space-y-2.5">
        {shown.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>
      {p.features.length > p.highlights.length && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {open ? "Show less" : `See all ${p.features.length} features`}
          <ChevronDown className={"w-4 h-4 transition-transform " + (open ? "rotate-180" : "")} />
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [showCompare, setShowCompare] = useState(false);
  const primaryCta = user ? { href: "/dashboard", label: "Go to dashboard" } : { href: "/login", label: "Get started free" };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">{BRAND}</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#usecases" className="hover:text-foreground transition-colors">Use cases</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {toggleTheme && (
              <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleTheme} aria-label="Toggle theme">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            )}
            {user ? (
              <Link href="/dashboard"><Button size="sm">Dashboard</Button></Link>
            ) : (
              <>
                <Link href="/login"><Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button></Link>
                <Link href="/login"><Button size="sm" className="gap-1.5">Get started <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 -z-10 w-[640px] h-[640px] rounded-full bg-primary/10 blur-3xl" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="outline" className="gap-1.5 mb-5 border-primary/30 text-primary bg-primary/5">
              <Sparkles className="w-3.5 h-3.5" /> Meet {BRAND} — AI support on autopilot
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Turn every visitor into a <span className="text-primary">conversation</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              {BRAND} is the AI chat assistant for your website. It answers questions instantly, captures leads,
              opens tickets, and hands off to your team — all from one snippet you never have to touch again.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={primaryCta.href}>
                <Button size="lg" className="gap-2 text-base h-12 px-6">{primaryCta.label} <ArrowRight className="w-4 h-4" /></Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="text-base h-12 px-6">See how it works</Button>
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" /> Free plan available · No credit card required · Live in minutes
            </p>
          </div>

          {/* Mock widget preview */}
          <div className="relative">
            <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3 bg-primary">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-none">{BRAND} Assistant</p>
                  <span className="text-white/80 text-xs flex items-center gap-1 mt-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online</span>
                </div>
              </div>
              <div className="p-4 space-y-3 bg-muted/30">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-card border border-border px-3 py-2 text-sm shadow-sm">
                  Hi! 👋 How can I help you today?
                </div>
                <div className="max-w-[80%] ml-auto rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm">
                  Do you integrate with WordPress?
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-card border border-border px-3 py-2 text-sm shadow-sm">
                  Absolutely — paste one snippet and you're live. Want the steps?
                </div>
              </div>
              <div className="px-3 py-2.5 flex items-center gap-2 border-t border-border bg-card">
                <div className="flex-1 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">Type a message…</div>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><Send className="w-4 h-4 text-primary-foreground" /></div>
              </div>
            </div>
          </div>
        </div>

        {/* logo strip */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-5">Works with the tools you already use</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 opacity-70">
            {INTEGRATIONS.map((i) => (
              <span key={i} className="text-sm font-semibold text-muted-foreground">{i}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value / problem-solution ── */}
      <section className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid md:grid-cols-3 gap-8">
          {[
            { icon: Clock, title: "Stop losing leads after hours", desc: "Most visitors never come back. Chatrico answers the moment they land — day or night — so you capture intent while it's hot." },
            { icon: MessageSquare, title: "Stop answering the same questions", desc: "Let AI handle repetitive tier-1 questions from your own content, and free your team for the conversations that matter." },
            { icon: TrendingUp, title: "Stop guessing what customers want", desc: "Every chat becomes a contact and a data point, so you learn what people ask and turn it into better answers." },
          ].map((c) => (
            <div key={c.title}>
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <c.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">{c.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything you need to support customers</h2>
          <p className="mt-3 text-muted-foreground">From first hello to resolved ticket — {BRAND} handles the busywork so your team can focus on what matters.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">How it works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Live in minutes</h2>
            <p className="mt-3 text-muted-foreground">No engineers required. Three steps from sign-up to a working assistant.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-border bg-card p-6">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mb-4">{s.n}</div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Deep-dive feature sections ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 space-y-20">
        {DEEP_DIVES.map((d, i) => (
          <div key={d.title} className={"grid lg:grid-cols-2 gap-10 items-center " + (i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : "")}>
            <div>
              <Badge variant="outline" className="mb-3 text-primary border-primary/30 bg-primary/5">{d.eyebrow}</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">{d.title}</h3>
              <p className="mt-3 text-muted-foreground leading-relaxed">{d.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {d.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-green-600" /></span>
                    <span className="text-foreground">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-10 flex items-center justify-center min-h-56">
              <d.icon className="w-20 h-20 text-primary" />
            </div>
          </div>
        ))}
      </section>

      {/* ── Use cases ── */}
      <section id="usecases" className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">Use cases</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Built for every kind of team</h2>
            <p className="mt-3 text-muted-foreground">However you talk to customers, {BRAND} fits right in.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {USE_CASES.map((u) => (
              <div key={u.title} className="rounded-2xl border border-border bg-card p-6">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <u.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold">{u.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.l}>
              <s.icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-extrabold">{s.v}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Integrations ── */}
      <section className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
          <Plug className="w-7 h-7 text-primary mx-auto mb-4" />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Add it to any website</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Copy one snippet and you're live. {BRAND} runs anywhere your site does.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {INTEGRATIONS.map((i) => (
              <span key={i} className="px-4 py-2 rounded-full border border-border bg-card text-sm font-medium text-foreground">{i}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-1 mb-3">
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Loved by support and growth teams</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border border-border bg-card p-6">
              <Quote className="w-6 h-6 text-primary/40 mb-3" />
              <p className="text-sm text-foreground leading-relaxed">"{t.quote}"</p>
              <div className="mt-4">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">Pricing</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple, scalable pricing</h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade when you grow. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {PLANS.map((p) => <PlanCard key={p.id} p={p} />)}
          </div>

          {/* Feature comparison table (collapsible) */}
          <div className="mt-12 text-center">
            <Button variant="outline" className="gap-2" onClick={() => setShowCompare((s) => !s)}>
              {showCompare ? "Hide full comparison" : "See all features & compare plans"}
              <ChevronDown className={"w-4 h-4 transition-transform " + (showCompare ? "rotate-180" : "")} />
            </Button>
          </div>
          {showCompare && (
          <div className="mt-8">
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-semibold p-4 sticky left-0 bg-card">Feature</th>
                    {COMPARE_COLS.map((c) => (
                      <th key={c} className={"text-center font-semibold p-4 " + (c === "Pro" ? "text-primary" : "")}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, i) => (
                    <tr key={row.label} className={"border-b border-border/60 " + (i % 2 ? "bg-muted/20" : "")}>
                      <td className="p-4 text-foreground sticky left-0 bg-inherit">{row.label}</td>
                      {row.values.map((v, idx) => (
                        <td key={idx} className="p-4 text-center">
                          {v === "✓" ? (
                            <Check className="w-4 h-4 text-green-500 mx-auto" />
                          ) : v === "—" ? (
                            <span className="text-muted-foreground/50">—</span>
                          ) : (
                            <span className={COMPARE_COLS[idx] === "Pro" ? "font-medium text-foreground" : "text-muted-foreground"}>{v}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Human (live agent) conversations are unlimited on every plan — only AI replies count toward your monthly limit.
            </p>
          </div>
          )}
        </div>
      </section>

      {/* ── Affiliate callout ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Gift className="w-6 h-6 text-primary" /></div>
            <div>
              <h3 className="text-xl font-bold">Earn with the {BRAND} affiliate program</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">Refer customers and earn up to 30% recurring commission. Withdraw via PayPal, bank transfer, Wise or crypto.</p>
            </div>
          </div>
          <Link href="/login"><Button variant="outline" className="gap-2 shrink-0">Become an affiliate <ArrowRight className="w-4 h-4" /></Button></Link>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">FAQ</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Questions, answered</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="rounded-3xl bg-primary text-primary-foreground px-6 sm:px-12 py-14 text-center relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to put your support on autopilot?</h2>
          <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">Set up your first {BRAND} agent in minutes and add it to your site today.</p>
          <Link href={primaryCta.href}>
            <Button size="lg" variant="secondary" className="mt-7 gap-2 h-12 px-7 text-base">{primaryCta.label} <ArrowRight className="w-4 h-4" /></Button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center"><Bot className="w-4 h-4 text-primary-foreground" /></div>
              <span className="font-bold">{BRAND}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">AI chat support for your website. Answer, capture, and resolve — automatically.</p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3">Product</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#how" className="hover:text-foreground transition-colors">How it works</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3">Company</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#usecases" className="hover:text-foreground transition-colors">Use cases</a></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
              <li><Link href="/login" className="hover:text-foreground transition-colors">Affiliate program</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3">Get started</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link></li>
              <li><Link href="/login" className="hover:text-foreground transition-colors">Create account</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} {BRAND}. All rights reserved.</span>
            <span>Built for teams who care about their customers.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
