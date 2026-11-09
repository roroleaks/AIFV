import { useTranslation } from "react-i18next";
import {
  Calendar,
  PlusCircle,
  Printer,
  FileCheck2,
  Share2,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
} from "lucide-react";
import type { CaseSummary, CaseLifecycleStatus, OHSSRiskCategory } from "@/features/case/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CaseHeaderProps {
  caseSummary: CaseSummary;
  onNewVisit?: () => void;
  onPrint?: () => void;
  onSign?: () => void;
  onExport?: () => void;
}

const LIFECYCLE_STAGES: CaseLifecycleStatus[] = [
  "Intake",
  "Planning",
  "Monitoring",
  "Trigger",
  "Pickup",
  "Closure",
  "Signed",
];

export function CaseHeader({
  caseSummary,
  onNewVisit,
  onPrint,
  onSign,
  onExport,
}: CaseHeaderProps) {
  const { t } = useTranslation();
  const {
    patient,
    derived,
    currentStimDay,
    leadFollicleSize,
    folliclesGte14,
    estradiol,
    estradiolTrend,
    ohssRisk,
    state,
    firewallBreached,
    firewallMessage,
  } = caseSummary;

  const values = patient.values ?? {};
  const bmiVal = values["bmi"];
  const bmi = bmiVal ? Number(bmiVal).toFixed(1) : null;
  const parityVal = values["parity"];
  const gravidityVal = values["gravidity"];
  const parity = parityVal !== undefined ? `P${parityVal}` : "";
  const gravidity = gravidityVal !== undefined ? `G${gravidityVal}` : "";
  const parityStr = [gravidity, parity].filter(Boolean).join("") || "G0P0";

  // OHSS Risk Badge with WCAG Shape + Color + Text
  const getOhssBadge = (risk: OHSSRiskCategory) => {
    switch (risk) {
      case "critical":
        return {
          label: t("caseHeader.ohssCritical"),
          icon: "◆",
          className: "bg-red-950 text-red-200 border-red-700 animate-pulse font-bold",
        };
      case "high":
        return {
          label: "OHSS: High",
          icon: "■",
          className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40 font-semibold",
        };
      case "moderate":
        return {
          label: "OHSS: Moderate",
          icon: "▲",
          className:
            "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 font-semibold",
        };
      case "low":
      default:
        return {
          label: t("caseHeader.ohssLow"),
          icon: "●",
          className:
            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 font-medium",
        };
    }
  };

  const ohssBadge = getOhssBadge(ohssRisk);

  return (
    <div className="flex flex-col border-b border-border/80 bg-card/60 shadow-xs backdrop-blur-xs">
      {/* Top Warning Banner if Safety Ceiling Breached - ARIA live assertive (§2.4) */}
      {firewallBreached && firewallMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-2 bg-destructive/15 px-4 py-2 text-xs font-semibold text-destructive border-b border-destructive/30"
        >
          <ShieldAlert className="size-4 shrink-0" />
          <span>{firewallMessage}</span>
          <span className="ms-auto text-[11px] font-normal underline cursor-pointer">
            {t("decisionSidebar.firewalls")}
          </span>
        </div>
      )}

      {/* Main Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        {/* Patient Identity */}
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-base ring-1 ring-primary/20">
            {patient.name.charAt(0) || "P"}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-foreground tracking-tight">{patient.name}</h1>
              <Badge variant="outline" className="h-5 px-1.5 font-mono text-xs">
                MRN: {patient.fileNumber || "00482"}
              </Badge>
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                {patient.age} {t("leftRail.yearsOld")}
              </Badge>
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                {parityStr}
              </Badge>
              {bmi && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                  {t("caseHeader.bmi")} {bmi}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
              <span>Cycle #{patient.cycles || 1}</span>
              <span>·</span>
              <span>{patient.infertilityType || t("caseHeader.recordSubtitle")}</span>
              {patient.causes?.[0] && (
                <>
                  <span>·</span>
                  <span className="font-medium text-foreground/80">{patient.causes[0]}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions Toolbar */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onNewVisit}
            className="h-8 gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
            title="Add monitoring encounter (Alt+V)"
          >
            <PlusCircle className="size-3.5" />
            <span>{t("encounter.newEncounterButton")}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onPrint}
            className="h-8 gap-1.5 text-xs"
            title={t("report.exportPdf")}
          >
            <Printer className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Print</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onSign}
            className="h-8 gap-1.5 text-xs"
            title={t("report.signReport")}
          >
            <FileCheck2 className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">{t("report.signReport")}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-8 gap-1.5 text-xs"
            title={t("report.exportEhr")}
          >
            <Share2 className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">EHR</span>
          </Button>
        </div>
      </div>

      {/* Auto-derived Clinical Engine Chips & Lifecycle Strip - ARIA live polite (§2.4) */}
      <div
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-2 text-xs"
      >
        {/* Start: Reactive Engine Summary Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* POSEIDON Chip or Stratification Incomplete (§2.5) */}
          {derived.poseidon.status === "insufficient-data" ? (
            <Badge
              variant="secondary"
              className="h-6 gap-1 bg-muted/60 text-muted-foreground font-medium"
              title="Enter Age, AMH, and AFC to complete POSEIDON stratification"
            >
              <span className="size-1.5 rounded-full bg-muted-foreground/60" />
              <span>{t("caseHeader.notClassified")}</span>
            </Badge>
          ) : derived.poseidon.groupLabel ? (
            <Badge
              variant="outline"
              className="h-6 gap-1 border-primary/40 bg-primary/5 font-semibold text-primary"
              title="Auto-classified by POSEIDON Engine"
            >
              <span className="size-1.5 rounded-full bg-primary" />
              <span>POSEIDON {derived.poseidon.groupLabel}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="h-6 text-muted-foreground">
              {t("caseHeader.adequateReserve")}
            </Badge>
          )}

          {/* Bologna Chip if fulfilled */}
          {derived.bologna.status === "positive" && (
            <Badge
              variant="outline"
              className="h-6 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
            >
              {t("caseHeader.bolognaFulfilled")}
            </Badge>
          )}

          {/* Protocol Chip */}
          <Badge variant="outline" className="h-6 gap-1 bg-background font-medium">
            <span>{t("plan.protocolTitle")}:</span>
            <span className="font-semibold text-foreground">
              {derived.protocol.recommendation?.primary === "gnrh-antagonist"
                ? "Antagonist"
                : derived.protocol.recommendation?.primary === "long-gnrh-agonist"
                  ? "Long Agonist"
                  : "Individualized"}
            </span>
          </Badge>

          {/* Stim Day & Folliculometry */}
          <Badge variant="outline" className="h-6 gap-1 bg-background">
            <Calendar className="size-3 text-muted-foreground" />
            <span className="font-semibold text-foreground">
              {t("leftRail.day")} {currentStimDay || "0"}
            </span>
            {leadFollicleSize && (
              <>
                <span>·</span>
                <span>
                  {t("encounter.largestFollicle")}: {leadFollicleSize}mm
                </span>
              </>
            )}
            {folliclesGte14 > 0 && (
              <>
                <span>·</span>
                <span>{folliclesGte14} ≥14mm</span>
              </>
            )}
          </Badge>

          {/* Estradiol & Trend */}
          {estradiol && (
            <Badge variant="outline" className="h-6 gap-1 bg-background">
              <span>
                {t("encounter.estradiol")}: {estradiol} pg/mL
              </span>
              {estradiolTrend === "up" && <TrendingUp className="size-3 text-emerald-600" />}
              {estradiolTrend === "down" && <TrendingDown className="size-3 text-amber-600" />}
              {estradiolTrend === "flat" && <Minus className="size-3 text-muted-foreground" />}
            </Badge>
          )}

          {/* OHSS Risk Level (Shape + Color + Text) */}
          <Badge variant="outline" className={cn("h-6 gap-1", ohssBadge.className)}>
            <span>{ohssBadge.icon}</span>
            <span>{ohssBadge.label}</span>
          </Badge>
        </div>

        {/* End: State Lifecycle Pipeline */}
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-muted-foreground me-1 font-medium hidden md:inline">State:</span>
          <div className="flex items-center gap-1 rounded-lg bg-background/80 p-0.5 border border-border/60">
            {LIFECYCLE_STAGES.map((s) => {
              const isActive = s === state;
              return (
                <span
                  key={s}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground/70",
                  )}
                >
                  {s}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
