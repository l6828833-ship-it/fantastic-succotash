import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Megaphone, Plus, Send, Clock, CheckCircle2, AlertCircle, Users, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHANNELS } from "@/lib/channels";
import { toast } from "sonner";

const STATUS_CONFIG = {
  draft: { label: "Draft", color: "text-slate-600 bg-slate-100" },
  scheduled: { label: "Scheduled", color: "text-blue-600 bg-blue-100" },
  running: { label: "Running", color: "text-orange-600 bg-orange-100" },
  completed: { label: "Completed", color: "text-green-600 bg-green-100" },
  paused: { label: "Paused", color: "text-amber-600 bg-amber-100" },
};

export default function Campaigns() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"broadcast" | "drip">("broadcast");
  const [channel, setChannel] = useState("web");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);

  const { data: campaigns, refetch } = trpc.campaigns.list.useQuery();
  const { data: contactStats } = trpc.contacts.stats.useQuery();
  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); setName(""); setMessage(""); toast.success("Campaign created!"); },
    onError: () => toast.error("Failed to create campaign"),
  });
  const sendCampaign = trpc.campaigns.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Campaign sent!"); },
    onError: () => toast.error("Failed to send campaign"),
  });

  const selectedCampaignData = campaigns?.find((c) => c.id === selectedCampaign);

  const handleCreate = () => {
    if (!name.trim() || !message.trim()) { toast.error("Name and message are required"); return; }
    createCampaign.mutate({
      name, message, type,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Campaign list */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col bg-background">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Campaigns</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-8 text-xs"><Plus className="w-3.5 h-3.5" />New</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input placeholder="e.g. Welcome Series" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="broadcast">Broadcast</SelectItem>
                          <SelectItem value="drip">Drip Sequence</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Channel</Label>
                      <Select value={channel} onValueChange={setChannel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHANNELS.map((c) => (
                            <SelectItem key={c.id} value={c.id} disabled={!c.available}>
                              {c.icon} {c.label}{!c.available ? " (coming soon)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Audience: <span className="font-medium text-foreground">{contactStats?.subscribed ?? 0} subscribed contacts</span> will receive this campaign.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea
                      placeholder="Write your campaign message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Schedule (Optional)</Label>
                    <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={handleCreate} disabled={createCampaign.isPending}>
                    {createCampaign.isPending ? "Creating..." : "Create Campaign"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="grid grid-cols-3 w-full h-8">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="draft" className="text-xs">Draft</TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">Sent</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto">
          {(() => {
            const visible = (campaigns ?? []).filter((c) =>
              statusFilter === "all" ? true : statusFilter === "completed"
                ? c.status === "completed" || c.status === "running"
                : c.status === statusFilter
            );
            return !visible || visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <Megaphone className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No campaigns yet</p>
            </div>
          ) : (
            visible.map((campaign) => {
              const status = STATUS_CONFIG[campaign.status as keyof typeof STATUS_CONFIG];
              return (
                <button
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-4 border-b border-border text-left hover:bg-accent/30 transition-colors",
                    selectedCampaign === campaign.id && "bg-accent/50 border-l-2 border-l-primary"
                  )}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{campaign.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", status?.color)}>{status?.label}</span>
                      <span className="text-xs text-muted-foreground capitalize">{campaign.type}</span>
                    </div>
                  </div>
                </button>
              );
            })
          );
          })()}
        </div>
      </div>

      {/* Campaign detail */}
      {selectedCampaignData ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {(() => {
                  const status = STATUS_CONFIG[selectedCampaignData.status as keyof typeof STATUS_CONFIG];
                  return <span className={cn("text-xs px-2 py-1 rounded font-medium", status?.color)}>{status?.label}</span>;
                })()}
                <Badge variant="outline" className="text-xs capitalize">{selectedCampaignData.type}</Badge>

              </div>
              <h2 className="text-xl font-bold text-foreground">{selectedCampaignData.name}</h2>
            </div>
            {selectedCampaignData.status === "draft" && (
              <Button
                className="gap-2"
                onClick={() => sendCampaign.mutate({ id: selectedCampaignData.id, status: 'running' })}
                disabled={sendCampaign.isPending}
              >
                <Send className="w-4 h-4" />
                {sendCampaign.isPending ? "Sending..." : "Send Now"}
              </Button>
            )}
          </div>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Message</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap">{selectedCampaignData.message}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{selectedCampaignData.sentCount ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Sent</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{selectedCampaignData.sentCount ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Delivered</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{selectedCampaignData.openCount ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Opened</p>
              </CardContent>
            </Card>
          </div>

          {selectedCampaignData.scheduledAt && (
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <Calendar className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled for</p>
                  <p className="text-sm font-medium text-foreground">{new Date(selectedCampaignData.scheduledAt).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">Select a campaign</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Choose a campaign from the list to view details and manage delivery</p>
        </div>
      )}
    </div>
  );
}
