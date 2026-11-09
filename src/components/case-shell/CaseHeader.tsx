import { useState } from "react";
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
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { CaseSummary, CaseLifecycleStatus, OHSSRiskCategory } from "@/features/case/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface CaseHeaderProps {
  caseSummary: CaseSummary;
  activeRole?: string;
  onNewVisit?: () => void;
  onPrint?: () => void;
  onSign?: () => void;
  onExport?: () => void;
  onOpenDecision?: (sectionId?: string) => void;
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
  activeRole = "Physician",
  onNewVisit,
  onPrint,
  onSign,
  onExport,
  onOpenDecision,
}: CaseHeaderProps) {
  const { t } = useTranslation();
  const [stratificationExpanded, setStratificationExpanded] = useState(false);

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

  const isPhysician = activeRole.toLowerCase() === "physician";

  const values = patient.values ?? {};
  const bmiVal = values["bmi"];
  const bmi = bmiVal ? Number(bmiVal).toFixed(1) : null;
  const parityVal = values["parity"];
  const gravidityVal = values["gravidity"];
  const parity = parityVal !== undefined ? `P${parityVal}` : "";
  const gravidity = gravidityVal !== undefined ? `G${gravidityVal}` : "";
  const parityStr = [gravidity, parity].filter(Boolean).join("") || "G0P0";

  // OHSS Risk Badge with WCAG Shape + Color + Text (§11 Safety Tokens)
  const getOhssBadge = (risk: OHSSRiskCategory) => {
    switch (risk) {
      case "critical":
        return {
          label: t("caseHeader.ohssCritical"),
          icon: "◆",
          className:
            "bg-safety-danger-bg text-safety-danger border-safety-danger animate-pulse font-bold",
        };
      case "high":
        return {
          label: "OHSS: High",
          icon: "■",
          className: "bg-safety-danger-bg text-safety-danger border-safety-danger/40 font-semibold",
        };
      case "moderate":
        return {
          label: "OHSS: Moderate",
          icon: "▲",
          className:
            "bg-safety-warning-bg text-safety-warning border-safety-warning/40 font-semibold",
        };
      case "low":
      default:
        return {
          label: t("caseHeader.ohssLow"),
          icon: "●",
          className:
            "bg-safety-success-bg text-safety-success border-safety-success/40 font-medium",
        };
    }
  };

  const ohssBadge = getOhssBadge(ohssRisk);

  // Concise one-line stratification summary for tertiary row
  const poseidonSummary =
    derived.poseidon.status === "insufficient-data"
      ? t("caseHeader.notClassified")
      : derived.poseidon.groupLabel
        ? `POSEIDON ${derived.poseidon.groupLabel}`
        : t("caseHeader.adequateReserve");

  const bolognaSummary =
    derived.bologna.status === "positive"
      ? t("caseHeader.bolognaFulfilled")
      : t("caseHeader.bolognaNotFulfilled");

  const protocolSummary =
    derived.protocol.recommendation?.primary === "gnrh-antagonist"
      ? "Antagonist"
      : derived.protocol.recommendation?.primary === "long-gnrh-agonist"
        ? "Long Agonist"
        : "Individualized";

  const stratSummaryText = `${poseidonSummary} · ${bolognaSummary} · ${protocolSummary}`;

  return (
    <div className="flex flex-col border-b border-border-subtle bg-bg-surface shadow-2xs">
      {/* Top Warning Banner if Safety Ceiling Breached - ARIA live assertive */}
      {firewallBreached && firewallMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-2 bg-safety-danger-bg px-6 py-2 text-xs font-semibold text-safety-danger border-b border-safety-danger/30"
        >
          <ShieldAlert className="size-4 shrink-0" />
          <span>{firewallMessage}</span>
          <button
            type="button"
            onClick={() => onOpenDecision?.("firewalls")}
            className="ms-auto text-[11px] font-normal underline cursor-pointer hover:text-text-primary"
          >
            {t("decisionSidebar.firewalls")}
          </button>
        </div>
      )}

      {/* Main Header Strip — Hierarchy Anchor: Primary Identity + Key Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5">
        {/* Tier 1 (Primary): Large, Bold Patient Identity */}
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary font-bold text-base ring-1 ring-accent-primary/20 shrink-0">
            {patient.name.charAt(0) || "P"}
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-text-primary tracking-tight">{patient.name}</h1>
              <Badge
                variant="outline"
                className="h-5 px-1.5 font-mono text-xs text-text-muted border-border-default"
              >
                MRN: {patient.fileNumber || "00482"}
              </Badge>
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[11px] bg-bg-surface-muted text-text-secondary border-border-subtle"
              >
                {patient.age} {t("leftRail.yearsOld")}
              </Badge>
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[11px] bg-bg-surface-muted text-text-secondary border-border-subtle"
              >
                {parityStr}
              </Badge>
              {bmi && (
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 text-[11px] bg-bg-surface-muted text-text-secondary border-border-subtle"
                >
                  {t("caseHeader.bmi")} {bmi}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted pt-0.5">
              <span>Cycle #{patient.cycles || 1}</span>
              <span>·</span>
              <span>{patient.infertilityType || t("caseHeader.recordSubtitle")}</span>
              {patient.causes?.[0] && (
                <>
                  <span>·</span>
                  <span className="font-medium text-text-secondary">{patient.causes[0]}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Toolbar — Reduced to 2 Primary Actions + Overflow (§2.3) */}
        <div className="flex items-center gap-2">
          {/* Primary Action 1: Add Encounter */}
          <Button
            size="sm"
            onClick={onNewVisit}
            className="h-8.5 gap-1.5 bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover font-semibold shadow-xs"
            title="Add monitoring encounter (Alt+V)"
          >
            <PlusCircle className="size-3.5" />
            <span>{t("encounter.newEncounterButton")}</span>
          </Button>

          {/* Primary Action 2 (Role-conditioned): Sign Report (Physician) or Print (Coordinator) */}
          {isPhysician ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onSign}
              className="h-8.5 gap-1.5 text-xs font-semibold border-border-default text-text-primary hover:bg-bg-surface-muted"
              title={t("report.signReport")}
            >
              <FileCheck2 className="size-3.5 text-text-muted" />
              <span>{t("report.signReport")}</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
              className="h-8.5 gap-1.5 text-xs border-border-default text-text-primary hover:bg-bg-surface-muted"
              title={t("report.exportPdf")}
            >
              <Printer className="size-3.5 text-text-muted" />
              <span>Print</span>
            </Button>
          )}

          {/* Overflow Action Menu (•••) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8.5 w-8.5 p-0 border-border-default text-text-muted hover:text-text-primary hover:bg-bg-surface-muted"
                aria-label={t("caseHeader.moreActions")}
                title={t("caseHeader.moreActions")}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 text-xs bg-bg-surface border-border-subtle shadow-md"
            >
              <DropdownMenuItem
                onClick={onPrint}
                className="gap-2 cursor-pointer text-text-primary hover:bg-bg-surface-muted"
              >
                <Printer className="size-3.5 text-text-muted" />
                <span>{t("report.exportPdf")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onExport}
                className="gap-2 cursor-pointer text-text-primary hover:bg-bg-surface-muted"
              >
                <Share2 className="size-3.5 text-text-muted" />
                <span>{t("report.exportEhr")}</span>
              </DropdownMenuItem>
              {isPhysician && (
                <DropdownMenuItem
                  onClick={onSign}
                  className="gap-2 cursor-pointer text-text-primary hover:bg-bg-surface-muted"
                >
                  <FileCheck2 className="size-3.5 text-text-muted" />
                  <span>{t("report.signReport")}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tier 2 (Secondary) & Tier 3 (Tertiary) Bar: Cycle State, Stratification, OHSS Safety */}
      <div
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-bg-surface-muted/50 px-6 py-2 text-xs"
      >
        {/* Secondary + Tertiary Group */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Secondary: Stimulation Day & Leading Cohort */}
          <Badge
            variant="outline"
            className="h-6.5 gap-1.5 bg-bg-surface font-medium px-2 shadow-2xs border-border-subtle text-text-secondary"
          >
            <Calendar className="size-3 text-text-muted" />
            <span className="font-semibold text-text-primary">
              {t("leftRail.day")} {currentStimDay || "0"}
            </span>
            {leadFollicleSize && (
              <>
                <span className="text-text-muted/60">·</span>
                <span>
                  {t("encounter.largestFollicle")}: {leadFollicleSize}mm
                </span>
              </>
            )}
            {folliclesGte14 > 0 && (
              <>
                <span className="text-text-muted/60">·</span>
                <span>{folliclesGte14} ≥14mm</span>
              </>
            )}
          </Badge>

          {/* Tertiary: Collapsible Stratification Engines Row */}
          {!stratificationExpanded ? (
            /* Collapsed Single Summary Strip */
            <button
              type="button"
              onClick={() => setStratificationExpanded(true)}
              className="flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1 text-[11px] text-text-muted hover:bg-bg-surface-muted hover:text-text-primary transition-colors cursor-pointer shadow-2xs"
              title={t("caseHeader.expandStratification")}
              aria-expanded={false}
            >
              <span className="font-semibold text-text-secondary">
                {t("caseHeader.stratificationSummary")}:
              </span>
              <span>{stratSummaryText}</span>
              <ChevronDown className="size-3 text-text-muted ms-0.5" />
            </button>
          ) : (
            /* Expanded Full Engine Chips - Mapped to Slate Accent Classification (§11) */
            <div className="flex flex-wrap items-center gap-2">
              {/* POSEIDON Chip */}
              {derived.poseidon.status === "insufficient-data" ? (
                <Badge
                  variant="secondary"
                  className="h-6 gap-1 bg-bg-surface text-text-muted font-medium border-border-subtle"
                >
                  <span className="size-1.5 rounded-full bg-text-muted/60" />
                  <span>{t("caseHeader.notClassified")}</span>
                </Badge>
              ) : derived.poseidon.groupLabel ? (
                <Badge
                  variant="outline"
                  onClick={() => onOpenDecision?.("rationale")}
                  className="h-6 gap-1 border-accent-classification/30 bg-accent-classification/10 font-semibold text-accent-classification cursor-pointer hover:bg-accent-classification/20"
                >
                  <span className="size-1.5 rounded-full bg-accent-classification" />
                  <span>POSEIDON {derived.poseidon.groupLabel}</span>
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-6 text-text-muted border-border-subtle bg-bg-surface"
                >
                  {t("caseHeader.adequateReserve")}
                </Badge>
              )}

              {/* Bologna Chip */}
              {derived.bologna.status === "positive" && (
                <Badge
                  variant="outline"
                  className="h-6 border-accent-classification/30 bg-accent-classification/10 text-accent-classification font-semibold"
                >
                  {t("caseHeader.bolognaFulfilled")}
                </Badge>
              )}

              {/* Protocol Chip */}
              <Badge
                variant="outline"
                className="h-6 gap-1 bg-bg-surface border-border-subtle font-medium text-text-secondary"
              >
                <span>{t("plan.protocolTitle")}:</span>
                <span className="font-semibold text-text-primary">{protocolSummary}</span>
              </Badge>

              {/* Estradiol & Trend */}
              {estradiol && (
                <Badge
                  variant="outline"
                  className="h-6 gap-1 bg-bg-surface border-border-subtle text-text-secondary"
                >
                  <span>
                    {t("encounter.estradiol")}: {estradiol} pg/mL
                  </span>
                  {estradiolTrend === "up" && <TrendingUp className="size-3 text-safety-success" />}
                  {estradiolTrend === "down" && (
                    <TrendingDown className="size-3 text-safety-warning" />
                  )}
                  {estradiolTrend === "flat" && <Minus className="size-3 text-text-muted" />}
                </Badge>
              )}

              {/* Collapse Button */}
              <button
                type="button"
                onClick={() => setStratificationExpanded(false)}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                title={t("caseHeader.collapseStratification")}
                aria-expanded={true}
              >
                <span>{t("caseHeader.collapseStratification")}</span>
                <ChevronUp className="size-3" />
              </button>
            </div>
          )}
        </div>

        {/* Far Right: State Machine + Dedicated OHSS Safety Badge */}
        <div className="flex items-center gap-3">
          {/* State Lifecycle Pipeline */}
          <div className="flex items-center gap-1 rounded-md bg-bg-surface p-0.5 border border-border-subtle">
            {LIFECYCLE_STAGES.map((s) => {
              const isActive = s === state;
              return (
                <span
                  key={s}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    isActive
                      ? "bg-accent-primary text-text-on-accent font-semibold shadow-2xs"
                      : "text-text-muted/70",
                  )}
                >
                  {s}
                </span>
              );
            })}
          </div>

          {/* Prominent OHSS Risk Badge (WCAG Shape + Color + Text) */}
          <Badge
            variant="outline"
            onClick={() => onOpenDecision?.("firewalls")}
            className={cn(
              "h-6.5 gap-1.5 px-2.5 cursor-pointer transition-all hover:ring-2 hover:ring-accent-primary/40 shadow-2xs",
              ohssBadge.className,
            )}
            title="Click to view OHSS safety recommendations"
          >
            <span>{ohssBadge.icon}</span>
            <span>{ohssBadge.label}</span>
          </Badge>
        </div>
      </div>
    </div>
  );
}
