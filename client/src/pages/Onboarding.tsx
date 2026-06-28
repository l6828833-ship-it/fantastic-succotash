import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Globe,
  MessageSquare,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const INDUSTRIES = [
  { id: "ecommerce", label: "E-Commerce & Retail", icon: "🛍️" },
  { id: "saas", label: "SaaS / Technology", icon: "💻" },
  { id: "banking", label: "Banking & Finance", icon: "🏦" },
  { id: "telecom", label: "Telecom & Media", icon: "📡" },
  { id: "healthcare", label: "Healthcare", icon: "🏥" },
  { id: "education", label: "Education & EdTech", icon: "🎓" },
  { id: "realestate", label: "Real Estate", icon: "🏠" },
  { id: "govt", label: "Govt & Public Sector", icon: "🏛️" },
  { id: "sme", label: "SME / Small Business", icon: "🏪" },
  { id: "other", label: "Others", icon: "✨" },
];

const COMPANY_SIZES = [
  { id: "1-10", label: "1–10", desc: "Just getting started" },
  { id: "11-50", label: "11–50", desc: "Growing team" },
  { id: "51-200", label: "51–200", desc: "Mid-size company" },
  { id: "201-500", label: "201–500", desc: "Established business" },
  { id: "500+", label: "500+", desc: "Enterprise" },
];

const FEATURES = [
  { id: "ai_agent", label: "AI Agent", icon: Bot, desc: "Automate customer conversations with AI" },
  { id: "human_support", label: "Human Support", icon: Users, desc: "Live agent inbox and escalation" },
  { id: "ticketing", label: "Ticketing", icon: MessageSquare, desc: "Track and resolve customer issues" },
];

const PLANS = [
  { id: "free", label: "Free", price: "$0", features: ["1 AI Agent", "50 AI conversations/mo", "Unlimited human chats", "30 contacts"], highlight: false },
  { id: "starter", label: "Starter", price: "$9.99/mo", features: ["2 AI Agents", "1,000 AI conversations/mo", "Unlimited tickets", "Remove branding"], highlight: false },
  { id: "pro", label: "Pro", price: "$49/mo", features: ["5 AI Agents", "6,000 AI conversations/mo", "Advanced analytics", "Human handoff"], highlight: true },
  { id: "business", label: "Business", price: "$129/mo", features: ["15 AI Agents", "20,000 AI conversations/mo", "Multi-language", "25 seats"], highlight: false },
];

const steps = [
  { id: 1, label: "Industry", icon: Building2 },
  { id: 2, label: "Team Size", icon: Users },
  { id: 3, label: "Company Info", icon: Globe },
  { id: 4, label: "Features", icon: Sparkles },
  { id: 5, label: "Plan", icon: Zap },
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [plan, setPlan] = useState("free");

  const updateWorkspace = trpc.workspace.update.useMutation();
  const createAgent = trpc.agent.create.useMutation();
  const utils = trpc.useUtils();

  const canProceed = () => {
    if (step === 1) return !!industry;
    if (step === 2) return !!companySize;
    if (step === 3) return !!companyName.trim();
    if (step === 4) return selectedFeatures.length > 0;
    return true;
  };

  const toggleFeature = (id: string) => {
    setSelectedFeatures((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]);
  };

  const handleFinish = async () => {
    try {
      const updated = await updateWorkspace.mutateAsync({
        industry,
        companyName,
        companySize,
        companyWebsite: companyWebsite || undefined,
        features: selectedFeatures,
        onboardingCompleted: true,
        onboardingStep: 5,
      });

      // Push the updated workspace straight into the query cache so the app
      // transitions instantly (no refetch wait).
      if (updated) utils.workspace.get.setData(undefined, updated);

      // Create a default agent in the background.
      const industryLabel = INDUSTRIES.find((i) => i.id === industry)?.label ?? "General";
      createAgent.mutate({
        name: `${companyName || "My"} Assistant`,
        tone: "professional",
        language: "English",
        responseStyle: "balanced",
        handoffMode: selectedFeatures.includes("human_support") ? "ai_first_human_escalation" : "ai_only",
        welcomeMessage: `Hi! I'm the ${companyName || "support"} AI assistant. How can I help you today?`,
        systemPrompt: `You are a helpful AI assistant for ${companyName || "our company"}, a company in the ${industryLabel} industry. Be professional, helpful, and concise in your responses.`,
        fallbackMessage: "I'm sorry, I don't have information about that. Let me connect you with a human agent.",
      });

      // The workspace always starts on Free. If a paid plan was selected, send
      // the user to checkout to pay — the plan only activates after payment.
      const paid = ["starter", "pro", "business"].includes(plan);
      if (paid) {
        toast.success("Workspace ready! Complete payment to activate your plan.");
        navigate(`/settings?upgrade=${plan}`);
      } else {
        toast.success("Welcome aboard! Your workspace is ready.");
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    }
  };

  const handleSkip = async () => {
    try {
      const updated = await updateWorkspace.mutateAsync({
        companyName: companyName || "My Company",
        industry: industry || undefined,
        companySize: companySize || undefined,
        features: selectedFeatures.length > 0 ? selectedFeatures : ["ai_agent"],
        onboardingCompleted: true,
        onboardingStep: 5,
      });
      if (updated) utils.workspace.get.setData(undefined, updated);
      navigate("/dashboard");
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground">Chatrico</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Step {step} of {steps.length}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={handleSkip}
            disabled={updateWorkspace.isPending}
          >
            Skip for now
          </Button>
        </div>
      </div>
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 py-6 px-4">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all duration-300",
              step > s.id ? "bg-primary text-primary-foreground" : step === s.id ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted text-muted-foreground"
            )}>
              {step > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.id}
            </div>
            <span className={cn("text-xs font-medium hidden sm:block", step === s.id ? "text-foreground" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={cn("w-8 h-0.5 mx-1 rounded-full transition-all duration-300", step > s.id ? "bg-primary" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-start justify-center px-4 pb-8">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
              {/* Step 1: Industry */}
              {step === 1 && (
                <div>
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-foreground mb-2">Welcome! Let's know you better</h1>
                    <p className="text-muted-foreground">Select your industry so we can configure the best defaults for your AI agent.</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.id}
                        onClick={() => setIndustry(ind.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all duration-150 hover:border-primary/50 hover:bg-accent/50",
                          industry === ind.id ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground"
                        )}
                      >
                        <span className="text-2xl">{ind.icon}</span>
                        <span className="text-center leading-tight">{ind.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Company Size */}
              {step === 2 && (
                <div>
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-foreground mb-2">How many people work at your company?</h1>
                    <p className="text-muted-foreground">This helps us recommend the right plan and features for your team.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {COMPANY_SIZES.map((size) => (
                      <button
                        key={size.id}
                        onClick={() => setCompanySize(size.id)}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150 hover:border-primary/50 hover:bg-accent/50",
                          companySize === size.id ? "border-primary bg-primary/5" : "border-border"
                        )}
                      >
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0", companySize === size.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          {size.id.includes("+") ? "∞" : size.id.split("-")[0]}
                        </div>
                        <div className="min-w-0">
                          <p className={cn("font-semibold truncate", companySize === size.id ? "text-primary" : "text-foreground")}>{size.label} employees</p>
                          <p className="text-sm text-muted-foreground truncate">{size.desc}</p>
                        </div>
                        {companySize === size.id && <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Company Info */}
              {step === 3 && (
                <div>
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-foreground mb-2">Tell us about your company</h1>
                    <p className="text-muted-foreground">This information will be used to personalize your AI agent.</p>
                  </div>
                  <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-sm font-medium">Company Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="companyName"
                        placeholder="Enter your company name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyWebsite" className="text-sm font-medium">Company Website <span className="text-muted-foreground">(Optional)</span></Label>
                      <Input
                        id="companyWebsite"
                        placeholder="https://yourcompany.com"
                        value={companyWebsite}
                        onChange={(e) => setCompanyWebsite(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Features */}
              {step === 4 && (
                <div>
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-foreground mb-2">Which features will you use?</h1>
                    <p className="text-muted-foreground">Select one or more features to support your customers. You can always change this later.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FEATURES.map((feat) => {
                      const Icon = feat.icon;
                      const selected = selectedFeatures.includes(feat.id);
                      return (
                        <button
                          key={feat.id}
                          onClick={() => toggleFeature(feat.id)}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150 hover:border-primary/50",
                            selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"
                          )}
                        >
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className={cn("font-semibold text-sm", selected ? "text-primary" : "text-foreground")}>{feat.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{feat.desc}</p>
                          </div>
                          {selected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 5: Plan */}
              {step === 5 && (
                <div>
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-foreground mb-2">Choose your plan</h1>
                    <p className="text-muted-foreground">Start free and upgrade as you grow. No credit card required.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {PLANS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPlan(p.id)}
                        className={cn(
                          "relative flex flex-col p-5 rounded-xl border-2 text-left transition-all duration-150",
                          plan === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/20",
                          p.highlight && "ring-2 ring-primary/20"
                        )}
                      >
                        {p.highlight && (
                          <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs">Most Popular</Badge>
                        )}
                        <div className="mb-3">
                          <p className="font-bold text-foreground">{p.label}</p>
                          <p className="text-2xl font-bold text-primary mt-1">{p.price}</p>
                        </div>
                        <ul className="space-y-1.5">
                          {p.features.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        {plan === p.id && (
                          <div className="mt-3 pt-3 border-t border-primary/20">
                            <span className="text-xs font-medium text-primary">Selected ✓</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            {step < 5 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={updateWorkspace.isPending || createAgent.isPending}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                {updateWorkspace.isPending ? "Setting up..." : "Launch Platform"}
                <Sparkles className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
