import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Brain, HelpCircle, ChevronRight, Info, AlertTriangle, ShieldCheck } from "lucide-react";
import type { CaseSummary } from "@/features/case/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DecisionSidebarProps {
  caseSummary: CaseSummary;
  open?: boolean;
  onClose?: () => void;
  onAcknowledgeAlert?: () => void;
  targetSection?: string | null;
}

export function DecisionSidebar({
  caseSummary,
  open = false,
  onClose,
  onAcknowledgeAlert,
  targetSection,
}: DecisionSidebarProps) {
  const { t } = useTranslation();
  const { derived, firewallBreached, firewallMessage, ohssRisk } = caseSummary;
  const firewallsRef = useRef<HTMLDivElement>(null);
  const rationaleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to target section on open
  useEffect(() => {
    if (!open) return;
    if (targetSection === "firewalls" && firewallsRef.current) {
      firewallsRef.current.scrollIntoView({ behavior: "smooth" });
    } else if (targetSection === "rationale" && rationaleRef.current) {
      rationaleRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, targetSection]);

  if (!open) {
    return null;
  }

  const isSevereOhss = ohssRisk === "critical" || ohssRisk === "high";

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t("decisionSidebar.title")}
    >
      {/* Subtle backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in Drawer from inline-end */}
      <div className="fixed inset-y-0 end-0 flex max-w-full">
        <aside
          id="decision-sidebar-panel"
          className="flex h-full w-screen max-w-md sm:w-[28rem] flex-col border-s border-border/80 bg-card p-6 shadow-2xl transition-all overflow-y-auto animate-in duration-250 focus:outline-hidden"
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("decisionSidebar.title")}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {t("decisionSidebar.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="hidden sm:inline-block rounded bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground font-mono">
                Esc
              </kbd>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="size-7 text-muted-foreground hover:text-foreground"
                title={t("decisionSidebar.close")}
                aria-label={t("decisionSidebar.close")}
              >
                <ChevronRight className="size-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-5">
            {/* Active Clinical Alert Banner if Safety Ceiling Breached or High OHSS */}
            {(firewallBreached || isSevereOhss) && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-destructive">
                      {firewallBreached
                        ? "Safety Ceiling Breached"
                        : `Elevated OHSS Alert: ${ohssRisk.toUpperCase()}`}
                    </h4>
                    <p className="text-[11px] text-destructive/90 mt-0.5 leading-snug">
                      {firewallMessage ||
                        "Patient parameters indicate heightened hyperstimulation risk. Follow ESHRE Rec 20/31 safety guidelines."}
                    </p>
                  </div>
                </div>
                {onAcknowledgeAlert && (
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAcknowledgeAlert}
                      className="h-6.5 text-[11px] font-semibold border-destructive/40 text-destructive hover:bg-destructive/15"
                    >
                      {t("decisionSidebar.dismissAlert")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Safety Firewalls Section */}
            <div ref={firewallsRef} id="firewalls" className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("decisionSidebar.firewalls")}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4.5 px-1.5 text-[10px]",
                    firewallBreached
                      ? "border-destructive text-destructive bg-destructive/10 font-bold"
                      : "border-emerald-500/40 text-emerald-600 bg-emerald-500/10 font-medium",
                  )}
                >
                  {firewallBreached ? "Ceiling Breached" : t("decisionSidebar.statusActive")}
                </Badge>
              </div>

              <Card className="border-border/70 shadow-2xs">
                <CardContent className="p-3.5 space-y-2.5 text-xs">
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
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-primary"
                          aria-label="ESHRE Rec 20 Details"
                        >
                          <HelpCircle className="size-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" className="w-64 text-xs p-3">
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
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-primary"
                          aria-label="ESHRE Rec 31 Details"
                        >
                          <HelpCircle className="size-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" className="w-64 text-xs p-3">
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
            <div ref={rationaleRef} id="rationale" className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                {t("encounter.engineRationale")}
              </span>
              <div className="rounded-lg border border-border/70 bg-card p-3.5 text-xs space-y-2.5">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                    {t("plan.protocolTitle")}
                  </span>
                  <p className="font-medium text-foreground text-[11px] mt-0.5">
                    {derived.protocol.recommendation?.primary === "gnrh-antagonist"
                      ? "GnRH Antagonist Protocol recommended for optimal cycle flexibility and reduced OHSS risk."
                      : "GnRH Agonist protocol selected based on baseline clinical evaluation."}
                  </p>
                </div>
                <div className="pt-2 border-t border-border/40">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                    {t("plan.doseTitle")}
                  </span>
                  <p className="font-medium text-foreground text-[11px] mt-0.5">
                    {derived.startingDose.doseDisplay} derived via CONSORT model + ESHRE 2025 age/AMH
                    nomogram.
                  </p>
                </div>
              </div>
            </div>

            {/* Engine Transparency Notice */}
            <div className="rounded-lg bg-muted/40 p-3.5 text-[11px] text-muted-foreground">
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
      </div>
    </div>
  );
}
