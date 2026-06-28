import { createContext, useContext, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, ArrowRight } from "lucide-react";

type UpgradePlan = {
  id: string;
  name: string;
  price: string;
  period: string;
  highlight?: boolean;
  features: string[];
};

// Compact plan summaries shown inside the upgrade popup (paid tiers only).
const UPGRADE_PLANS: UpgradePlan[] = [
  { id: "starter", name: "Starter", price: "$9.99", period: "/mo", features: ["2 AI agents", "1,000 AI conversations / mo", "Unlimited tickets", "Remove branding"] },
  { id: "pro", name: "Pro", price: "$49", period: "/mo", highlight: true, features: ["5 AI agents", "6,000 AI conversations / mo", "5,000 contacts", "Human handoff & live inbox", "Advanced analytics"] },
  { id: "business", name: "Business", price: "$129", period: "/mo", features: ["15 AI agents", "20,000 AI conversations / mo", "25,000 contacts", "Email branding", "25 team seats"] },
];

type UpgradeContextValue = {
  /** Open the upgrade popup, optionally with a reason (e.g. the limit message). */
  show: (reason?: string) => void;
};

const UpgradeContext = createContext<UpgradeContextValue>({ show: () => {} });

export function useUpgrade() {
  return useContext(UpgradeContext);
}

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);

  const show = (r?: string) => {
    setReason(r);
    setOpen(true);
  };

  // Send the user to the billing tab with the chosen plan pre-selected so the
  // payment dialog opens automatically.
  const goToUpgrade = (planId: string) => {
    setOpen(false);
    window.location.href = `/settings?upgrade=${planId}`;
  };

  return (
    <UpgradeContext.Provider value={{ show }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Upgrade to unlock more
            </DialogTitle>
            <DialogDescription>
              {reason || "You've reached a limit on your current plan. Upgrade to keep going — or dismiss this and continue."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            {UPGRADE_PLANS.map((p) => (
              <div
                key={p.id}
                className={"rounded-xl border p-4 flex flex-col " + (p.highlight ? "border-primary shadow-md" : "border-border")}
              >
                {p.highlight && <Badge className="self-start mb-1.5 bg-primary text-primary-foreground">Popular</Badge>}
                <p className="font-semibold">{p.name}</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-extrabold">{p.price}</span>
                  <span className="text-xs text-muted-foreground">{p.period}</span>
                </div>
                <ul className="mt-3 space-y-1.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs">
                      <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  className="w-full mt-3 gap-1"
                  variant={p.highlight ? "default" : "outline"}
                  onClick={() => goToUpgrade(p.id)}
                >
                  Upgrade <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Maybe later</Button>
          </div>
        </DialogContent>
      </Dialog>
    </UpgradeContext.Provider>
  );
}
