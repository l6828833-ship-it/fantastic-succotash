import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Loader2, CheckCircle2, UserPlus } from "lucide-react";

export default function AcceptInvite() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [done, setDone] = useState(false);

  const { data: invite, isLoading } = trpc.invite.get.useQuery({ token }, { enabled: !!token, retry: false });
  const accept = trpc.invite.accept.useMutation({ onSuccess: () => setDone(true) });

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            {done ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <Bot className="w-6 h-6 text-primary" />}
          </div>
          <h1 className="text-xl font-bold text-foreground">Team invitation</h1>
        </div>

        <Card className="border-border">
          <CardContent className="p-5 space-y-4 text-center">
            {!token ? (
              <p className="text-sm text-muted-foreground">This invitation link is missing its token.</p>
            ) : isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : done ? (
              <>
                <p className="text-sm text-foreground">You're in! 🎉</p>
                <p className="text-xs text-muted-foreground">You've joined {invite?.workspaceName ?? "the workspace"} as a support agent.</p>
                <Button className="w-full" onClick={() => { window.location.href = "/login"; }}>Go to sign in</Button>
              </>
            ) : !invite ? (
              <p className="text-sm text-muted-foreground">This invitation is invalid or has already been used.</p>
            ) : invite.status === "active" ? (
              <p className="text-sm text-muted-foreground">This invitation has already been accepted.</p>
            ) : (
              <>
                <p className="text-sm text-foreground">
                  You've been invited to join <span className="font-semibold">{invite.workspaceName}</span> as a <span className="font-semibold">support agent</span>.
                </p>
                <p className="text-xs text-muted-foreground">Invited as {invite.email}</p>
                <Button className="w-full gap-2" onClick={() => accept.mutate({ token })} disabled={accept.isPending}>
                  {accept.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Approve & join as agent
                </Button>
                {accept.error && <p className="text-xs text-destructive">{accept.error.message}</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
