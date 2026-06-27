import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CHANNELS, getChannelIcon, getChannelLabel } from "@/lib/channels";
import { useMemo, useState } from "react";
import {
  Users, Search, Plus, X, Trash2, Mail, Phone, Building2, Tag,
  UserCheck, Activity, Ticket as TicketIcon, Loader2, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type ContactRow = {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  channel?: string | null;
  tags?: unknown;
  notes?: string | null;
  subscribed?: boolean | null;
  lastSeenAt?: Date | string | null;
  createdAt: Date | string;
};

function initials(name?: string | null, email?: string | null) {
  const base = (name ?? email ?? "?").trim();
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="w-4 h-4 text-muted-foreground/50" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // create form
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPhone, setNPhone] = useState("");
  const [nCompany, setNCompany] = useState("");
  const [nChannel, setNChannel] = useState("web");

  // detail edit
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [newTag, setNewTag] = useState("");

  const utils = trpc.useUtils();
  const { data: contacts = [], isLoading } = trpc.contacts.list.useQuery();
  const { data: stats } = trpc.contacts.stats.useQuery();

  const createContact = trpc.contacts.create.useMutation({
    onSuccess: () => {
      utils.contacts.list.invalidate();
      utils.contacts.stats.invalidate();
      setShowCreate(false);
      setNName(""); setNEmail(""); setNPhone(""); setNCompany(""); setNChannel("web");
      toast.success("Contact added");
    },
    onError: () => toast.error("Failed to add contact"),
  });
  const updateContact = trpc.contacts.update.useMutation({
    onSuccess: () => { utils.contacts.list.invalidate(); toast.success("Contact updated"); },
    onError: () => toast.error("Failed to update contact"),
  });
  const deleteContact = trpc.contacts.delete.useMutation({
    onSuccess: () => { utils.contacts.list.invalidate(); utils.contacts.stats.invalidate(); setSelectedId(null); toast.success("Contact deleted"); },
    onError: () => toast.error("Failed to delete contact"),
  });

  const rows = contacts as ContactRow[];
  const selected = rows.find((c) => c.id === selectedId) ?? null;

  const allTags = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((c) => (Array.isArray(c.tags) ? (c.tags as string[]) : []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [rows]);

  const filtered = rows.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || [c.name, c.email, c.phone, c.company].some((v) => (v ?? "").toLowerCase().includes(q));
    const matchChannel = channelFilter === "all" || c.channel === channelFilter;
    const tags = Array.isArray(c.tags) ? (c.tags as string[]) : [];
    const matchTag = tagFilter === "all" || tags.includes(tagFilter);
    return matchSearch && matchChannel && matchTag;
  });

  const openDetail = (c: ContactRow) => {
    setSelectedId(c.id);
    setEditTags(Array.isArray(c.tags) ? (c.tags as string[]) : []);
    setEditNotes(c.notes ?? "");
  };

  const handleCreate = () => {
    if (!nName.trim() && !nEmail.trim()) { toast.error("Add a name or email"); return; }
    createContact.mutate({
      name: nName || undefined,
      email: nEmail || undefined,
      phone: nPhone || undefined,
      company: nCompany || undefined,
      channel: nChannel,
    });
  };

  const saveDetail = () => {
    if (!selected) return;
    updateContact.mutate({ id: selected.id, tags: editTags, notes: editNotes });
  };

  const toggleSubscribed = (value: boolean) => {
    if (!selected) return;
    updateContact.mutate({ id: selected.id, subscribed: value });
  };

  const addTag = () => {
    const t = newTag.trim();
    if (t && !editTags.includes(t)) setEditTags([...editTags, t]);
    setNewTag("");
  };

  const fmtDate = (d?: Date | string | null) => (d ? new Date(d).toLocaleDateString() : "—");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header + stats */}
      <div className="p-4 border-b border-border space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Contacts</h1>
            <p className="text-xs text-muted-foreground">Everyone who has talked to your bots, opened tickets, or received campaigns</p>
          </div>
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" />Add Contact
          </Button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total contacts" value={stats?.total ?? 0} sub="all time" icon={Users} />
          <StatCard label="Subscribed" value={stats?.subscribed ?? 0} sub={stats?.total ? `${Math.round(((stats.subscribed ?? 0) / stats.total) * 100)}% opt-in` : "—"} icon={UserCheck} />
          <StatCard label="Active (30d)" value={stats?.active30d ?? 0} sub="had a conversation" icon={Activity} />
          <StatCard label="Open tickets" value={stats?.openTickets ?? 0} sub="across all contacts" icon={TicketIcon} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className={cn("flex flex-col bg-background transition-all", selected ? "flex-1 border-r border-border" : "flex-1")}>
          {/* Filters */}
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or phone..." className="pl-8 h-9 text-sm" />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-sm"><SelectValue placeholder="All channels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 text-sm"><SelectValue placeholder="All tags" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3"><Users className="w-6 h-6 text-muted-foreground" /></div>
                <p className="text-sm font-medium text-foreground">No contacts found</p>
                <p className="text-xs text-muted-foreground mt-1">{search || channelFilter !== "all" || tagFilter !== "all" ? "Try adjusting your filters" : "Add your first contact to get started"}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/40 backdrop-blur-sm">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="font-medium px-4 py-2.5">Contact</th>
                    <th className="font-medium px-3 py-2.5 hidden md:table-cell">Channel</th>
                    <th className="font-medium px-3 py-2.5 hidden lg:table-cell">Subscribed</th>
                    <th className="font-medium px-3 py-2.5 hidden lg:table-cell">Last seen</th>
                    <th className="font-medium px-3 py-2.5">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const tags = Array.isArray(c.tags) ? (c.tags as string[]) : [];
                    return (
                      <tr
                        key={c.id}
                        onClick={() => openDetail(c)}
                        className={cn(
                          "border-b border-border cursor-pointer hover:bg-accent/30 transition-colors",
                          selectedId === c.id && "bg-accent/50"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                              {initials(c.name, c.email)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{c.name ?? "Unnamed"}</p>
                              <p className="text-xs text-muted-foreground truncate">{c.email ?? c.phone ?? "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <Badge variant="outline" className="text-xs gap-1">{getChannelIcon(c.channel)} {getChannelLabel(c.channel)}</Badge>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          {c.subscribed ? (
                            <Badge className="text-xs bg-green-500/10 text-green-600 border-green-200">Subscribed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Unsubscribed</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell text-xs text-muted-foreground">{fmtDate(c.lastSeenAt ?? c.createdAt)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 2).map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                            {tags.length > 2 && <span className="text-xs text-muted-foreground">+{tags.length - 2}</span>}
                            {tags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </ScrollArea>
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            Showing {filtered.length} of {rows.length} contacts
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-96 shrink-0 flex flex-col bg-background overflow-y-auto">
            <div className="p-4 border-b border-border flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-semibold text-primary shrink-0">
                  {initials(selected.name, selected.email)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{selected.name ?? "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{selected.email ?? "—"}</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setSelectedId(null)}><X className="w-4 h-4" /></Button>
            </div>

            <div className="p-4 space-y-5">
              {/* Subscribed toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Subscribed</p>
                  <p className="text-xs text-muted-foreground">Receives campaigns</p>
                </div>
                <Switch checked={!!selected.subscribed} onCheckedChange={toggleSubscribed} />
              </div>

              {/* Details */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm text-foreground"><Mail className="w-4 h-4 text-muted-foreground shrink-0" /><span className="truncate">{selected.email ?? "No email"}</span></div>
                <div className="flex items-center gap-2 text-sm text-foreground"><Phone className="w-4 h-4 text-muted-foreground shrink-0" /><span className="truncate">{selected.phone ?? "No phone"}</span></div>
                <div className="flex items-center gap-2 text-sm text-foreground"><Building2 className="w-4 h-4 text-muted-foreground shrink-0" /><span className="truncate">{selected.company ?? "No company"}</span></div>
                <div className="flex items-center gap-2 text-sm text-foreground">{getChannelIcon(selected.channel)} <span>{getChannelLabel(selected.channel)}</span></div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3" />Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {editTags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 text-xs">
                      {t}
                      <button onClick={() => setEditTags(editTags.filter((x) => x !== t))} className="hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..." className="h-8 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                  <Button size="sm" variant="outline" className="h-8" onClick={addTag}>Add</Button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Internal notes about this contact..." rows={4} className="text-sm resize-none" />
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" className="flex-1 gap-1.5" onClick={saveDetail} disabled={updateContact.isPending}>
                  <Save className="w-3.5 h-3.5" />Save
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteContact.mutate({ id: selected.id })}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Name</Label><Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Jane Doe" /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={nEmail} onChange={(e) => setNEmail(e.target.value)} placeholder="jane@example.com" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Phone</Label><Input value={nPhone} onChange={(e) => setNPhone(e.target.value)} placeholder="+1..." /></div>
              <div className="space-y-2"><Label>Company</Label><Input value={nCompany} onChange={(e) => setNCompany(e.target.value)} placeholder="Acme" /></div>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={nChannel} onValueChange={setNChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={!c.available}>{c.icon} {c.label}{!c.available ? " (coming soon)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createContact.isPending}>{createContact.isPending ? "Adding..." : "Add Contact"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
