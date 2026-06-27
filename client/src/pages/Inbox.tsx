import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare, Send, Bot, User, Clock, CheckCircle2, AlertCircle, Sparkles, Paperclip, MoreHorizontal, UserPlus, Tag, X, FileText, Image, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickReplies } from "@/components/QuickReplies";
import { toast } from "sonner";

const STATUS_CONFIG = {
  open: { label: "Open", icon: AlertCircle, color: "text-blue-600 bg-blue-500/10" },
  pending: { label: "Pending", icon: Clock, color: "text-orange-600 bg-orange-500/10" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "text-green-600 bg-green-500/10" },
};

export default function Inbox() {
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string; type: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getUploadUrl = trpc.upload.getUploadUrl.useMutation();

  // Poll every 5 seconds for new conversations and messages
  const { data: conversations, refetch: refetchConvs } = trpc.inbox.listConversations.useQuery(
    { status: statusFilter },
    { refetchInterval: 5000 }
  );
  const { data: agents } = trpc.agent.list.useQuery();
  const selectedConv = conversations?.find((c) => c.id === selectedConvId) ?? null;
  const { data: messages, refetch: refetchMessages } = trpc.inbox.getMessages.useQuery(
    { conversationId: selectedConvId! },
    { enabled: !!selectedConvId, refetchInterval: 5000 }
  );

  const sendMessage = trpc.inbox.sendMessage.useMutation({
    onSuccess: () => { refetchMessages(); setMessageInput(""); setAiSuggestion(""); },
    onError: () => toast.error("Failed to send message"),
  });
  const updateConv = trpc.inbox.updateConversation.useMutation({
    onSuccess: () => { refetchConvs(); toast.success("Conversation updated"); },
  });
  const suggestReply = trpc.inbox.suggestReply.useMutation({
    onSuccess: (data) => { setAiSuggestion(typeof data.suggestion === 'string' ? data.suggestion : ''); toast.success("AI suggestion ready"); },
    onError: () => toast.error("Failed to get AI suggestion"),
  });
  const createTicket = trpc.tickets.create.useMutation({
    onSuccess: () => toast.success("Ticket created from conversation"),
    onError: () => toast.error("Failed to create ticket"),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large. Max 10MB."); return; }
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) { toast.error("Unsupported file type."); return; }
    setIsUploading(true);
    try {
      const { key, uploadEndpoint } = await getUploadUrl.mutateAsync({ filename: file.name, contentType: file.type, folder: "inbox" });
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const fileUrl = `/manus-storage/${key}`;
      setAttachments((prev) => [...prev, { name: file.name, url: fileUrl, type: file.type }]);
      toast.success(`${file.name} attached`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    if (!messageInput.trim() && attachments.length === 0) return;
    if (!selectedConvId) return;
    const content = attachments.length > 0
      ? `${messageInput}${messageInput ? "\n" : ""}${attachments.map((a) => `[Attachment: ${a.name}](${a.url})`).join("\n")}`
      : messageInput;
    sendMessage.mutate({
      conversationId: selectedConvId,
      content,
      role: isNote ? "note" : "agent",
      isInternal: isNote,
    });
    setAttachments([]);
  };

  const handleStatusChange = (status: string) => {
    if (!selectedConvId) return;
    updateConv.mutate({ id: selectedConvId, status: status as "open" | "pending" | "resolved" });
  };

  const handleEscalate = () => {
    if (!selectedConvId) return;
    updateConv.mutate({ id: selectedConvId, isEscalated: true, handoffMode: "human" });
    toast.success("Conversation escalated to human agent");
  };

  const handleCreateTicket = () => {
    if (!selectedConv) return;
    createTicket.mutate({
      title: `Support request from ${selectedConv.visitorName ?? "visitor"}`,
      description: `Conversation #${selectedConv.id}`,
      conversationId: selectedConv.id,
      priority: "medium",
    });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversation list */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col bg-background">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground mb-3">Inbox</h2>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="grid grid-cols-3 w-full h-8">
              <TabsTrigger value="open" className="text-xs">Open</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs">Resolved</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!conversations || conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No {statusFilter} conversations</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const status = STATUS_CONFIG[conv.status as keyof typeof STATUS_CONFIG];
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-4 border-b border-border text-left hover:bg-accent/30 transition-colors",
                    selectedConvId === conv.id && "bg-accent/50 border-l-2 border-l-primary"
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{conv.visitorName ?? "Visitor"}</p>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {new Date(conv.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium", status?.color)}>
                        {status?.label}
                      </span>
                      {conv.isEscalated && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">Escalated</Badge>
                      )}
                      {conv.channel && (
                        <span className="text-xs text-muted-foreground capitalize">{conv.channel}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat view */}
      {selectedConvId && selectedConv ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-background shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{selectedConv.visitorName ?? "Visitor"}</p>
                <p className="text-xs text-muted-foreground">{selectedConv.visitorEmail ?? `Conversation #${selectedConv.id}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select         value={selectedConv.status ?? undefined} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEscalate}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Escalate to Human
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCreateTicket}>
                    <Tag className="w-4 h-4 mr-2" />
                    Create Ticket
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/10">
            {!messages || messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No messages yet</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-start" : msg.role === "note" ? "justify-center" : "justify-end"
                )}>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-secondary-foreground" />
                    </div>
                  )}
                  {msg.role === "note" ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-2 text-xs text-yellow-800 dark:text-yellow-200 max-w-lg">
                      <span className="font-semibold">Internal Note: </span>{msg.content}
                    </div>
                  ) : (
                    <div className={cn(
                      "max-w-lg rounded-2xl px-4 py-3 text-sm",
                      msg.role === "user" ? "bg-background border border-border text-foreground rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm"
                    )}>
                      {msg.content}
                      {msg.attachmentUrl && (
                        <div className="mt-2 pt-2 border-t border-white/20">
                          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-80">
                            📎 {msg.attachmentName ?? "Attachment"}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  {(msg.role === "agent" || msg.role === "system") && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* AI Suggestion */}
          {aiSuggestion && (
            <div className="px-4 py-3 bg-primary/5 border-t border-primary/20 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-primary mb-1">AI Suggested Reply</p>
                <p className="text-sm text-foreground">{aiSuggestion}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" className="h-7 text-xs" onClick={() => { setMessageInput(aiSuggestion); setAiSuggestion(""); }}>
                  Use
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAiSuggestion("")}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-border bg-background shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setIsNote(false)}
                className={cn("text-xs px-3 py-1 rounded-full transition-colors", !isNote ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Reply
              </button>
              <button
                onClick={() => setIsNote(true)}
                className={cn("text-xs px-3 py-1 rounded-full transition-colors", isNote ? "bg-yellow-500 text-white" : "text-muted-foreground hover:text-foreground")}
              >
                Internal Note
              </button>
            </div>
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 text-xs border border-border">
                    {att.type.startsWith("image/") ? <Image className="w-3 h-3 text-blue-500" /> : <FileText className="w-3 h-3 text-orange-500" />}
                    <span className="max-w-[120px] truncate text-foreground">{att.name}</span>
                    <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={isNote ? "Add an internal note (not visible to customer)..." : "Type a reply..."}
                rows={2}
                className={cn("flex-1 resize-none text-sm", isNote && "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800")}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <div className="flex flex-col gap-2">
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" onChange={handleFileSelect} />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Attach file"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4 text-muted-foreground" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => suggestReply.mutate({ conversationId: selectedConvId, agentId: selectedConv.agentId ?? undefined })}
                  disabled={suggestReply.isPending}
                  title="Get AI suggestion"
                >
                  <Sparkles className={cn("w-4 h-4", suggestReply.isPending ? "animate-pulse text-primary" : "text-muted-foreground")} />
                </Button>
                <QuickReplies
                  visitorName={selectedConv.visitorName}
                  draft={messageInput}
                  onSelect={(content) =>
                    setMessageInput((prev) =>
                      prev.trim() ? `${prev.replace(/\s+$/, "")} ${content}` : content
                    )
                  }
                />
                <Button
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleSend}
                  disabled={(!messageInput.trim() && attachments.length === 0) || sendMessage.isPending}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">Select a conversation</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Choose a conversation from the list to view messages and reply</p>
        </div>
      )}
    </div>
  );
}
