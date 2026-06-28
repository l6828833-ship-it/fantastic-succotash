import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect } from "react";
import {
  Building2, Bell, Puzzle, CreditCard, User, Save, Check, Globe, Users, Mail,
  Zap, Shield, ChevronRight, AlertCircle, CheckCircle2, ExternalLink, Plus, Trash2, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PLAN_CONFIG = {
  starter: {
    name: "Starter",
    price: "$29/mo",
    color: "text-blue-600 bg-blue-500/10 border-blue-200",
    features: ["1 AI Agent", "500 conversations/mo", "Basic analytics", "Email support"],
  },
  growth: {
    name: "Growth",
    price: "$79/mo",
    color: "text-purple-600 bg-purple-500/10 border-purple-200",
    features: ["5 AI Agents", "5,000 conversations/mo", "Advanced analytics", "Human handoff", "Priority support"],
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    color: "text-orange-600 bg-orange-500/10 border-orange-200",
    features: ["Unlimited agents", "Unlimited conversations", "Custom integrations", "SLA guarantee", "Dedicated support"],
  },
};

const INDUSTRY_OPTIONS = [
  "Information Technology", "E-Commerce & Retail", "Banking & Finance",
  "SaaS / Technology", "Telecom & Media", "Healthcare", "Education & Edtech",
  "Real Estate", "Govt & Public Sector", "Others",
];

const COMPANY_SIZE_OPTIONS = [
  "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+",
];

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("workspace");
  const [saved, setSaved] = useState(false);

  // Workspace state
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");

  // Email branding
  const [emailBrandName, setEmailBrandName] = useState("");
  const [emailLogoUrl, setEmailLogoUrl] = useState("");
  const [emailBrandColor, setEmailBrandColor] = useState("#6366f1");
  const [supportEmail, setSupportEmail] = useState("");
  const [emailSignature, setEmailSignature] = useState("");

  // Notification prefs
  const [notifEscalation, setNotifEscalation] = useState(true);
  const [notifNewTicket, setNotifNewTicket] = useState(true);
  const [notifCampaign, setNotifCampaign] = useState(true);
  const [notifNewConversation, setNotifNewConversation] = useState(false);
  const [notifEmail, setNotifEmail] = useState(true);

  const { data: workspace, refetch } = trpc.workspace.get.useQuery();
  const utils = trpc.useUtils();

  // Team members
  const { data: team = [] } = trpc.team.list.useQuery();
  const { data: seats } = trpc.team.seats.useQuery();
  const [tmName, setTmName] = useState("");
  const [tmEmail, setTmEmail] = useState("");
  const [tmRole, setTmRole] = useState<"admin" | "agent">("agent");
  const addMember = trpc.team.create.useMutation({
    onSuccess: () => { utils.team.list.invalidate(); utils.team.seats.invalidate(); setTmName(""); setTmEmail(""); setTmRole("agent"); toast.success("Team member invited"); },
    onError: (e) => toast.error(e.message || "Failed to add team member"),
  });
  const removeMember = trpc.team.delete.useMutation({
    onSuccess: () => { utils.team.list.invalidate(); utils.team.seats.invalidate(); },
    onError: () => toast.error("Failed to remove team member"),
  });

  const seatsFull = !!seats && seats.limit != null && seats.used >= seats.limit;

  const handleAddMember = () => {
    if (!tmName.trim() || !tmEmail.trim()) { toast.error("Name and email are required"); return; }
    addMember.mutate({ name: tmName, email: tmEmail, role: tmRole });
  };

  const updateWorkspace = trpc.workspace.update.useMutation({
    onSuccess: () => {
      refetch();
      setSaved(true);
      toast.success("Settings saved");
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => toast.error("Failed to save settings"),
  });

  useEffect(() => {
    if (workspace) {
      setCompanyName(workspace.companyName ?? "");
      setCompanyWebsite(workspace.companyWebsite ?? "");
      setIndustry(workspace.industry ?? "");
      setCompanySize(workspace.companySize ?? "");
      setEmailBrandName(workspace.emailBrandName ?? "");
      setEmailLogoUrl(workspace.emailLogoUrl ?? "");
      setEmailBrandColor(workspace.emailBrandColor ?? "#6366f1");
      setSupportEmail(workspace.supportEmail ?? "");
      setEmailSignature(workspace.emailSignature ?? "");
    }
  }, [workspace]);

  const handleSaveWorkspace = () => {
    updateWorkspace.mutate({ companyName, companyWebsite, industry, companySize });
  };

  const handleSaveEmailBranding = () => {
    updateWorkspace.mutate({
      emailBrandName: emailBrandName.trim() || null,
      emailLogoUrl: emailLogoUrl.trim() || null,
      emailBrandColor: emailBrandColor.trim() || null,
      supportEmail: supportEmail.trim() || null,
      emailSignature: emailSignature.trim() || null,
    });
  };

  const currentPlan = workspace?.plan ?? "starter";
  const planInfo = PLAN_CONFIG[currentPlan as keyof typeof PLAN_CONFIG] ?? PLAN_CONFIG.starter;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Settings sidebar */}
      <div className="w-56 shrink-0 border-r border-border bg-background flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">Settings</h2>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {[
            { id: "workspace", label: "Workspace", icon: Building2 },
            { id: "team", label: "Team", icon: Users },
            { id: "email", label: "Email Branding", icon: Mail },
            { id: "account", label: "My Account", icon: User },
            { id: "notifications", label: "Notifications", icon: Bell },
            { id: "integrations", label: "Integrations", icon: Puzzle },
            { id: "billing", label: "Billing & Plan", icon: CreditCard },
            { id: "security", label: "Security", icon: Shield },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                activeTab === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto">
        {/* Workspace Settings */}
        {activeTab === "workspace" && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Workspace Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage your company profile and workspace configuration.</p>
            </div>

            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Company Information</CardTitle>
                <CardDescription>This information is used to personalize your AI agents and reports.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp" />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Website</Label>
                    <Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://acme.com" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                      <SelectContent>
                        {INDUSTRY_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Company Size</Label>
                    <Select value={companySize} onValueChange={setCompanySize}>
                      <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                      <SelectContent>
                        {COMPANY_SIZE_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt} employees</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Active Features</CardTitle>
                <CardDescription>Features enabled for your workspace during onboarding.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(workspace?.features as string[] ?? []).map((f) => (
                    <Badge key={f} variant="secondary" className="capitalize">{f.replace(/_/g, " ")}</Badge>
                  ))}
                  {(!workspace?.features || (workspace.features as string[]).length === 0) && (
                    <p className="text-sm text-muted-foreground">No features configured. Complete onboarding to set up features.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveWorkspace} disabled={updateWorkspace.isPending || saved} className="gap-2">
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? "Saved!" : updateWorkspace.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}

        {/* Team Members */}
        {activeTab === "team" && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
              <p className="text-sm text-muted-foreground mt-1">Add the human agents on your team so they can handle conversations and tickets.</p>
              {seats && (
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium text-foreground">{seats.used}</span>
                  {seats.limit != null ? ` of ${seats.limit}` : ""} seats used
                  {seatsFull && <span className="text-amber-600"> — limit reached, upgrade your plan to add more</span>}
                </p>
              )}
            </div>

            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" />Invite a teammate</CardTitle>
                <CardDescription>They'll appear in your team list and can be assigned to tickets.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2 sm:col-span-1">
                    <Label>Name</Label>
                    <Input value={tmName} onChange={(e) => setTmName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label>Email</Label>
                    <Input value={tmEmail} onChange={(e) => setTmEmail(e.target.value)} placeholder="jane@company.com" />
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label>Role</Label>
                    <Select value={tmRole} onValueChange={(v) => setTmRole(v as "admin" | "agent")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleAddMember} disabled={addMember.isPending || seatsFull} className="gap-2">
                    <Plus className="w-4 h-4" />{addMember.isPending ? "Adding..." : "Add Member"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Your Team ({team.length + 1})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Owner (current user) */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{user?.name ?? "You"}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Owner</Badge>
                </div>

                {team.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No other team members yet. Invite your first teammate above.</p>
                ) : (
                  team.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">
                          {(m.name ?? m.email ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                        <Badge variant="secondary" className="text-xs capitalize">{m.status}</Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeMember.mutate({ id: m.id })}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Email Branding */}
        {activeTab === "email" && (
          <div className="p-6 max-w-4xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Email Branding</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Customize the transactional emails customers receive (ticket confirmations, etc.). Emails are sent from Chatrico for reliable delivery, with replies going to your support address.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form */}
              <Card className="border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Branding</CardTitle>
                  <CardDescription>Applied to every customer email from this workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Brand name</Label>
                    <Input value={emailBrandName} onChange={(e) => setEmailBrandName(e.target.value)} placeholder="Acme Support" />
                    <p className="text-xs text-muted-foreground">Shown in the email header and footer.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Support email (Reply-To)</Label>
                    <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@yourcompany.com" />
                    <p className="text-xs text-muted-foreground">When a customer replies to an email, it goes here.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Brand color</Label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(emailBrandColor) ? emailBrandColor : "#6366f1"} onChange={(e) => setEmailBrandColor(e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                      <Input value={emailBrandColor} onChange={(e) => setEmailBrandColor(e.target.value)} className="font-mono text-sm" placeholder="#6366f1" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Logo URL</Label>
                    <Input value={emailLogoUrl} onChange={(e) => setEmailLogoUrl(e.target.value)} placeholder="https://yourcompany.com/logo.png" />
                    <p className="text-xs text-muted-foreground">Optional. A hosted image URL shown in the email header instead of the brand name.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email signature</Label>
                    <textarea
                      value={emailSignature}
                      onChange={(e) => setEmailSignature(e.target.value)}
                      placeholder={"Thanks,\nThe Acme Team"}
                      rows={3}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
                    />
                    <p className="text-xs text-muted-foreground">Optional. Added to the bottom of the email body.</p>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSaveEmailBranding} disabled={updateWorkspace.isPending} className="gap-2">
                      {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      {updateWorkspace.isPending ? "Saving..." : "Save branding"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Live preview */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" /> Live preview
                </div>
                <div className="rounded-2xl border border-border bg-[#f4f4f7] p-4">
                  <div className="max-w-[480px] mx-auto bg-white border border-[#e5e7eb] rounded-[14px] overflow-hidden">
                    <div className="px-6 py-4" style={{ background: /^#[0-9a-fA-F]{3,8}$/.test(emailBrandColor) ? emailBrandColor : "#6366f1" }}>
                      {emailLogoUrl ? (
                        <img src={emailLogoUrl} alt={emailBrandName || "Logo"} className="max-h-8 max-w-[180px] object-contain" />
                      ) : (
                        <span className="text-white font-bold text-base">{emailBrandName || "Chatrico"}</span>
                      )}
                    </div>
                    <div className="px-6 py-5 text-[#111827]">
                      <h2 className="text-[17px] font-semibold m-0 mb-3">We've got your request</h2>
                      <p className="text-sm leading-relaxed m-0">Hi there,</p>
                      <p className="text-sm leading-relaxed mt-2">Thanks for reaching out. We've created a support ticket for you and our team will get back to you soon.</p>
                      <p className="text-sm text-[#6b7280] mt-2"><strong>Subject:</strong> Help with my order</p>
                      {emailSignature && <p className="text-[13px] text-[#6b7280] mt-4 whitespace-pre-line">{emailSignature}</p>}
                    </div>
                    <div className="px-6 py-3.5 border-t border-[#e5e7eb] text-[#9ca3af] text-xs">
                      Sent by {emailBrandName || "Chatrico"}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reply-To: <span className="font-medium text-foreground">{supportEmail || "(your support email)"}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Account Settings */}
        {activeTab === "account" && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">My Account</h3>
              <p className="text-sm text-muted-foreground mt-1">Your personal profile and account preferences.</p>
            </div>

            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                    {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{user?.name ?? "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{user?.email ?? "No email"}</p>
                    <Badge variant="outline" className="mt-1 text-xs capitalize">{user?.role}</Badge>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input defaultValue={user?.name ?? ""} placeholder="Your name" readOnly className="bg-muted/30" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input defaultValue={user?.email ?? ""} placeholder="your@email.com" readOnly className="bg-muted/30" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Profile details are managed through your Manus account. Changes sync automatically on next login.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Login Method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">{user?.loginMethod ?? "Email"}</p>
                      <p className="text-xs text-muted-foreground">Connected via Manus OAuth</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/10 text-green-600 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Notification Settings */}
        {activeTab === "notifications" && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Notification Preferences</h3>
              <p className="text-sm text-muted-foreground mt-1">Control which events trigger in-app and email notifications.</p>
            </div>

            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">In-App Notifications</CardTitle>
                <CardDescription>These appear in the notification bell in the sidebar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "AI → Human Escalations", description: "When a conversation is escalated from AI to a human agent", value: notifEscalation, onChange: setNotifEscalation },
                  { label: "New Tickets", description: "When a new support ticket is created", value: notifNewTicket, onChange: setNotifNewTicket },
                  { label: "Campaign Completions", description: "When a broadcast or drip campaign finishes sending", value: notifCampaign, onChange: setNotifCampaign },
                  { label: "New Conversations", description: "When a new visitor starts a conversation", value: notifNewConversation, onChange: setNotifNewConversation },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2">
                    <div className="flex-1 mr-4">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    <Switch checked={item.value} onCheckedChange={item.onChange} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Email Notifications</CardTitle>
                <CardDescription>Receive email summaries and alerts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-medium text-foreground">Email Alerts</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Receive email notifications for critical events</p>
                  </div>
                  <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => toast.success("Notification preferences saved")} className="gap-2">
                <Save className="w-4 h-4" />Save Preferences
              </Button>
            </div>
          </div>
        )}

        {/* Integrations */}
        {activeTab === "integrations" && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Integrations</h3>
              <p className="text-sm text-muted-foreground mt-1">Connect your chatbot to external platforms and messaging channels.</p>
            </div>

            <div className="grid gap-4">
              {[
                { name: "WhatsApp Business", desc: "Connect your WhatsApp Business account to handle conversations", icon: "💬", status: "available", color: "bg-green-500" },
                { name: "Email (IMAP/SMTP)", desc: "Route email support tickets directly into your inbox", icon: "📧", status: "available", color: "bg-blue-500" },
                { name: "Slack", desc: "Get escalation alerts and notifications in your Slack workspace", icon: "🔔", status: "available", color: "bg-purple-500" },
                { name: "Zapier", desc: "Connect to 5,000+ apps with no-code automation workflows", icon: "⚡", status: "available", color: "bg-orange-500" },
                { name: "Shopify", desc: "Sync product catalog and order data for e-commerce support", icon: "🛍️", status: "coming_soon", color: "bg-green-600" },
                { name: "Salesforce CRM", desc: "Sync contacts and conversations with your Salesforce instance", icon: "☁️", status: "coming_soon", color: "bg-blue-600" },
                { name: "HubSpot", desc: "Push leads and conversations to HubSpot CRM automatically", icon: "🔶", status: "coming_soon", color: "bg-orange-600" },
                { name: "Zendesk", desc: "Sync tickets bidirectionally with your Zendesk account", icon: "🎫", status: "coming_soon", color: "bg-green-700" },
              ].map((integration) => (
                <Card key={integration.name} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-xl", integration.color + "/10")}>
                          {integration.icon}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{integration.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{integration.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {integration.status === "coming_soon" ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Coming Soon</Badge>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => toast.info(`${integration.name} integration setup coming soon`)}>
                            Connect <ExternalLink className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Billing */}
        {activeTab === "billing" && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Billing & Plan</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage your subscription and billing details.</p>
            </div>

            {/* Current plan */}
            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Current Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("flex items-center justify-between p-4 rounded-lg border", planInfo.color)}>
                  <div>
                    <p className="font-bold text-lg">{planInfo.name}</p>
                    <p className="text-sm font-medium mt-0.5">{planInfo.price}</p>
                  </div>
                  <Badge className={planInfo.color}>Active</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {planInfo.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Plan comparison */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Available Plans</h4>
              <div className="grid gap-3">
                {Object.entries(PLAN_CONFIG).map(([key, plan]) => (
                  <Card key={key} className={cn("border-border cursor-pointer transition-all hover:shadow-md", currentPlan === key && "ring-2 ring-primary")}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{plan.name}</p>
                            {currentPlan === key && <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Current</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{plan.features.slice(0, 2).join(" · ")}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{plan.price}</p>
                          {currentPlan !== key && (
                            <Button size="sm" className="mt-2 h-7 text-xs" onClick={() => toast.info("Billing integration coming soon — contact support to upgrade")}>
                              {key === "enterprise" ? "Contact Sales" : "Upgrade"}
                              <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Card className="border-border bg-muted/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Need a custom plan?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Enterprise customers get custom limits, dedicated infrastructure, SLA guarantees, and a dedicated account manager.</p>
                    <Button size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={() => toast.info("Contact sales@chatbotpro.com for enterprise pricing")}>
                      Contact Sales <ExternalLink className="w-3 h-3 ml-1.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Security */}
        {activeTab === "security" && (
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Security</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage access control and security settings for your workspace.</p>
            </div>

            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Session & Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Current Session</p>
                    <p className="text-xs text-muted-foreground">Signed in as {user?.email} via {user?.loginMethod}</p>
                  </div>
                  <Badge className="bg-green-500/10 text-green-600 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Last Sign In</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString() : "Unknown"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">API Access</CardTitle>
                <CardDescription>Manage API keys for programmatic access to your workspace.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Workspace API Key</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">••••••••••••••••••••••••••••••••</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => toast.info("API key management coming soon")}>
                    Reveal Key
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Keep your API key secret. Never expose it in client-side code.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border border-destructive/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete Workspace</p>
                    <p className="text-xs text-muted-foreground">Permanently delete your workspace and all data. This cannot be undone.</p>
                  </div>
                  <Button size="sm" variant="destructive" className="h-8 text-xs shrink-0 ml-4" onClick={() => toast.error("Contact support to delete your workspace")}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
