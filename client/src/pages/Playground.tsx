import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Bot, Send, RotateCcw, Settings2, AlertTriangle, ChevronRight, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface PlaygroundProps { agentId: number; }

interface Message { role: string; content: string; }

export default function Playground({ agentId }: PlaygroundProps) {
  const { data: agent } = trpc.agent.get.useQuery({ id: agentId });
  const { data: session, refetch: refetchSession } = trpc.playground.getSession.useQuery({ agentId });
  const sendMessage = trpc.playground.sendMessage.useMutation();
  const resetSession = trpc.playground.resetSession.useMutation({ onSuccess: () => { refetchSession(); toast.success("Conversation reset"); } });
  const updateSettings = trpc.playground.updateSettings.useMutation({ onSuccess: () => refetchSession() });

  const [input, setInput] = useState("");
  const model = "gpt-4o-mini";
  const [guidance, setGuidance] = useState<"conservative" | "balanced" | "creative">("balanced");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages: Message[] = (session?.messages as Message[]) ?? [];

  useEffect(() => {
    if (session?.answerGuidance) setGuidance(session.answerGuidance as "conservative" | "balanced" | "creative");
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sendMessage.isPending) return;
    const msg = input;
    setInput("");
    try {
      await sendMessage.mutateAsync({ agentId, message: msg, model, answerGuidance: guidance });
      refetchSession();
    } catch {
      toast.error("Failed to send message");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleGuidanceChange = (newGuidance: "conservative" | "balanced" | "creative") => {
    setGuidance(newGuidance);
    updateSettings.mutate({ agentId, model, answerGuidance: newGuidance });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Settings panel */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-muted/20">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/agents/${agentId}`}>
              <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full">
                <ArrowLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <h2 className="font-semibold text-sm text-foreground">Agent Playground</h2>
          </div>
          <p className="text-xs text-muted-foreground ml-9">Safe test environment — no real conversations affected</p>
        </div>

        {agent && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                <Badge variant="outline" className="text-xs mt-0.5 capitalize">
                  {agent.handoffMode?.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Playground Settings</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Answer Guidance</label>
                <div className="space-y-1.5">
                  {[
                    { id: "conservative", label: "Conservative", desc: "Only from sources" },
                    { id: "balanced", label: "Balanced", desc: "Mixed approach" },
                    { id: "creative", label: "Creative", desc: "Full knowledge" },
                  ].map((g) => (
                    <button
                      key={g.id}
                      onClick={() => handleGuidanceChange(g.id as "conservative" | "balanced" | "creative")}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all",
                        guidance === g.id ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground hover:bg-accent/30"
                      )}
                    >
                      <div className={cn("w-3 h-3 rounded-full border-2 shrink-0", guidance === g.id ? "border-primary bg-primary" : "border-muted-foreground")} />
                      <span className="font-medium">{g.label}</span>
                      <span className="text-muted-foreground ml-auto">{g.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => resetSession.mutate({ agentId })}
            disabled={resetSession.isPending}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Conversation
          </Button>
        </div>
      </div>

      {/* Right: Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat header */}
        <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-background shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-amber-600">{agent?.name ?? "Agent"} is in playground mode</span>
              {" — "}this is a safe test environment. No real conversations are affected.
            </span>
          </div>
          <Badge variant="outline" className="text-xs gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {model}
          </Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Start Testing Your Agent</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Send a message to see how your agent responds. This is a safe playground — no real customer data is involved.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {["How can you help me?", "What are your capabilities?", "I have a problem with my order"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role !== "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "max-w-lg rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-secondary-foreground">You</span>
                  </div>
                )}
              </div>
            ))
          )}
          {sendMessage.isPending && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-background shrink-0">
          <div className="flex gap-3 max-w-3xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a test message..."
              className="flex-1 h-11"
              disabled={sendMessage.isPending}
            />
            <Button onClick={handleSend} disabled={!input.trim() || sendMessage.isPending} className="h-11 px-4 gap-2">
              <Send className="w-4 h-4" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
