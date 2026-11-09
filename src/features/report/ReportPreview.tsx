/**
 * ReportPreview Component (§2.3, §2.4, §3)
 *
 * Live, reactive preview of the 16-section clinical dossier.
 *
 * SPEC:
 *  - Renders live from current case state with NO "generate" button
 *  - DRAFT watermark when status is Draft or AwaitingSign
 *  - SIGNED footer when Signed (plus co-sign if countersigned)
 *  - Inline effective overrides with OVERRIDDEN badge, original value struck through,
 *    effective value highlighted, mandatory justification reason, physician & timestamp
 *  - Role-gated Sign workflow (Coordinator: disabled with "Physician only" tooltip)
 *  - Addendum workflow (opens version n+1, supersedes original, original stays locked)
 *  - PDF, FHIR, EHR exporters and browser print dialog
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  FileCheck2,
  FilePlus2,
  Printer,
  Download,
  Share2,
  Code,
  User,
  FlaskConical,
  Dna,
  Route as RouteIcon,
  Syringe,
  Calculator,
  Activity,
  ShieldCheck,
  BookOpen,
  ClipboardList,
  History,
  Scale,
  ListChecks,
  type LucideIcon,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import type { Report, ReportSectionContent } from "./types";
import { exportPdf } from "./exporters/exportPdf";
import { exportFhir } from "./exporters/exportFhir";
import { exportEhr } from "./exporters/exportEhr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  user: User,
  flask: FlaskConical,
  dna: Dna,
  route: RouteIcon,
  syringe: Syringe,
  calculator: Calculator,
  activity: Activity,
  shield: ShieldCheck,
  book: BookOpen,
  clipboard: ClipboardList,
  history: History,
  scale: Scale,
  listChecks: ListChecks,
};

interface ReportPreviewProps {
  report: Report;
  sections: ReportSectionContent[];
  activeRole?: string;
  onSign: (physicianName: string) => void;
  onSubmitForSign?: () => void;
  onCosign?: (seniorPhysicianName: string) => void;
  onOpenAddendum?: (reason: string) => void;
  onPrint?: () => void;
}

export function ReportPreview({
  report,
  sections,
  activeRole = "Physician",
  onSign,
  onSubmitForSign,
  onCosign,
  onOpenAddendum,
  onPrint,
}: ReportPreviewProps) {
  const { t } = useTranslation();
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [showAddendumDialog, setShowAddendumDialog] = useState(false);
  const [showCosignDialog, setShowCosignDialog] = useState(false);
  const [addendumReason, setAddendumReason] = useState("");
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isPhysician = activeRole.toLowerCase().includes("physician");
  const isSeniorPhysician = activeRole.toLowerCase().includes("senior");
  const isSigned = report.status === "Signed";
  const isDraft = report.status === "Draft" || report.status === "AwaitingSign";

  const handlePrint = () => {
    if (onPrint) onPrint();
    else window.print();
  };

  const handleExportPdf = () => {
    const filename = exportPdf(report);
    setExportNotice(`Exported PDF: ${filename}`);
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleExportFhir = () => {
    const fhirBundle = exportFhir(report);
    const jsonStr = JSON.stringify(fhirBundle, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fhir-bundle-${report.caseId}-v${report.version}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportNotice("Exported FHIR R4 Document Bundle JSON");
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleExportEhr = () => {
    const payload = exportEhr(report);
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ehr-payload-${report.caseId}-v${report.version}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportNotice("Exported EHR Adapter HL7/JSON Payload");
    setTimeout(() => setExportNotice(null), 3500);
  };

  const confirmSign = () => {
    const name = activeRole === "Senior Physician" ? "Dr. Senior Physician" : "Dr. Raouf Roshdy";
    onSign(name);
    setShowSignDialog(false);
  };

  const confirmCosign = () => {
    if (onCosign) {
      onCosign("Dr. Senior Attending");
    }
    setShowCosignDialog(false);
  };

  const confirmAddendum = () => {
    if (onOpenAddendum && addendumReason.trim().length >= 5) {
      onOpenAddendum(addendumReason.trim());
      setAddendumReason("");
      setShowAddendumDialog(false);
    }
  };

  return (
    <div className="relative space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border/70 bg-card shadow-xs print:hidden">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
              isSigned
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : report.status === "AwaitingSign"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
            )}
          >
            {report.status} · v{report.version}
          </Badge>
          {report.locked && (
            <Badge variant="secondary" className="text-[11px] gap-1 font-mono">
              <CheckCircle2 className="size-3 text-emerald-600" />
              Locked & Snapshot Frozen
            </Badge>
          )}
          {exportNotice && (
            <span className="text-xs font-medium text-primary animate-in fade-in">
              {exportNotice}
            </span>
          )}
        </div>

        {/* Workflow Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Clinical Actions Group */}
          <div className="flex items-center gap-2">
            {/* Coordinator Action: Mark Ready for Sign */}
            {!isSigned && report.status === "Draft" && onSubmitForSign && (
              <Button
                size="sm"
                variant="outline"
                onClick={onSubmitForSign}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                Submit for Sign
              </Button>
            )}

            {/* Physician Action: Sign Dossier */}
            {!isSigned && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="sm"
                        disabled={!isPhysician}
                        onClick={() => setShowSignDialog(true)}
                        className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                      >
                        <FileCheck2 className="size-3.5" />
                        Sign Report
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isPhysician && (
                    <TooltipContent>
                      <p className="text-xs">Physician only</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Senior Physician Action: Co-sign */}
            {isSigned && !report.cosignedBy && isSeniorPhysician && (
              <Button
                size="sm"
                onClick={() => setShowCosignDialog(true)}
                className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
              >
                <FileCheck2 className="size-3.5" />
                Co-sign Report
              </Button>
            )}

            {/* Addendum Action: Open Addendum */}
            {isSigned && onOpenAddendum && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddendumDialog(true)}
                className="h-8 gap-1.5 text-xs text-foreground font-medium"
              >
                <FilePlus2 className="size-3.5" />
                Open Addendum
              </Button>
            )}
          </div>

          <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block" />

          {/* Secondary Exporters & Print Group */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPdf}
              className="h-8 gap-1.5 text-xs"
              title="Download publication-grade A4 PDF"
            >
              <Download className="size-3.5 text-muted-foreground" />
              PDF
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportFhir}
              className="h-8 gap-1.5 text-xs"
              title="Download FHIR R4 Bundle JSON"
            >
              <Code className="size-3.5 text-muted-foreground" />
              FHIR
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportEhr}
              className="h-8 gap-1.5 text-xs"
              title="Download EHR Adapter Payload"
            >
              <Share2 className="size-3.5 text-muted-foreground" />
              EHR
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs"
              title="Print dossier summary"
            >
              <Printer className="size-3.5 text-muted-foreground" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Main Dossier Paper Layout */}
      <div className="relative rounded-2xl border border-border/80 bg-card p-8 md:p-12 shadow-md overflow-hidden print:p-0 print:border-none print:shadow-none">
        {/* Semi-transparent DRAFT Watermark Overlay */}
        {isDraft && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden select-none">
            <span className="text-[120px] font-black tracking-widest text-foreground/[0.035] dark:text-foreground/[0.045] rotate-[-30deg] uppercase">
              DRAFT
            </span>
          </div>
        )}

        {/* Dossier Header */}
        <header className="border-b border-border/80 pb-6 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold tracking-widest uppercase text-primary">
                AIFV Clinical Decision Support System
              </span>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight mt-1">
                Clinical Intelligence Dossier
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evidence-based multi-engine synthesis: POSEIDON, Bologna, Protocol, Starting Dose &
                Safety Firewalls
              </p>
            </div>

            <div className="text-end text-xs text-muted-foreground space-y-0.5">
              <div>
                <span className="font-semibold text-foreground">MRN:</span>{" "}
                <span className="font-mono">
                  {report.snapshot?.caseMetadata?.patient?.fileNumber || "00482"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Cycle:</span> #
                {report.snapshot?.caseMetadata?.patient?.cycles || 1}
              </div>
              <div>
                <span className="font-semibold text-foreground">Dossier Version:</span> v
                {report.version}
              </div>
              <div>
                <span className="font-semibold text-foreground">Status:</span>{" "}
                <span
                  className={cn("font-semibold", isSigned ? "text-emerald-600" : "text-amber-600")}
                >
                  {report.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* 16 Clinical Dossier Sections */}
        <div className="space-y-6">
          {sections.map((sec) => {
            const Icon = ICONS[sec.icon ?? ""] ?? FileText;
            const hasOverrides = sec.overrides && sec.overrides.length > 0;
            const isCollapsible =
              sec.tables.length > 0 ||
              sec.lists.some((l) => l.items.length > 3) ||
              sec.fields.length > 6;
            const isExpanded = isCollapsible ? !!expandedSections[sec.id] : true;

            return (
              <section
                key={sec.id}
                id={sec.id}
                className="rounded-xl border border-border/60 bg-muted/10 p-5 sm:p-6 break-inside-avoid shadow-2xs"
              >
                {/* Section Header */}
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        Section {String(sec.number).padStart(2, "0")}
                      </span>
                      <h2 className="text-base font-bold text-foreground">{sec.title}</h2>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] capitalize font-medium">
                    {sec.status}
                  </Badge>
                </div>

                {/* Section Summary */}
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{sec.summary}</p>

                {/* Inline Presentation-Layer Effective Overrides (§2.3, §3) */}
                {hasOverrides && (
                  <div className="mt-3 space-y-2">
                    {sec.overrides?.map((ov, ovIdx) => (
                      <div
                        key={ovIdx}
                        className="rounded-e-lg border-s-4 border-amber-500 border-y border-e border-border/50 bg-amber-500/5 dark:bg-amber-950/20 p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold tracking-wider uppercase"
                          >
                            OVERRIDDEN
                          </Badge>
                          <span className="font-bold text-foreground">
                            {ov.label}:
                          </span>
                          <span className="line-through text-muted-foreground">
                            {ov.originalValue}
                          </span>
                          <span className="font-bold text-amber-700 dark:text-amber-400">
                            → {ov.overrideValue}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          <span className="font-semibold text-foreground/80">
                            Physician Justification:
                          </span>{" "}
                          &quot;{ov.reason}&quot;
                        </div>
                        <div className="text-[10px] text-muted-foreground/80">
                          Prescribed by {ov.overriddenBy} at{" "}
                          {new Date(ov.overriddenAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Progressive Disclosure Toggle Link for Dense Sections */}
                {isCollapsible && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection(sec.id)}
                    className="mt-3 h-7 px-2.5 text-xs text-primary font-medium hover:underline gap-1.5 p-0 justify-start print:hidden"
                    aria-expanded={isExpanded}
                  >
                    <span>{isExpanded ? t("report.showSummary") : t("report.showFull")}</span>
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </Button>
                )}

                {/* Section Details (Hidden on Screen when Collapsed, Always Visible in Print) */}
                <div className={cn("mt-4 space-y-4", !isExpanded && "hidden print:block")}>
                  {/* Key-Value Fields */}
                  {sec.fields.length > 0 && (
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                      {sec.fields.map((f, fIdx) => (
                        <div key={fIdx} className="min-w-0">
                          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {f.label}
                          </dt>
                          <dd
                            className={cn(
                              "text-xs truncate mt-0.5",
                              f.present
                                ? "font-semibold text-foreground"
                                : "italic text-muted-foreground",
                            )}
                            title={f.value}
                          >
                            {f.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {/* Lists */}
                  {sec.lists.map((l, lIdx) => (
                    <div key={lIdx}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        {l.title}
                      </span>
                      {l.items.length === 0 ? (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {l.emptyLabel ?? "None recorded."}
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-1">
                          {l.items.map((item, iIdx) => (
                            <li
                              key={iIdx}
                              className="flex items-start gap-2 text-xs text-foreground/90"
                            >
                              <span className="size-1 rounded-full bg-primary mt-1.5 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}

                  {/* Tables */}
                  {sec.tables.map((t, tIdx) => (
                    <div key={tIdx}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        {t.title}
                      </span>
                      {t.rows.length === 0 ? (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {t.emptyLabel ?? "No data recorded."}
                        </p>
                      ) : (
                        <div className="mt-2 overflow-x-auto rounded-lg border border-border/60">
                          <table className="w-full text-start text-xs">
                            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                              <tr>
                                {t.columns.map((c, cIdx) => (
                                  <th key={cIdx} className="px-3 py-1.5 font-bold">
                                    {c}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {t.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="border-t border-border/40">
                                  {row.map((cell, cellIdx) => (
                                    <td key={cellIdx} className="px-3 py-1.5 text-foreground/90">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Dossier Legal Sign Footer (§2.3, §2.4) */}
        <footer className="mt-12 border-t-2 border-border/80 pt-6 text-xs text-muted-foreground">
          {isSigned ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="font-semibold text-emerald-900 dark:text-emerald-300">
                SIGNED — Dr. {report.signedBy} —{" "}
                {report.signedAt ? new Date(report.signedAt).toLocaleString() : ""}
                {report.cosignedBy && (
                  <span className="ms-2 font-bold text-indigo-700 dark:text-indigo-300">
                    · CO-SIGNED — Dr. {report.cosignedBy} —{" "}
                    {report.cosignedAt ? new Date(report.cosignedAt).toLocaleString() : ""}
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">
                Document ID: {report.id}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] italic">
              <span>DRAFT — PRE-SIGNATURE CLINICAL DOSSIER</span>
              <span>Subject to attending physician review & digital signature</span>
            </div>
          )}
        </footer>
      </div>

      {/* Physician Sign Confirmation Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <FileCheck2 className="size-5 text-emerald-600" />
              Sign & Lock Clinical Dossier
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1.5">
              Signing permanently snapshots all 16 clinical dossier sections, effective overrides,
              and monitoring encounters. Once signed, the report is immutable; future alterations
              require a versioned addendum.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs space-y-1">
            <div>
              <span className="font-semibold">Signatory:</span> Dr. Raouf Roshdy (Attending
              Physician)
            </div>
            <div>
              <span className="font-semibold">Version:</span> v{report.version} (Original)
            </div>
            <div>
              <span className="font-semibold">Sections Frozen:</span> {sections.length} / 16
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowSignDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmSign}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Confirm & Lock Dossier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Senior Physician Co-sign Dialog */}
      <Dialog open={showCosignDialog} onOpenChange={setShowCosignDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <FileCheck2 className="size-5 text-indigo-600" />
              Co-sign Clinical Dossier
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1.5">
              As Senior Physician, countersign and endorse the clinical management plan for this
              patient.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowCosignDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmCosign}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              Endorse & Co-sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Addendum Dialog */}
      <Dialog open={showAddendumDialog} onOpenChange={setShowAddendumDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <FilePlus2 className="size-5 text-primary" />
              Open Versioned Addendum (v{report.version + 1})
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1.5">
              The original dossier (v{report.version}) remains locked and byte-frozen in the legal
              archive. Please provide the clinical rationale for opening this addendum.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-foreground">
              Addendum Justification (Mandatory):
            </label>
            <Textarea
              placeholder="e.g., Follicular cohort accelerated on Stimulation Day 8; adjusted trigger timing."
              value={addendumReason}
              onChange={(e) => setAddendumReason(e.target.value)}
              className="text-xs min-h-[90px]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowAddendumDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={addendumReason.trim().length < 5}
              onClick={confirmAddendum}
              className="bg-primary text-primary-foreground font-semibold"
            >
              Create Addendum v{report.version + 1}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
