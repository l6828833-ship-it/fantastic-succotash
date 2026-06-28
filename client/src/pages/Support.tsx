import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LifeBuoy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export default function Support() {
  const utils = trpc.useUtils();
  const { data: messages = [] } = trpc.support.listMine.useQuery();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const send = trpc.support.create.useMutation({
    onSuccess: () => { utils.support.listMine.invalidate(); setSubject(""); setMessage(""); toast.success("Message sent — our team will get back to you."); },
    onError: (e) => toast.error(e.message || "Could not send your message"),
  });

  const submit = () => {
    if (!subject.trim() || !message.trim()) { toast.error("Add a subject and message"); return; }
    send.mutate({ subject: subject.trim(), message: message.trim() });
  };

  type Msg = { id: number; subject: string; message: string; status?: string | null; adminReply?: string | null; createdAt: string | Date };
  const list = messages as Msg[];
  const fmt = (d: string | Date) => new Date(d).toLocaleString();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <LifeBuoy className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
          <p className="text-sm text-muted-foreground">Have a question or a technical issue? Message our team and we'll reply by email and here.</p>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Contact support</CardTitle>
          <CardDescription>Describe your question or problem in detail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Billing question, widget not showing…" />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Tell us what's going on…"
              className="w-full rounded-lg border border-input bg-background p-3 text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Button className="gap-2" onClick={submit} disabled={send.isPending}>
              {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send message
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Your messages</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't contacted support yet.</p>
        ) : (
          <div className="space-y-3">
            {list.map((m) => (
              <Card key={m.id} className="border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{m.subject}</p>
                    <Badge variant="outline" className={m.status === "closed" ? "bg-green-500/10 text-green-600 border-green-200 text-xs" : "bg-amber-500/10 text-amber-600 border-amber-200 text-xs"}>
                      {m.status === "closed" ? "Answered" : "Open"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.message}</p>
                  <p className="text-[11px] text-muted-foreground/60">{fmt(m.createdAt)}</p>
                  {m.adminReply && (
                    <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs font-semibold text-primary mb-1">Support reply</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{m.adminReply}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
