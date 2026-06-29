import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Search, Bot, Users, FileText, HelpCircle, MessageSquare, Megaphone, Loader2, X } from "lucide-react";

type SearchResult = {
  type: "agent" | "contact" | "article" | "qa" | "conversation" | "campaign";
  id: number;
  title: string;
  subtitle: string;
};

const TYPE_META: Record<SearchResult["type"], { icon: React.ElementType; href: (id: number) => string; color: string }> = {
  agent: { icon: Bot, href: (id) => `/agents/${id}`, color: "text-blue-600 bg-blue-500/10" },
  contact: { icon: Users, href: () => `/contacts`, color: "text-emerald-600 bg-emerald-500/10" },
  article: { icon: FileText, href: () => `/agents`, color: "text-indigo-600 bg-indigo-500/10" },
  qa: { icon: HelpCircle, href: () => `/agents`, color: "text-purple-600 bg-purple-500/10" },
  conversation: { icon: MessageSquare, href: () => `/inbox`, color: "text-orange-600 bg-orange-500/10" },
  campaign: { icon: Megaphone, href: () => `/campaigns`, color: "text-pink-600 bg-pink-500/10" },
};

export default function LiveSearch() {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounce the query so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [], isFetching } = trpc.search.global.useQuery(
    { q: debounced },
    { enabled: debounced.length >= 2 },
  );

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);


  const go = (r: SearchResult) => {
    navigate(TYPE_META[r.type].href(r.id));
    setOpen(false);
    setQ("");
  };

  const showDropdown = open && debounced.length >= 2;

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search agents, contacts, knowledge, conversations…"
        className="w-full h-11 rounded-xl border border-border bg-background pl-10 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {q && (
        <button onClick={() => { setQ(""); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {isFetching && results.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">No results for “{debounced}”</div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {(results as SearchResult[]).map((r) => {
                const meta = TYPE_META[r.type];
                const Icon = meta.icon;
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => go(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors"
                  >
                    <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", meta.color)}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground truncate">{r.title}</span>
                      <span className="block text-xs text-muted-foreground truncate">{r.subtitle}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
