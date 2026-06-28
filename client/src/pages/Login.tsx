import { useState } from "react";
import { Bot, Loader2, MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Mode = "login" | "signup";
type Step = "form" | "verify";

export default function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
  };

  // Login, or sign-up step 1 (request a code / create account).
  const submit = async () => {
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
        window.location.href = "/";
        return;
      }
      // signup
      const { ok, data } = await post("/api/auth/signup/request", { email: email.trim(), password, name: name.trim() });
      if (!ok) { toast.error(data.error || "Something went wrong"); return; }
      if (data.verified) { window.location.href = "/"; return; } // no email provider → created directly
      // OTP sent → move to verify step
      setStep("verify");
      toast.success("We emailed you a 6-digit verification code.");
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Sign-up step 2: verify the emailed code.
  const verify = async () => {
    if (!/^\d{4,8}$/.test(code.trim())) {
      toast.error("Enter the code we emailed you");
      return;
    }
    setLoading(true);
    try {
      const { ok, data } = await post("/api/auth/signup/verify", { email: email.trim(), code: code.trim() });
      if (!ok) { toast.error(data.error || "Invalid code"); return; }
      window.location.href = "/";
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setLoading(true);
    try {
      const { ok, data } = await post("/api/auth/signup/request", { email: email.trim(), password, name: name.trim() });
      if (!ok) { toast.error(data.error || "Could not resend the code"); return; }
      toast.success("A new code is on its way.");
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            {step === "verify" ? <MailCheck className="w-6 h-6 text-primary" /> : <Bot className="w-6 h-6 text-primary" />}
          </div>
          <h1 className="text-xl font-bold text-foreground">Welcome to Chatrico</h1>
          <p className="text-sm text-muted-foreground">
            {step === "verify"
              ? "Enter the code we sent to your email"
              : mode === "login" ? "Sign in to your account" : "Create your account to get started"}
          </p>
        </div>

        <Card className="border-border">
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
                    onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
                  />
                  <p className="text-xs text-muted-foreground">Sent to {email}</p>
                </div>
                <Button className="w-full gap-2" onClick={verify} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verify & create account
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
                    <Label className="text-sm">Password</Label>
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
      </div>
    </div>
  );
}
