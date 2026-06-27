import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Bot, Save, ArrowLeft, Play, Settings, Palette, Brain, Users, Clock, MessageSquare, Zap, Shield, Globe, ChevronRight, Upload, Loader2,
  MessageCircle, HelpCircle, Sparkles, Bell, Phone, Heart, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Link } from "wouter";

interface AgentEditProps { agentId: number; }

const HANDOFF_MODES = [
  {
    id: "ai_only",
    label: "AI Only",
    desc: "All conversations handled entirely by AI. No human agents involved.",
    icon: Bot,
    color: "border-blue-500 bg-blue-500/5 text-blue-600",
    badge: "Fully Automated",
  },
  {
    id: "ai_first_human_escalation",
    label: "AI First then Human Escalation",
    desc: "AI handles conversations first. Escalates to human agents when triggered.",
    icon: Zap,
    color: "border-orange-500 bg-orange-500/5 text-orange-600",
    badge: "Hybrid",
  },
  {
    id: "human_only",
    label: "Human Only",
    desc: "All conversations go directly to human agents. AI is not involved.",
    icon: Users,
    color: "border-green-500 bg-green-500/5 text-green-600",
    badge: "Manual",
  },
];

const ESCALATION_TRIGGERS = [
  "Customer requests human agent",
  "Negative sentiment detected",
  "Issue unresolved after 3 messages",
  "High-value customer detected",
  "Complaint or refund request",
  "Technical issue reported",
];

// Chat launcher button icons. The first ("chat") is free on every plan; the
// rest are premium and unlock on a paid plan. Ids must match the ICONS map in
// the embed widget (server/_core/widget.ts).
const LAUNCHER_ICONS: Array<{ id: string; label: string; Icon: typeof Bot; premium: boolean }> = [
  { id: "chat", label: "Chat", Icon: MessageCircle, premium: false },
  { id: "message", label: "Message", Icon: MessageSquare, premium: true },
  { id: "help", label: "Help", Icon: HelpCircle, premium: true },
  { id: "sparkles", label: "Sparkles", Icon: Sparkles, premium: true },
  { id: "bell", label: "Bell", Icon: Bell, premium: true },
  { id: "phone", label: "Phone", Icon: Phone, premium: true },
  { id: "zap", label: "Lightning", Icon: Zap, premium: true },
  { id: "heart", label: "Heart", Icon: Heart, premium: true },
];

export default function AgentEdit({ agentId }: AgentEditProps) {
  const [, navigate] = useLocation();
  const { data: agent, isLoading } = trpc.agent.get.useQuery({ id: agentId });
  const { data: workspace } = trpc.workspace.get.useQuery();
  const isPaidPlan = !!workspace?.plan && workspace.plan !== "starter" && workspace.plan !== "free";
  const updateAgent = trpc.agent.update.useMutation({
    onSuccess: () => toast.success("Agent updated successfully"),
    onError: () => toast.error("Failed to update agent"),
  });
  const getUploadUrl = trpc.upload.getUploadUrl.useMutation();

  // Form state
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("English");
  const [responseStyle, setResponseStyle] = useState("balanced");
  const [maxResponseLength, setMaxResponseLength] = useState("medium");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [handoffMode, setHandoffMode] = useState("ai_only");
  const [escalationTriggers, setEscalationTriggers] = useState<string[]>([]);
  const [escalationMessage, setEscalationMessage] = useState("");
  const [workingHoursEnabled, setWorkingHoursEnabled] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState("");
  const [workingHours, setWorkingHours] = useState<Record<string, { start: string; end: string; enabled: boolean }>>(() => ({
    Monday: { start: "09:00", end: "18:00", enabled: true },
    Tuesday: { start: "09:00", end: "18:00", enabled: true },
    Wednesday: { start: "09:00", end: "18:00", enabled: true },
    Thursday: { start: "09:00", end: "18:00", enabled: true },
    Friday: { start: "09:00", end: "18:00", enabled: true },
    Saturday: { start: "10:00", end: "16:00", enabled: false },
    Sunday: { start: "10:00", end: "16:00", enabled: false },
  }));
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false);
  // Widget style
  const [widgetColor, setWidgetColor] = useState("#6366f1");
  const [widgetPosition, setWidgetPosition] = useState("bottom-right");
  const [widgetSize, setWidgetSize] = useState("standard");
  const [widgetTheme, setWidgetTheme] = useState("light");
  const [widgetFont, setWidgetFont] = useState("Inter");
  const [launcherIcon, setLauncherIcon] = useState("chat");
  const [ticketMode, setTicketMode] = useState("off");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (agent) {
      setName(agent.name ?? "");
      setAvatarUrl(agent.avatarUrl ?? null);
      setTone(agent.tone ?? "professional");
      setLanguage(agent.language ?? "English");
      setResponseStyle(agent.responseStyle ?? "balanced");
      setMaxResponseLength(agent.maxResponseLength ?? "medium");
      setSystemPrompt(agent.systemPrompt ?? "");
      setFallbackMessage(agent.fallbackMessage ?? "");
      setWelcomeMessage(agent.welcomeMessage ?? "");
      setHandoffMode(agent.handoffMode ?? "ai_only");
      setEscalationTriggers((agent.escalationTriggers as string[]) ?? []);
      setEscalationMessage(agent.escalationMessage ?? "");
      setWorkingHoursEnabled(agent.workingHoursEnabled ?? false);
      setOfflineMessage(agent.offlineMessage ?? "");
      if (agent.workingHours && typeof agent.workingHours === "object") {
        setWorkingHours(agent.workingHours as Record<string, { start: string; end: string; enabled: boolean }>);
      }
      setLeadCaptureEnabled(agent.leadCaptureEnabled ?? false);
      setWidgetColor(agent.widgetColor ?? "#6366f1");
      setWidgetPosition(agent.widgetPosition ?? "bottom-right");
      setWidgetSize(agent.widgetSize ?? "standard");
      setWidgetTheme(agent.widgetTheme ?? "light");
      setWidgetFont(agent.widgetFont ?? "Inter");
      setLauncherIcon(LAUNCHER_ICONS.some((i) => i.id === agent.launcherIconUrl) ? (agent.launcherIconUrl as string) : "chat");
      setTicketMode(agent.ticketMode ?? "off");
      setIsActive(agent.isActive ?? true);
    }
  }, [agent]);

  const handleSave = () => {
    updateAgent.mutate({
      id: agentId,
      name, avatarUrl,
      tone: tone as "formal" | "friendly" | "professional" | "casual" | "empathetic",
      language, responseStyle: responseStyle as "conservative" | "balanced" | "creative",
      maxResponseLength: maxResponseLength as "short" | "medium" | "long",
      systemPrompt, fallbackMessage, welcomeMessage,
      handoffMode: handoffMode as "ai_only" | "ai_first_human_escalation" | "human_only",
      escalationTriggers, escalationMessage, workingHoursEnabled, offlineMessage, workingHours,
      leadCaptureEnabled, widgetColor,
      widgetPosition: widgetPosition as "bottom-right" | "bottom-left",
      widgetSize: widgetSize as "compact" | "standard" | "large",
      widgetTheme: widgetTheme as "light" | "dark",
      widgetFont, isActive,
      launcherIconUrl: launcherIcon,
      ticketMode: ticketMode as "off" | "always" | "ai_fallback",
    });
  };

  const toggleTrigger = (t: string) => {
    setEscalationTriggers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image too large. Max 5MB."); return; }
    setIsUploading(true);
    try {
      const { key, uploadEndpoint } = await getUploadUrl.mutateAsync({ filename: file.name, contentType: file.type, folder: "agent-avatars" });
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      setAvatarUrl(`/manus-storage/${key}`);
      toast.success("Icon uploaded — click Save Changes to apply");
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-center">
          <Bot className="w-8 h-8 text-primary animate-pulse mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Loading agent...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Agent not found</p>
        <Link href="/agents"><Button variant="outline" className="mt-4">Back to Agents</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/agents">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{agent.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={isActive ? "default" : "secondary"} className="text-xs">{isActive ? "Active" : "Inactive"}</Badge>
              <span className="text-xs text-muted-foreground capitalize">{handoffMode.replace(/_/g, " ")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/playground/${agentId}`}>
            <Button variant="outline" className="gap-2">
              <Play className="w-4 h-4" />
              Test Agent
            </Button>
          </Link>
          <Button onClick={handleSave} disabled={updateAgent.isPending} className="gap-2">
            <Save className="w-4 h-4" />
            {updateAgent.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="behavior">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="behavior" className="gap-1.5 text-xs"><Brain className="w-3.5 h-3.5" />Behavior</TabsTrigger>
          <TabsTrigger value="handoff" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" />Handoff</TabsTrigger>
          <TabsTrigger value="style" className="gap-1.5 text-xs"><Palette className="w-3.5 h-3.5" />Style</TabsTrigger>
          <TabsTrigger value="hours" className="gap-1.5 text-xs"><Clock className="w-3.5 h-3.5" />Hours</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs"><Settings className="w-3.5 h-3.5" />Settings</TabsTrigger>
        </TabsList>

        {/* ─── BEHAVIOR TAB ─── */}
        <TabsContent value="behavior" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Identity & Personality</CardTitle>
                <CardDescription className="text-xs">Define how your agent presents itself</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Agent Icon</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border border-border">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Agent icon" className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {avatarUrl ? "Change" : "Upload"}
                    </Button>
                    {avatarUrl && (
                      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setAvatarUrl(null)}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">PNG, JPG or GIF (max 5MB). Shown to customers in the chat widget.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Agent Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Support Assistant" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Tone of Voice</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">🎩 Formal — Professional and structured</SelectItem>
                      <SelectItem value="friendly">😊 Friendly — Warm and approachable</SelectItem>
                      <SelectItem value="professional">💼 Professional — Balanced and business-like</SelectItem>
                      <SelectItem value="casual">👋 Casual — Relaxed and conversational</SelectItem>
                      <SelectItem value="empathetic">💙 Empathetic — Understanding and supportive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Response Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["English", "Arabic", "French", "Spanish", "German", "Portuguese", "Chinese", "Japanese", "Hindi", "Auto-detect"].map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Response Style</CardTitle>
                <CardDescription className="text-xs">Control how the AI generates answers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Answer Guidance</Label>
                  <div className="space-y-2">
                    {[
                      { id: "conservative", label: "Conservative", desc: "Only answers when response is certain from sources" },
                      { id: "balanced", label: "Balanced", desc: "Uses knowledge base + general knowledge when needed" },
                      { id: "creative", label: "Creative", desc: "Full knowledge for comprehensive, creative answers" },
                    ].map((rs) => (
                      <button
                        key={rs.id}
                        onClick={() => setResponseStyle(rs.id)}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                          responseStyle === rs.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"
                        )}
                      >
                        <div className={cn("w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center", responseStyle === rs.id ? "border-primary" : "border-muted-foreground")}>
                          {responseStyle === rs.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{rs.label}</p>
                          <p className="text-xs text-muted-foreground">{rs.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Response Length</Label>
                  <Select value={maxResponseLength} onValueChange={setMaxResponseLength}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short — 1-2 sentences</SelectItem>
                      <SelectItem value="medium">Medium — 3-5 sentences</SelectItem>
                      <SelectItem value="long">Long — Detailed paragraphs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">System Prompt & Messages</CardTitle>
              <CardDescription className="text-xs">Define the agent's core instructions and default messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">System Prompt</Label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are a helpful customer support agent for [Company]. Be professional, concise, and always try to resolve the customer's issue..."
                  rows={5}
                  className="resize-none font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">This defines the agent's core behavior and knowledge context.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Welcome Message</Label>
                  <Textarea
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="Hi! How can I help you today?"
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Fallback Message</Label>
                  <Textarea
                    value={fallbackMessage}
                    onChange={(e) => setFallbackMessage(e.target.value)}
                    placeholder="I'm sorry, I couldn't find an answer. Let me connect you with a human agent."
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── HANDOFF TAB ─── */}
        <TabsContent value="handoff" className="mt-6 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Human Handoff Mode</CardTitle>
              <CardDescription className="text-xs">Choose how conversations are handled between AI and human agents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {HANDOFF_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setHandoffMode(mode.id)}
                    className={cn(
                      "w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150",
                      handoffMode === mode.id ? mode.color + " border-current" : "border-border hover:bg-accent/30"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", handoffMode === mode.id ? "bg-current/10" : "bg-muted")}>
                      <Icon className={cn("w-5 h-5", handoffMode === mode.id ? "" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm text-foreground">{mode.label}</p>
                        <Badge variant="outline" className="text-xs">{mode.badge}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{mode.desc}</p>
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center", handoffMode === mode.id ? "border-primary" : "border-muted-foreground")}>
                      {handoffMode === mode.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {handoffMode === "ai_first_human_escalation" && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Escalation Configuration</CardTitle>
                <CardDescription className="text-xs">Define when and how the AI should escalate to a human agent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Escalation Triggers</Label>
                  <p className="text-xs text-muted-foreground">Select the conditions that will trigger a handoff to a human agent</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {ESCALATION_TRIGGERS.map((trigger) => (
                      <button
                        key={trigger}
                        onClick={() => toggleTrigger(trigger)}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg border text-left text-xs transition-all",
                          escalationTriggers.includes(trigger) ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-accent/30"
                        )}
                      >
                        <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center shrink-0", escalationTriggers.includes(trigger) ? "border-primary bg-primary" : "border-muted-foreground")}>
                          {escalationTriggers.includes(trigger) && <span className="text-white text-xs">✓</span>}
                        </div>
                        {trigger}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Escalation Message</Label>
                  <Textarea
                    value={escalationMessage}
                    onChange={(e) => setEscalationMessage(e.target.value)}
                    placeholder="I'm connecting you with a human agent who can better assist you. Please hold on..."
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── STYLE TAB ─── */}
        <TabsContent value="style" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Widget Appearance</CardTitle>
                  <CardDescription className="text-xs">Customize how the chat widget looks on your website</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Brand Color</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={widgetColor}
                        onChange={(e) => setWidgetColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                      />
                      <Input value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="font-mono text-sm" />
                    </div>
                    <div className="flex gap-2 mt-2">
                      {["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"].map((c) => (
                        <button key={c} onClick={() => setWidgetColor(c)} className={cn("w-6 h-6 rounded-full border-2 transition-transform hover:scale-110", widgetColor === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Widget Position</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: "bottom-right", label: "Bottom Right" }, { id: "bottom-left", label: "Bottom Left" }].map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() => setWidgetPosition(pos.id)}
                          className={cn("p-3 rounded-lg border text-sm font-medium transition-all", widgetPosition === pos.id ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-accent/30")}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Widget Size</Label>
                    <Select value={widgetSize} onValueChange={setWidgetSize}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Widget Theme</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: "light", label: "☀️ Light" }, { id: "dark", label: "🌙 Dark" }].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setWidgetTheme(t.id)}
                          className={cn("p-3 rounded-lg border text-sm font-medium transition-all", widgetTheme === t.id ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-accent/30")}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Font Family</Label>
                    <Select value={widgetFont} onValueChange={setWidgetFont}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Inter", "Plus Jakarta Sans", "Roboto", "Open Sans", "Lato", "Poppins", "Nunito"].map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Chat Button Icon</Label>
                      {!isPaidPlan && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Premium icons need a paid plan
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {LAUNCHER_ICONS.map(({ id, label, Icon, premium }) => {
                        const locked = premium && !isPaidPlan;
                        const selected = launcherIcon === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            title={locked ? `${label} — upgrade to unlock` : label}
                            onClick={() => {
                              if (locked) {
                                toast.error("Upgrade to a paid plan to use this chat icon");
                                return;
                              }
                              setLauncherIcon(id);
                            }}
                            className={cn(
                              "relative aspect-square rounded-lg border flex items-center justify-center transition-all",
                              selected ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-accent/30",
                              locked && "opacity-60 cursor-not-allowed hover:bg-transparent"
                            )}
                          >
                            <Icon className="w-5 h-5" />
                            {locked && (
                              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                                <Lock className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The Chat icon is free on every plan. Other icons unlock on a paid plan.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Preview */}
            <div className="space-y-4">
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                Live Preview
              </div>
              <div className="relative bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 min-h-96 border border-border overflow-hidden">
                {/* Simulated website background */}
                <div className="space-y-3 opacity-30">
                  <div className="h-4 bg-slate-400 rounded w-3/4" />
                  <div className="h-3 bg-slate-400 rounded w-full" />
                  <div className="h-3 bg-slate-400 rounded w-5/6" />
                  <div className="h-3 bg-slate-400 rounded w-4/5" />
                </div>

                {/* Widget preview */}
                <div className={cn("absolute bottom-4", widgetPosition === "bottom-right" ? "right-4" : "left-4")}>
                  {/* Chat bubble */}
                  <div
                    className={cn(
                      "rounded-2xl shadow-2xl border border-white/20 overflow-hidden",
                      widgetSize === "compact" ? "w-64" : widgetSize === "large" ? "w-80" : "w-72",
                      widgetTheme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900"
                    )}
                    style={{ fontFamily: widgetFont }}
                  >
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: widgetColor }}>
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
                        {agent.avatarUrl ? <img src={agent.avatarUrl} alt="" className="w-full h-full object-cover" /> : <Bot className="w-4 h-4 text-white" />}
                      </div>
                      <div>
                        <p className="text-white text-sm font-semibold">{name || "AI Assistant"}</p>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          <p className="text-white/80 text-xs">Online</p>
                        </div>
                      </div>
                    </div>
                    {/* Messages */}
                    <div className={cn("p-3 space-y-2", widgetTheme === "dark" ? "bg-gray-900" : "bg-gray-50")}>
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: widgetColor }}>
                          {agent.avatarUrl ? <img src={agent.avatarUrl} alt="" className="w-full h-full object-cover" /> : <Bot className="w-3 h-3 text-white" />}
                        </div>
                        <div className={cn("rounded-2xl rounded-tl-sm px-3 py-2 text-xs max-w-48", widgetTheme === "dark" ? "bg-gray-700 text-gray-100" : "bg-white text-gray-800 shadow-sm")}>
                          {welcomeMessage || "Hi! How can I help you today?"}
                        </div>
                      </div>
                    </div>
                    {/* Input */}
                    <div className={cn("px-3 py-2.5 flex items-center gap-2 border-t", widgetTheme === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100")}>
                      <div className={cn("flex-1 rounded-full px-3 py-1.5 text-xs", widgetTheme === "dark" ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-400")}>
                        Type a message...
                      </div>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: widgetColor }}>
                        <ChevronRight className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Launcher button */}
                  <div className={cn("flex mt-3", widgetPosition === "bottom-right" ? "justify-end" : "justify-start")}>
                    <div className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: widgetColor }}>
                      {(() => {
                        const LauncherIcon = (LAUNCHER_ICONS.find((i) => i.id === launcherIcon) ?? LAUNCHER_ICONS[0]).Icon;
                        return <LauncherIcon className="w-6 h-6 text-white" />;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── HOURS TAB ─── */}
        <TabsContent value="hours" className="mt-6 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Working Hours</CardTitle>
                  <CardDescription className="text-xs">Set when the agent is available to respond</CardDescription>
                </div>
                <Switch checked={workingHoursEnabled} onCheckedChange={setWorkingHoursEnabled} />
              </div>
            </CardHeader>
            {workingHoursEnabled && (
              <CardContent className="space-y-3">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                  const dayHours = workingHours[day] ?? { start: "09:00", end: "18:00", enabled: true };
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <Switch
                        checked={dayHours.enabled}
                        onCheckedChange={(v) => setWorkingHours((prev) => ({ ...prev, [day]: { ...prev[day], enabled: v } }))}
                      />
                      <div className={cn("w-24 text-sm font-medium", dayHours.enabled ? "text-foreground" : "text-muted-foreground")}>{day}</div>
                      <Input
                        type="time"
                        value={dayHours.start}
                        onChange={(e) => setWorkingHours((prev) => ({ ...prev, [day]: { ...prev[day], start: e.target.value } }))}
                        disabled={!dayHours.enabled}
                        className="w-28 text-sm"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="time"
                        value={dayHours.end}
                        onChange={(e) => setWorkingHours((prev) => ({ ...prev, [day]: { ...prev[day], end: e.target.value } }))}
                        disabled={!dayHours.enabled}
                        className="w-28 text-sm"
                      />
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Offline Message</CardTitle>
              <CardDescription className="text-xs">Message shown when the agent is outside working hours</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={offlineMessage}
                onChange={(e) => setOfflineMessage(e.target.value)}
                placeholder="We're currently offline. Leave a message and we'll get back to you during business hours."
                rows={3}
                className="resize-none text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── SETTINGS TAB ─── */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Agent Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-foreground text-sm">Agent Active</p>
                  <p className="text-xs text-muted-foreground">When disabled, the agent will not respond to any conversations</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Lead Capture</CardTitle>
              <CardDescription className="text-xs">Collect visitor information before starting a conversation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-foreground text-sm">Enable Lead Capture</p>
                  <p className="text-xs text-muted-foreground">Ask for name and email before the conversation starts</p>
                </div>
                <Switch checked={leadCaptureEnabled} onCheckedChange={setLeadCaptureEnabled} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Ticketing</CardTitle>
              <CardDescription className="text-xs">Let visitors open a support ticket from the chat widget</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">When to offer a ticket</Label>
                <Select value={ticketMode} onValueChange={setTicketMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off — no ticket option</SelectItem>
                    <SelectItem value="always">Always — show from the start of chat</SelectItem>
                    <SelectItem value="ai_fallback">When the AI can't help — offer a ticket automatically</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Tickets appear in your Tickets inbox. Escalating a conversation to a human also creates a ticket automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
