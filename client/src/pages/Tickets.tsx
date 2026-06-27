import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import {
  Plus, Search, Filter, X, Send, Trash2, Tag, Clock,
  User, AlertCircle, CheckCircle2, Circle, Loader2, StickyNote,
  ArrowUpRight, MessageSquare, MoreHorizontal, Edit2, Check, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TicketStatus = "open" | "in-progress" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

const STATUS_CONFIG: Record<TicketStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  "open": { label: "Open", icon: Circle, color: "text-blue-600", bg: "bg-blue-500/10 border-blue-200" },
  "in-progress": { label: "In Progress", icon: Loader2, color: "text-amber-600", bg: "bg-amber-500/10 border-amber-200" },
  "closed": { label: "Closed", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-500/10 border-green-200" },
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; dot: string }> = {
  low: { label: "Low", color: "text-slate-500", dot: "bg-slate-400" },
  medium: { label: "Medium", color: "text-blue-600", dot: "bg-blue-500" },
  high: { label: "High", color: "text-orange-600", dot: "bg-orange-500" },
  urgent: { label: "Urgent", color: "text-red-600", dot: "bg-red-500" },
};

type TicketRow = {
  id: number;
  title: string;
  description?: string | null;
  status?: TicketStatus | null;
  priority?: TicketPriority | null;
  assignedUserId?: number | null;
  tags?: unknown;
  conversationId?: number | null;
  contactId?: number | null;
  workspaceId: number;
  createdAt: Date;
  updatedAt: Date;
};

export default function Tickets() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TicketPriority>("medium");
  const [newTag, setNewTag] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<{ id?: number; name?: string; email?: string } | null>(null);

  // Detail panel
  const [noteContent, setNoteContent] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  const utils = trpc.useUtils();

  const { data: tickets = [], isLoading } = trpc.tickets.list.useQuery(
    { status: statusFilter === "all" ? undefined : statusFilter },
    { refetchInterval: 15000 }
  );

  const { data: notes = [], refetch: refetchNotes } = trpc.tickets.getNotes.useQuery(
    { ticketId: selectedTicket?.id ?? 0 },
    { enabled: !!selectedTicket }
  );
  const { data: allContacts = [] } = trpc.contacts.list.useQuery();

  const createTicket = trpc.tickets.create.useMutation({
    onSuccess: () => {
      utils.tickets.list.invalidate();
      setShowCreateDialog(false);
      setNewTitle(""); setNewDesc(""); setNewPriority("medium"); setNewTags([]);
      setContactQuery(""); setSelectedContact(null);
      toast.success("Ticket created");
    },
    onError: () => toast.error("Failed to create ticket"),
  });

  const updateTicket = trpc.tickets.update.useMutation({
    onSuccess: (updated) => {
      utils.tickets.list.invalidate();
      if (updated && selectedTicket?.id === updated.id) {
        setSelectedTicket(updated as TicketRow);
      }
    },
    onError: () => toast.error("Failed to update ticket"),
  });

  const deleteTicketMutation = trpc.tickets.delete.useMutation({
    onSuccess: () => {
      utils.tickets.list.invalidate();
      setSelectedTicket(null);
      toast.success("Ticket deleted");
    },
    onError: () => toast.error("Failed to delete ticket"),
  });

  const addNote = trpc.tickets.addNote.useMutation({
    onSuccess: () => { refetchNotes(); setNoteContent(""); toast.success("Note added"); },
    onError: () => toast.error("Failed to add note"),
  });

  const deleteNote = trpc.tickets.deleteNote.useMutation({
    onSuccess: () => refetchNotes(),
    onError: () => toast.error("Failed to delete note"),
  });

  // ── Customer conversation (reply thread) ──
  const conversationId = selectedTicket?.conversationId ?? null;
  const { data: convMessages, refetch: refetchConvMessages } = trpc.inbox.getMessages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  );
  const sendReply = trpc.inbox.sendMessage.useMutation({
    onSuccess: () => { refetchConvMessages(); setReplyContent(""); },
    onError: () => toast.error("Failed to send reply"),
  });
  const startConversation = trpc.inbox.createConversation.useMutation({
    onSuccess: (conv) => {
      if (conv && selectedTicket) {
        updateTicket.mutate({ id: selectedTicket.id, conversationId: conv.id });
        setSelectedTicket({ ...selectedTicket, conversationId: conv.id });
        // Seed the thread with the original request so the customer has context.
        if (selectedTicket.description) {
          sendReply.mutate({ conversationId: conv.id, content: selectedTicket.description, role: "user" });
        } else {
          refetchConvMessages();
        }
        toast.success("Conversation started");
      }
    },
    onError: () => toast.error("Failed to start conversation"),
  });

  const handleSendReply = () => {
    if (!conversationId || !replyContent.trim()) return;
    sendReply.mutate({ conversationId, content: replyContent, role: "agent" });
  };

  const handleStartConversation = () => {
    if (!selectedTicket) return;
    startConversation.mutate({ visitorName: "Customer", channel: "web" });
  };

  const filtered = (tickets as TicketRow[]).filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  const statusCounts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    "in-progress": tickets.filter((t) => t.status === "in-progress").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  const addTag = () => {
    if (newTag.trim() && !newTags.includes(newTag.trim())) {
      setNewTags([...newTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return toast.error("Title is required");
    createTicket.mutate({
      title: newTitle,
      description: newDesc,
      priority: newPriority,
      tags: newTags,
      ...(selectedContact?.id
        ? { contactId: selectedContact.id }
        : selectedContact?.email
          ? { contactEmail: selectedContact.email, contactName: selectedContact.name }
          : {}),
    });
  };

  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  const contactMatches = (() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return [] as Array<{ id: number; name?: string | null; email?: string | null; phone?: string | null }>;
    return (allContacts as Array<{ id: number; name?: string | null; email?: string | null; phone?: string | null }>)
      .filter((c) => [c.name, c.email, c.phone].some((v) => (v ?? "").toLowerCase().includes(q)))
      .slice(0, 6);
  })();

  const handleStatusChange = (status: TicketStatus) => {
    if (!selectedTicket) return;
    updateTicket.mutate({ id: selectedTicket.id, status });
    setSelectedTicket({ ...selectedTicket, status });
    // Keep the customer informed by posting a status update into their thread.
    if (selectedTicket.conversationId) {
      const msg =
        status === "closed"
          ? "Your ticket has been resolved and closed. Thank you for reaching out!"
          : status === "in-progress"
            ? "An agent is now working on your ticket. We'll keep you posted."
            : "Your ticket has been reopened and is awaiting review.";
      sendReply.mutate({ conversationId: selectedTicket.conversationId, content: msg, role: "system" });
    }
  };

  const handlePriorityChange = (priority: TicketPriority) => {
    if (!selectedTicket) return;
    updateTicket.mutate({ id: selectedTicket.id, priority });
    setSelectedTicket({ ...selectedTicket, priority });
  };

  const handleSaveTitle = () => {
    if (!selectedTicket || !editTitle.trim()) return;
    updateTicket.mutate({ id: selectedTicket.id, title: editTitle });
    setSelectedTicket({ ...selectedTicket, title: editTitle });
    setEditingTitle(false);
  };

  const handleAddNote = () => {
    if (!selectedTicket || !noteContent.trim()) return;
    addNote.mutate({ ticketId: selectedTicket.id, content: noteContent, isInternal: true });
  };

  const ticketTags = (t: TicketRow) => Array.isArray(t.tags) ? (t.tags as string[]) : [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className={cn("flex flex-col border-r border-border bg-background transition-all", selectedTicket ? "w-[420px] shrink-0" : "flex-1")}>
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Tickets</h1>
              <p className="text-xs text-muted-foreground">{tickets.length} total</p>
            </div>
            <Button size="sm" className="gap-1.5 h-8" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-3.5 h-3.5" />New Ticket
            </Button>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1">
            {(["all", "open", "in-progress", "closed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s as TicketStatus].label}
                <span className={cn("px-1.5 py-0.5 rounded-full text-xs min-w-[18px] text-center", statusFilter === s ? "bg-white/20" : "bg-muted")}>
                  {statusCounts[s]}
                </span>
              </button>
            ))}
          </div>

          {/* Search + priority filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." className="pl-8 h-8 text-sm" />
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {(["urgent", "high", "medium", "low"] as TicketPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No tickets found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? "Try a different search term" : "Create your first ticket to get started"}
              </p>
              {!search && (
                <Button size="sm" className="mt-3 h-8 gap-1.5 text-xs" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-3 h-3" />Create Ticket
                </Button>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map((ticket) => {
                const status = (ticket.status ?? "open") as TicketStatus;
                const priority = (ticket.priority ?? "medium") as TicketPriority;
                const statusCfg = STATUS_CONFIG[status];
                const priorityCfg = PRIORITY_CONFIG[priority];
                const isSelected = selectedTicket?.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => { setSelectedTicket(ticket); setEditingTitle(false); }}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all",
                      isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-accent/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-medium text-foreground line-clamp-1 flex-1">{ticket.title}</p>
                      <span className="text-xs text-muted-foreground shrink-0">#{ticket.id}</span>
                    </div>
                    {ticket.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">{ticket.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn("text-xs h-5 gap-1 px-1.5", statusCfg.bg, statusCfg.color)}>
                        <statusCfg.icon className="w-2.5 h-2.5" />
                        {statusCfg.label}
                      </Badge>
                      <div className={cn("flex items-center gap-1 text-xs font-medium", priorityCfg.color)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", priorityCfg.dot)} />
                        {priorityCfg.label}
                      </div>
                      {ticketTags(ticket).slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs h-5 px-1.5">{tag}</Badge>
                      ))}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right panel: detail */}
      {selectedTicket ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Detail header */}
          <div className="p-4 border-b border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {editingTitle ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-8 text-sm font-semibold" onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }} autoFocus />
                  <Button size="sm" className="h-8 w-8 p-0" onClick={handleSaveTitle}><Check className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingTitle(false)}><X className="w-3.5 h-3.5" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="font-semibold text-foreground truncate">{selectedTicket.title}</h2>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => { setEditTitle(selectedTicket.title); setEditingTitle(true); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditTitle(selectedTicket.title); setEditingTitle(true); }}>
                    <Edit2 className="w-3.5 h-3.5 mr-2" />Edit Title
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => deleteTicketMutation.mutate({ id: selectedTicket.id })}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" />Delete Ticket
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSelectedTicket(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={selectedTicket.status ?? "open"} onValueChange={(v) => handleStatusChange(v as TicketStatus)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["open", "in-progress", "closed"] as TicketStatus[]).map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      return (
                        <SelectItem key={s} value={s}>
                          <div className="flex items-center gap-2">
                            <cfg.icon className={cn("w-3 h-3", cfg.color)} />
                            {cfg.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={selectedTicket.priority ?? "medium"} onValueChange={(v) => handlePriorityChange(v as TicketPriority)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["urgent", "high", "medium", "low"] as TicketPriority[]).map((p) => {
                      const cfg = PRIORITY_CONFIG[p];
                      return (
                        <SelectItem key={p} value={p}>
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                            {cfg.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assignee</Label>
                <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-background text-xs">
                  <User className="w-3 h-3 text-muted-foreground shrink-0" />
                  {selectedTicket.assignedUserId ? (
                    <span className="text-foreground truncate">Agent #{selectedTicket.assignedUserId}</span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                  <Button size="sm" variant="ghost" className="ml-auto h-5 px-1.5 text-xs shrink-0"
                    onClick={() => {
                      const newAssignee = selectedTicket.assignedUserId === user?.id ? null : (user?.id ?? null);
                      updateTicket.mutate({ id: selectedTicket.id, assignedUserId: newAssignee });
                      setSelectedTicket({ ...selectedTicket, assignedUserId: newAssignee });
                    }}
                  >
                    {selectedTicket.assignedUserId === user?.id ? "Unassign" : "Assign me"}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Created</Label>
                <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-muted/20 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="truncate">{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <div className="p-3 rounded-lg border border-border bg-muted/20 text-sm text-foreground min-h-[60px]">
                {selectedTicket.description ?? <span className="text-muted-foreground italic">No description provided</span>}
              </div>
            </div>

            {/* Tags */}
            {ticketTags(selectedTicket).length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ticketTags(selectedTicket).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs gap-1">
                      <Tag className="w-2.5 h-2.5" />{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Customer conversation */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Customer Conversation</h3>
                {selectedTicket.conversationId && (
                  <Badge variant="secondary" className="text-xs">#{selectedTicket.conversationId}</Badge>
                )}
              </div>
              {selectedTicket.conversationId ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="max-h-72 overflow-y-auto p-3 space-y-3 bg-muted/10">
                    {!convMessages || convMessages.filter((m) => m.role !== "note").length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No messages yet. Send the first reply to the customer below.</p>
                    ) : (
                      convMessages.filter((m) => m.role !== "note").map((m) => (
                        <div key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-start" : "justify-end")}>
                          {m.role === "user" && (
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                              <User className="w-3 h-3 text-secondary-foreground" />
                            </div>
                          )}
                          {m.role === "system" ? (
                            <div className="mx-auto bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs italic">{m.content}</div>
                          ) : (
                            <div className={cn(
                              "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                              m.role === "user" ? "bg-background border border-border text-foreground rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm"
                            )}>
                              {m.content}
                            </div>
                          )}
                          {m.role === "agent" && (
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Bot className="w-3 h-3 text-primary" />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2 p-2 border-t border-border bg-background">
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Reply to the customer..."
                      rows={2}
                      className="flex-1 resize-none text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                    />
                    <Button size="icon" className="h-9 w-9 self-end" onClick={handleSendReply} disabled={!replyContent.trim() || sendReply.isPending}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">No customer conversation is linked to this ticket yet.</p>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleStartConversation} disabled={startConversation.isPending}>
                    <MessageSquare className="w-3.5 h-3.5" /> Start conversation with customer
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Internal Notes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Internal Notes</h3>
                <Badge variant="secondary" className="text-xs">{notes.length}</Badge>
              </div>

              {notes.length === 0 ? (
                <div className="text-center py-5 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                  No notes yet. Add an internal note below.
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div key={note.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 group relative">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground flex-1">{note.content}</p>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => deleteNote.mutate({ id: note.id })}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">{new Date(note.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add an internal note (only visible to your team)..."
                  className="text-sm resize-none min-h-[80px]"
                  onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleAddNote(); }}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Ctrl+Enter to submit</p>
                  <Button size="sm" className="h-8 gap-1.5" onClick={handleAddNote} disabled={!noteContent.trim() || addNote.isPending}>
                    <Send className="w-3.5 h-3.5" />Add Note
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-muted/10">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Select a ticket</p>
            <p className="text-xs text-muted-foreground mt-1">Click on a ticket from the list to view its details</p>
          </div>
        </div>
      )}

      {/* Create Ticket Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Brief description of the issue" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Detailed description..." className="resize-none min-h-[80px]" />
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              {selectedContact ? (
                <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {(selectedContact.name ?? selectedContact.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{selectedContact.name ?? selectedContact.email}</p>
                    {selectedContact.email && selectedContact.name && <p className="text-xs text-muted-foreground truncate">{selectedContact.email}</p>}
                    {!selectedContact.id && <p className="text-xs text-primary">New contact</p>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { setSelectedContact(null); setContactQuery(""); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <Input value={contactQuery} onChange={(e) => setContactQuery(e.target.value)} placeholder="Search contacts or enter an email..." />
                  {contactQuery.trim() && (
                    <div className="border border-border rounded-md max-h-44 overflow-y-auto divide-y divide-border">
                      {contactMatches.map((c) => (
                        <button key={c.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent/40 flex items-center gap-2"
                          onClick={() => setSelectedContact({ id: c.id, name: c.name ?? undefined, email: c.email ?? undefined })}>
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                            {(c.name ?? c.email ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate">{c.name ?? "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.email ?? c.phone ?? ""}</p>
                          </div>
                        </button>
                      ))}
                      {contactMatches.length === 0 && isEmail(contactQuery) && (
                        <button type="button" className="w-full text-left px-3 py-2 hover:bg-accent/40 text-sm text-foreground"
                          onClick={() => setSelectedContact({ email: contactQuery.trim() })}>
                          Use new contact: <span className="font-medium">{contactQuery.trim()}</span>
                        </button>
                      )}
                      {contactMatches.length === 0 && !isEmail(contactQuery) && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No matches. Type a full email to create a new contact.</p>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Link a customer so you can reply to them. Leave empty for an internal-only ticket.</p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={newPriority} onValueChange={(v) => setNewPriority(v as TicketPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["urgent", "high", "medium", "low"] as TicketPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", PRIORITY_CONFIG[p].dot)} />
                        {PRIORITY_CONFIG[p].label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..." className="flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
              </div>
              {newTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {newTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                      {tag}
                      <button onClick={() => setNewTags(newTags.filter((t) => t !== tag))} className="hover:text-destructive">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createTicket.isPending || !newTitle.trim()}>
                {createTicket.isPending ? "Creating..." : "Create Ticket"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
