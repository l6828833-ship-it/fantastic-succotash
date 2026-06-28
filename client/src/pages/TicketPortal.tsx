import { useEffect, useRef, useState } from "react";
import { Loader2, Send, CheckCircle2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Msg = { role: string; content: string; createdAt: string | Date };
type TicketData = { id: number; subject: string; status: string; brandName: string; brandColor: string; messages: Msg[] };

export default function TicketPortal({ ticketId }: { ticketId: string }) {
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("t") ?? "" : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TicketData | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/ticket/portal/${ticketId}?t=${encodeURIComponent(token)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "This link is invalid or has expired."); return; }
      setData(d);
    } catch {
      setError("Could not load your ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ticketId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.messages.length]);

  const send = async () => {
    const message = reply.trim();
    if (!message) return;
    setSending(true);
    try {
      const res = await fetch(`/api/ticket/portal/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, message }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || "Could not send your reply."); return; }
      setReply("");
      toast.success("Your reply was sent.");
      await load();
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm text-center">
          <h1 className="text-lg font-semibold text-foreground">Link unavailable</h1>
          <p className="text-sm text-muted-foreground mt-2">{error ?? "This ticket could not be found."}</p>
        </div>
      </div>
    );
  }

  const color = /^#[0-9a-fA-F]{3,8}$/.test(data.brandColor) ? data.brandColor : "#6366f1";
  const closed = data.status === "closed";

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 flex items-center gap-3" style={{ background: color }}>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold leading-none">{data.brandName}</p>
            <p className="text-white/80 text-xs mt-1">Ticket #{data.id}</p>
          </div>
          <span className="ml-auto text-[11px] font-medium text-white/90 capitalize px-2 py-0.5 rounded-full bg-white/15">{data.status}</span>
        </div>

        <div className="px-6 py-4 border-b border-border">
          <p className="text-xs text-muted-foreground">Subject</p>
          <p className="font-semibold text-foreground">{data.subject}</p>
        </div>

        <div className="px-6 py-5 space-y-3 max-h-[50vh] overflow-y-auto">
          {data.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No messages yet.</p>
          ) : (
            data.messages.map((m, i) => (
              <div key={i} className={"flex " + (m.role === "you" ? "justify-end" : "justify-start")}>
                <div
                  className={
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap " +
                    (m.role === "you" ? "text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm")
                  }
                  style={m.role === "you" ? { background: color } : undefined}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your reply…"
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">{closed ? "Replying will reopen this ticket." : "Our team will be notified."}</p>
            <Button onClick={send} disabled={sending || !reply.trim()} className="gap-2" style={{ background: color }}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send reply
            </Button>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> Secure ticket conversation
      </p>
    </div>
  );
}
