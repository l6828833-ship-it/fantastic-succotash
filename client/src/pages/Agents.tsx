import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Bot, Plus, Settings, Play, Trash2, Users, Zap, Shield } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";

const HANDOFF_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ai_only: { label: "AI Only", icon: Bot, color: "bg-blue-500/10 text-blue-600" },
  ai_first_human_escalation: { label: "AI First → Human", icon: Zap, color: "bg-orange-500/10 text-orange-600" },
  human_only: { label: "Human Only", icon: Users, color: "bg-green-500/10 text-green-600" },
};

export default function Agents() {
  const { data: agents, refetch } = trpc.agent.list.useQuery();
  const createAgent = trpc.agent.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Agent created!"); } });
  const deleteAgent = trpc.agent.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Agent deleted"); } });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [handoffMode, setHandoffMode] = useState<"ai_only" | "ai_first_human_escalation" | "human_only">("ai_only");
  const [tone, setTone] = useState<"formal" | "friendly" | "professional" | "casual" | "empathetic">("professional");

  const handleCreate = () => {
    if (!name.trim()) { toast.error("Agent name is required"); return; }
    createAgent.mutate({ name, handoffMode, tone });
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure and manage your AI agents</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />New Agent</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Agent Name</Label>
                <Input placeholder="e.g. Support Bot" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Handoff Mode</Label>
                <Select value={handoffMode} onValueChange={(v) => setHandoffMode(v as typeof handoffMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai_only">AI Only</SelectItem>
                    <SelectItem value="ai_first_human_escalation">AI First then Human Escalation</SelectItem>
                    <SelectItem value="human_only">Human Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="empathetic">Empathetic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createAgent.isPending}>
                {createAgent.isPending ? "Creating..." : "Create Agent"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!agents || agents.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No agents yet</h3>
          <p className="text-muted-foreground text-sm mb-6">Create your first AI agent to start automating customer conversations.</p>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Create Agent</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const handoff = HANDOFF_LABELS[agent.handoffMode ?? "ai_only"];
            const HandoffIcon = handoff?.icon ?? Bot;
            return (
              <Card key={agent.id} className="border-border hover:border-primary/40 transition-all group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{agent.name}</p>
                        <Badge variant={agent.isActive ? "default" : "secondary"} className="text-xs mt-0.5">
                          {agent.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-4", handoff?.color ?? "bg-muted text-muted-foreground")}>
                    <HandoffIcon className="w-3.5 h-3.5" />
                    {handoff?.label ?? agent.handoffMode}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3 h-3" />
                      <span className="capitalize">{agent.tone ?? "professional"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3" />
                      <span className="capitalize">{agent.responseStyle ?? "balanced"}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/agents/${agent.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Settings className="w-3.5 h-3.5" />
                        Configure
                      </Button>
                    </Link>
                    <Link href={`/playground/${agent.id}`}>
                      <Button size="sm" className="gap-1.5 text-xs">
                        <Play className="w-3.5 h-3.5" />
                        Test
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                      onClick={() => { if (confirm("Delete this agent?")) deleteAgent.mutate({ id: agent.id }); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
