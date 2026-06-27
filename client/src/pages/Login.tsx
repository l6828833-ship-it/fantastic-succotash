import { useState } from "react";
import { Bot, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Step = "login" | "signup" | "signup-otp" | "reset" | "reset-otp";

async function post(path: string, payload: Record<string, unknown>) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data } as { ok: boolean; data: { error?: string } };
}

export default function Login() {
  const [step, setStep] = useState<Step>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    try { await fn(); } catch { toast.error("Could not reach the server. Please try again."); }
    finally { setLoading(false); }
  };

  const doLogin = () => run(async () => {
    if (!email.trim() || !password) { toast.error("Enter your email and password"); return; }
    const { ok, data } = await post("/api/auth/login", { email: email.trim(), password });
    if (!ok) { toast.error(data.error || "Sign in failed"); return; }
    window.location.href = "/";
  });

  const doSignupRequest = () => run(async () => {
    if (!email.trim() || password.length < 8) { toast.error("Enter your details (password 8+ chars)"); return; }
    const { ok, data } = await post("/api/auth/signup/request", { name: name.trim(), email: email.trim(), password });
    if (!ok) { toast.error(data.error || "Could not send code"); return; }
    toast.success("We emailed you a 6-digit code");
    setCode(""); setStep("signup-otp");
  });

  const doSignupVerify = () => run(async () => {
    if (code.trim().length < 4) { toast.error("Enter the code from your email"); return; }
    const { ok, data } = await post("/api/auth/signup/verify", { email: email.trim(), code: code.trim() });
    if (!ok) { toast.error(data.error || "Verification failed"); return; }
    window.location.href = "/";
  });

  const doResetRequest = () => run(async () => {
    if (!email.trim()) { toast.error("Enter your email"); return; }
    const { ok, data } = await post("/api/auth/reset/request", { email: email.trim() });
    if (!ok) { toast.error(data.error || "Could not send code"); return; }
    toast.success("If that email exists, a reset code is on its way");
    setCode(""); setPassword(""); setConfirm(""); setStep("reset-otp");
  });

  const doResetVerify = () => run(async () => {
    if (code.trim().length < 4) { toast.error("Enter the code from your email"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    const { ok, data } = await post("/api/auth/reset/verify", { email: email.trim(), code: code.trim(), password });
    if (!ok) { toast.error(data.error || "Reset failed"); return; }
    toast.success("Password updated");
    window.location.href = "/";
  });


  const onForm = step === "login" || step === "signup";
  const subtitle =
    step === "login" ? "Sign in to your account"
    : step === "signup" ? "Create your account to get started"
    : step === "reset" ? "Reset your password"
    : `Enter the 6-digit code we sent to ${email}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Welcome to ChatBot Pro</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            {onForm && (
              <Tabs value={step} onValueChange={(v) => { setStep(v as Step); setCode(""); }}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="login">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {onForm && (
              <div className="space-y-3">
                {step === "signup" && (
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
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={step === "signup" ? "At least 8 characters" : "Your password"}
                    onKeyDown={(e) => { if (e.key === "Enter") (step === "signup" ? doSignupRequest() : doLogin()); }} />
                </div>
                <Button className="w-full gap-2" onClick={step === "signup" ? doSignupRequest : doLogin} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {step === "signup" ? "Send code" : "Sign in"}
                </Button>
                {step === "login" && (
                  <button className="text-xs text-muted-foreground hover:text-foreground w-full text-center" onClick={() => { setStep("reset"); }}>
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            {step === "signup-otp" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Verification code</Label>
                  <Input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456"
                    className="text-center tracking-[6px] font-mono"
                    onKeyDown={(e) => { if (e.key === "Enter") doSignupVerify(); }} />
                </div>
                <Button className="w-full gap-2" onClick={doSignupVerify} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}Verify & create account
                </Button>
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto" onClick={() => setStep("signup")}>
                  <ArrowLeft className="w-3 h-3" />Back
                </button>
              </div>
            )}

            {step === "reset" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                    onKeyDown={(e) => { if (e.key === "Enter") doResetRequest(); }} />
                </div>
                <Button className="w-full gap-2" onClick={doResetRequest} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}Send reset code
                </Button>
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto" onClick={() => setStep("login")}>
                  <ArrowLeft className="w-3 h-3" />Back to sign in
                </button>
              </div>
            )}

            {step === "reset-otp" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Verification code</Label>
                  <Input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="text-center tracking-[6px] font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">New password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Confirm password</Label>
                  <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password"
                    onKeyDown={(e) => { if (e.key === "Enter") doResetVerify(); }} />
                </div>
                <Button className="w-full gap-2" onClick={doResetVerify} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}Reset password
                </Button>
                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto" onClick={() => setStep("login")}>
                  <ArrowLeft className="w-3 h-3" />Back to sign in
                </button>
              </div>
            )}

            {onForm && (
              <>
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
