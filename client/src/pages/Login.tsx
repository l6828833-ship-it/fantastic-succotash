import { useState } from "react";
import {
  Bot, Loader2, MailCheck, ArrowLeft, KeyRound, ArrowRight, Sun, Moon,
  MessageSquare, Users, BarChart3, Check, Sparkles, ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

type Mode = "login" | "signup" | "reset";
type Step = "form" | "verify";

const BRAND = "Chatrico";

const HIGHLIGHTS = [
  { icon: Bot, title: "AI agents that actually help", desc: "Answer customers 24/7 in your brand's voice, trained on your own content." },
  { icon: Users, title: "Seamless human handoff", desc: "Escalate to a teammate with full context the moment a chat needs a human." },
  { icon: MessageSquare, title: "Lead capture built in", desc: "Turn every visitor into a contact and sync them straight to your dashboard." },
  { icon: BarChart3, title: "Analytics you'll use", desc: "See conversations, resolution rates and trends at a glance." },
];

export default function Login() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const post = async (url: string, payload: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data } as { ok: boolean; data: { error?: string; otp?: boolean; verified?: boolean } };
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep("form");
    setCode("");
    setPassword("");
    setConfirm("");
  };

  // Login, sign-up step 1, or reset step 1 (request a code).
  const submit = async () => {
    // Reset flow only needs an email to request a code.
    if (mode === "reset") {
      if (!email.trim()) {
        toast.error("Enter your email");
        return;
      }
      setLoading(true);
      try {
        const { ok, data } = await post("/api/auth/reset/request", { email: email.trim() });
        if (!ok) { toast.error(data.error || "Something went wrong"); return; }
        setStep("verify");
        toast.success("We emailed you a reset code.");
      } catch {
        toast.error("Could not reach the server. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      toast.error("Enter your email and password");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { ok, data } = await post("/api/auth/login", { email: email.trim(), password });
        if (!ok) { toast.error(data.error || "Something went wrong"); return; }
        window.location.href = "/dashboard";
        return;
      }
      // signup
      const { ok, data } = await post("/api/auth/signup/request", { email: email.trim(), password, name: name.trim() });
      if (!ok) { toast.error(data.error || "Something went wrong"); return; }
      if (data.verified) { window.location.href = "/dashboard"; return; } // no email provider → created directly
      // OTP sent → move to verify step
      setStep("verify");
      toast.success("We emailed you a 6-digit verification code.");
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify the emailed code (sign-up = create account, reset = set new password).
  const verify = async () => {
    if (!/^\d{4,8}$/.test(code.trim())) {
      toast.error("Enter the code we emailed you");
      return;
    }
    if (mode === "reset") {
      if (password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
      if (password !== confirm) {
        toast.error("Passwords don't match");
        return;
      }
      setLoading(true);
      try {
        const { ok, data } = await post("/api/auth/reset/verify", { email: email.trim(), code: code.trim(), password });
        if (!ok) { toast.error(data.error || "Invalid code"); return; }
        toast.success("Password updated. Signing you in…");
        window.location.href = "/dashboard";
      } catch {
        toast.error("Could not reach the server. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const { ok, data } = await post("/api/auth/signup/verify", { email: email.trim(), code: code.trim() });
      if (!ok) { toast.error(data.error || "Invalid code"); return; }
      window.location.href = "/dashboard";
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setLoading(true);
    try {
      const url = mode === "reset" ? "/api/auth/reset/request" : "/api/auth/signup/request";
      const payload =
        mode === "reset"
          ? { email: email.trim() }
          : { email: email.trim(), password, name: name.trim() };
      const { ok, data } = await post(url, payload);
      if (!ok) { toast.error(data.error || "Could not resend the code"); return; }
      toast.success("A new code is on its way.");
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const headerSubtitle = () => {
    if (step === "verify") {
      return mode === "reset"
        ? "Enter the code and choose a new password"
        : "Enter the code we sent to your email";
    }
    if (mode === "login") return "Sign in to your account";
    if (mode === "signup") return "Create your account to get started";
    return "Reset your password";
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* ── Left: brand / content panel (hidden on small screens) ── */}
      <aside className="relative hidden lg:flex w-1/2 flex-col justify-between overflow-hidden bg-sidebar text-sidebar-foreground p-12">
        <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute bottom-0 -right-24 w-[360px] h-[360px] rounded-full bg-primary/20 blur-3xl" />

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-2.5 w-fit">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">{BRAND}</span>
        </Link>

        {/* Pitch + feature list */}
        <div className="relative max-w-md">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium mb-5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> AI support on autopilot
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
            Turn every visitor into a conversation
          </h2>
          <p className="mt-3 text-sidebar-foreground/70 text-sm leading-relaxed">
            {BRAND} answers questions instantly, captures leads, opens tickets, and hands off to your
            team — all from one snippet you never have to touch again.
          </p>

          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex items-start gap-3.5">
                <div className="mt-0.5 w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <h.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{h.title}</p>
                  <p className="text-xs text-sidebar-foreground/60 leading-relaxed mt-0.5">{h.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer trust line */}
        <div className="relative flex items-center gap-2 text-xs text-sidebar-foreground/60">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Your data stays yours · Free plan available · No credit card required
        </div>
      </aside>

      {/* ── Right: auth area ── */}
      <main className="flex-1 flex flex-col">
        {/* Top menu */}
        <header className="flex items-center justify-between px-5 sm:px-8 h-16 border-b border-border">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New to " + BRAND + "?"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => switchMode(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup" ? "Sign in" : "Create account"}
            </Button>
            {toggleTheme && (
              <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleTheme} aria-label="Toggle theme">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </header>

        {/* Centered form */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-sm space-y-6">
            <div className="flex flex-col items-center gap-2 text-center">
              {/* compact logo for mobile */}
              <Link href="/" className="lg:hidden flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg tracking-tight">{BRAND}</span>
              </Link>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                {step === "verify"
                  ? <MailCheck className="w-6 h-6 text-primary" />
                  : mode === "reset"
                    ? <KeyRound className="w-6 h-6 text-primary" />
                    : <Bot className="w-6 h-6 text-primary" />}
              </div>
              <h1 className="text-xl font-bold text-foreground">
                {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
              </h1>
              <p className="text-sm text-muted-foreground">{headerSubtitle()}</p>
            </div>

            <Card className="border-border shadow-sm">
              <CardContent className="p-5 space-y-4">
                {step === "verify" ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Verification code</Label>
                      <Input
                        inputMode="numeric"
                        autoFocus
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        className="text-center text-lg tracking-[0.4em] font-semibold"
                        onKeyDown={(e) => { if (e.key === "Enter" && mode !== "reset") verify(); }}
                      />
                      <p className="text-xs text-muted-foreground">Sent to {email}</p>
                    </div>

                    {mode === "reset" && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-sm">New password</Label>
                          <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">Confirm password</Label>
                          <Input
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="Re-enter your password"
                            onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
                          />
                        </div>
                      </>
                    )}

                    <Button className="w-full gap-2" onClick={verify} disabled={loading}>
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {mode === "reset" ? "Reset password" : "Verify & create account"}
                    </Button>
                    <div className="flex items-center justify-between text-xs">
                      <button type="button" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={() => { setStep("form"); setCode(""); }}>
                        <ArrowLeft className="w-3 h-3" /> Back
                      </button>
                      <button type="button" className="text-primary hover:underline disabled:opacity-50" onClick={resend} disabled={loading}>
                        Resend code
                      </button>
                    </div>
                  </div>
                ) : mode === "reset" ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Email</Label>
                      <Input
                        type="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                      />
                      <p className="text-xs text-muted-foreground">Enter the email for your account and we'll send a reset code.</p>
                    </div>
                    <Button className="w-full gap-2" onClick={submit} disabled={loading}>
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Send reset code
                    </Button>
                    <button
                      type="button"
                      className="w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
                      onClick={() => switchMode("login")}
                    >
                      <ArrowLeft className="w-3 h-3" /> Back to sign in
                    </button>
                  </div>
                ) : (
                  <>
                    <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
                      <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="login">Sign in</TabsTrigger>
                        <TabsTrigger value="signup">Sign up</TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="space-y-3">
                      {mode === "signup" && (
                        <div className="space-y-1.5">
                          <Label className="text-sm">Name</Label>
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-sm">Email</Label>
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Password</Label>
                          {mode === "login" && (
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline"
                              onClick={() => switchMode("reset")}
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                        />
                      </div>
                      <Button className="w-full gap-2" onClick={submit} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {mode === "login" ? "Sign in" : "Create account"}
                      </Button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground">or</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <Button variant="outline" className="w-full gap-2" onClick={() => { window.location.href = "/api/oauth/login"; }}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-1.8c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
                      Continue with GitHub
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {step === "form" && mode !== "reset" && (
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-green-500" />
                {mode === "signup" ? "Free plan available · No credit card required" : "Live in minutes · Works on any website"}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
