import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Zap, Search, Plus, Trash2, X, CornerDownLeft, Loader2, MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type CannedResponse = {
  id: number;
  title: string;
  content: string;
  category?: string | null;
  shortcut?: string | null;
  usageCount?: number;
};

interface QuickRepliesProps {
  /** Called with the resolved template text when a template is selected. */
  onSelect: (content: string) => void;
  /** Visitor / customer name used to substitute {{name}} placeholders. */
  visitorName?: string | null;
  /** Optional initial text used when saving the current draft as a template. */
  draft?: string;
  disabled?: boolean;
}

/** Replace simple {{placeholder}} tokens with live conversation values. */
function resolvePlaceholders(content: string, visitorName?: string | null): string {
  const name = (visitorName ?? "").trim() || "there";
  return content
    .replace(/\{\{\s*(name|customer_name|customer|visitor|first_name)\s*\}\}/gi, name);
}

export function QuickReplies({ onSelect, visitorName, draft, disabled }: QuickRepliesProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("General");

  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.cannedResponses.list.useQuery(undefined, {
    enabled: open,
  });

  const createTemplate = trpc.cannedResponses.create.useMutation({
    onSuccess: () => {
      utils.cannedResponses.list.invalidate();
      setCreating(false);
      setNewTitle("");
      setNewContent("");
      setNewCategory("General");
      toast.success("Quick reply saved");
    },
    onError: () => toast.error("Failed to save quick reply"),
  });

  const deleteTemplate = trpc.cannedResponses.delete.useMutation({
    onSuccess: () => utils.cannedResponses.list.invalidate(),
    onError: () => toast.error("Failed to delete quick reply"),
  });

  const useTemplate = trpc.cannedResponses.use.useMutation();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = templates as CannedResponse[];
    if (!q) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        (t.shortcut ?? "").toLowerCase().includes(q)
    );
  }, [templates, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CannedResponse[]>();
    for (const t of filtered) {
      const key = t.category?.trim() || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handlePick = (t: CannedResponse) => {
    onSelect(resolvePlaceholders(t.content, visitorName));
    useTemplate.mutate({ id: t.id });
    setOpen(false);
    setSearch("");
  };

  const handleCreate = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Title and message are required");
      return;
    }
    createTemplate.mutate({
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory.trim() || "General",
    });
  };

  const startCreating = () => {
    setNewContent(draft?.trim() ? draft.trim() : "");
    setCreating(true);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setCreating(false); setSearch(""); } }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          disabled={disabled}
          title="Quick replies"
        >
          <Zap className="w-4 h-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 p-0 overflow-hidden">
        {creating ? (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">New quick reply</p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCreating(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title (e.g. Greeting)"
                className="h-8 text-sm"
                autoFocus
              />
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category"
                className="h-8 text-sm"
              />
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Message text. Use {{name}} to insert the customer's name."
                rows={4}
                className="text-sm resize-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{"{{name}}"} = customer name</p>
              <Button size="sm" className="h-8 gap-1.5" onClick={handleCreate} disabled={createTemplate.isPending}>
                {createTemplate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-border">
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Quick replies</p>
                </div>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{filtered.length}</Badge>
              </div>
              <div className="px-3 pb-2.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search quick replies..."
                    className="pl-8 h-9 text-sm"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <ScrollArea className="max-h-72">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <MessageSquareText className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {search ? "No matching quick replies" : "No quick replies yet"}
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {grouped.map(([category, items]) => (
                    <div key={category} className="mb-1">
                      <p className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {category}
                      </p>
                      {items.map((t) => (
                        <div
                          key={t.id}
                          className="group flex items-start gap-2 mx-2 px-2.5 py-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => handlePick(t)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                              {t.shortcut && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 font-mono">{t.shortcut}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {resolvePlaceholders(t.content, visitorName)}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            <button
                              className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); deleteTemplate.mutate({ id: t.id }); }}
                              title="Delete quick reply"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="p-2 border-t border-border">
              <Button variant="ghost" size="sm" className="w-full h-8 justify-start gap-1.5 text-xs" onClick={startCreating}>
                <Plus className="w-3.5 h-3.5" />
                New quick reply
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
