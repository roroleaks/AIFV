import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain, HelpCircle, ChevronRight, ChevronLeft, Info } from "lucide-react";
import type { CaseSummary } from "@/features/case/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DecisionSidebarProps {
  caseSummary: CaseSummary;
}

export function DecisionSidebar({ caseSummary }: DecisionSidebarProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const { derived, firewallBreached } = caseSummary;

  if (collapsed) {
    return (
      <aside className="flex flex-col items-center border-s border-border/80 bg-sidebar/30 py-4 px-1.5 transition-all">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="size-8 text-muted-foreground hover:text-foreground"
          title={t("decisionSidebar.title")}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        <div className="mt-4 flex flex-col items-center gap-3 text-muted-foreground">
          <Brain className="size-4 text-primary" />
          <span className="text-[10px] font-bold uppercase [writing-mode:vertical-lr] tracking-widest">
            {t("decisionSidebar.title")}
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-s border-border/80 bg-sidebar/40 p-4 transition-all overflow-y-auto scrollbar-thin">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {t("decisionSidebar.title")}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          className="size-7 text-muted-foreground hover:text-foreground"
          title="Collapse Sidebar"
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {/* Safety Firewalls Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("decisionSidebar.firewalls")}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "h-4.5 px-1.5 text-[10px]",
                firewallBreached
                  ? "border-destructive text-destructive bg-destructive/10"
                  : "border-emerald-500/40 text-emerald-600 bg-emerald-500/10",
              )}
            >
              {firewallBreached ? "Ceiling Breached" : t("decisionSidebar.statusActive")}
            </Badge>
          </div>

          <Card className="border-border/70 shadow-2xs">
            <CardContent className="p-3 space-y-2 text-xs">
              {/* ESHRE 300 IU Firewall */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">●</span>
                  <div>
                    <span className="font-semibold text-foreground block text-[11px]">
                      ESHRE Rec 20 Ceiling
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Max starting dose: 300 IU/day
                    </span>
                  </div>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-primary">
                      <HelpCircle className="size-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="left" className="w-64 text-xs p-3">
                    <p className="font-semibold text-foreground mb-1">
                      ESHRE 2025 Recommendation 20
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      A daily dose of &gt; 300 IU FSH is probably not recommended for poor
                      responders, as higher doses do not increase live birth rates.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Rec 31 Combination Caution */}
              <div className="flex items-start justify-between gap-2 pt-2 border-t border-border/40">
                <div className="flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">●</span>
                  <div>
                    <span className="font-semibold text-foreground block text-[11px]">
                      ESHRE Rec 31 Combination
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Concurrent rFSH + hMG caution
                    </span>
                  </div>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-primary">
                      <HelpCircle className="size-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="left" className="w-64 text-xs p-3">
                    <p className="font-semibold text-foreground mb-1">
                      ESHRE 2025 Recommendation 31
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      Combined use of r-hFSH with hMG is probably not recommended over either alone.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Recommendation Rationale */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            {t("encounter.engineRationale")}
          </span>
          <div className="rounded-lg border border-border/70 bg-card p-3 text-xs space-y-2">
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                {t("plan.protocolTitle")}
              </span>
              <p className="font-medium text-foreground text-[11px]">
                {derived.protocol.recommendation?.primary === "gnrh-antagonist"
                  ? "GnRH Antagonist Protocol recommended for optimal cycle flexibility and reduced OHSS risk."
                  : "GnRH Agonist protocol selected based on baseline clinical evaluation."}
              </p>
            </div>
            <div className="pt-2 border-t border-border/40">
              <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                {t("plan.doseTitle")}
              </span>
              <p className="font-medium text-foreground text-[11px]">
                {derived.startingDose.doseDisplay} derived via CONSORT model + ESHRE 2025 age/AMH
                nomogram.
              </p>
            </div>
          </div>
        </div>

        {/* Engine Transparency Notice */}
        <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
            <Info className="size-3.5 text-primary" />
            <span>Pure Headless Services</span>
          </div>
          <p>
            Engines execute deterministically in the background. Hospital ward staff interact with
            case encounters, while engines run silently to update decision cards.
          </p>
        </div>
      </div>
    </aside>
  );
}
