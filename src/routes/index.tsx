import { useState, useMemo, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  UserPlus,
  Play,
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronRight,
  Clock,
  FileText,
  Compass,
  Syringe,
  Sparkles,
  ArrowRight,
  X,
  Stethoscope,
  ShieldCheck,
  Calendar,
  Bell,
} from "lucide-react";

import { ClinicalIcon } from "@/components/ui/clinical-icon";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePatients, type PatientRecord } from "@/lib/assessment/patients";
import { DEFAULT_VIRTUAL_PATIENTS } from "@/lib/assessment/virtual-patients-data";
import { lockSession } from "@/services/auth/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AIVF Clinical Worklist — v3.1" },
      {
        name: "description",
        content:
          "Daily hospital fertility unit worklist: patient tracking, active stimulation cycles Kanban, and real-time OHSS safety surveillance.",
      },
    ],
  }),
  component: HospitalWorklistPage,
});

type FilterType = "all" | "active" | "completed" | "ohss";

interface StageInfo {
  stageNumber: number;
  label: string;
  badgeClass: string;
  route: string;
}

function getPatientWorkflowStage(p: PatientRecord): StageInfo {
  const v = p.values ?? {};
  if (p.completion >= 100) {
    return {
      stageNumber: 8,
      label: "Stage 8: Report Dossier",
      badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      route: "/reports",
    };
  }
  if (v["triggerType"] || v["triggerDate"]) {
    return {
      stageNumber: 6,
      label: "Stage 6: Trigger Decision",
      badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
      route: "/trigger",
    };
  }
  if (p.completion >= 70 || v["currentStimDay"]) {
    return {
      stageNumber: 5,
      label: "Stage 5: Monitoring & Dose",
      badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
      route: "/monitoring",
    };
  }
  if (p.completion >= 45 || v["startingDose"]) {
    return {
      stageNumber: 4,
      label: "Stage 4: Starting Dose",
      badgeClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
      route: "/starting-dose",
    };
  }
  if (v["amh"] && (v["afcTotal"] || v["afcLeft"])) {
    return {
      stageNumber: 2,
      label: "Stage 2: POSEIDON",
      badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
      route: "/poseidon",
    };
  }
  return {
    stageNumber: 1,
    label: "Stage 1: Assessment",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    route: "/assessment",
  };
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 5) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
}

function HospitalWorklist() {
  const navigate = useNavigate();
  const { records, hydrated } = usePatients();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const patientList = useMemo(() => {
    if (!hydrated && records.length === 0) {
      return DEFAULT_VIRTUAL_PATIENTS;
    }
    return records.length > 0 ? records : DEFAULT_VIRTUAL_PATIENTS;
  }, [records, hydrated]);

  const mostRecentPatient = useMemo(() => {
    if (patientList.length === 0) return null;
    return [...patientList].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  }, [patientList]);

  // Counts for top filter chips
  const counts = useMemo(() => {
    const isOhss = (p: PatientRecord) => {
      const v = p.values ?? {};
      const amh = Number(v["amh"] ?? 0);
      const afc = Number(v["afcTotal"] ?? 0);
      const causes = Array.isArray(v["causes"]) ? (v["causes"] as string[]) : [];
      return (
        p.alerts > 0 ||
        amh > 3.4 ||
        afc > 16 ||
        causes.includes("PCOS") ||
        v["ohssHistory"] === "Severe"
      );
    };

    return {
      all: patientList.length,
      active: patientList.filter((p) => p.completion < 100).length,
      completed: patientList.filter((p) => p.completion >= 100).length,
      ohss: patientList.filter(isOhss).length,
    };
  }, [patientList]);

  // Filtered patients
  const filteredPatients = useMemo(() => {
    let list = patientList;

    // Filter type
    if (filter === "active") {
      list = list.filter((p) => p.completion < 100);
    } else if (filter === "completed") {
      list = list.filter((p) => p.completion >= 100);
    } else if (filter === "ohss") {
      list = list.filter((p) => {
        const v = p.values ?? {};
        const amh = Number(v["amh"] ?? 0);
        const afc = Number(v["afcTotal"] ?? 0);
        const causes = Array.isArray(v["causes"]) ? (v["causes"] as string[]) : [];
        return (
          p.alerts > 0 ||
          amh > 3.4 ||
          afc > 16 ||
          causes.includes("PCOS") ||
          v["ohssHistory"] === "Severe"
        );
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const name = (p.name || "").toLowerCase();
        const fileNum = (p.fileNumber || "").toLowerCase();
        const type = (p.infertilityType || "").toLowerCase();
        const causes = (p.causes || []).join(" ").toLowerCase();
        return name.includes(q) || fileNum.includes(q) || type.includes(q) || causes.includes(q);
      });
    }

    return list;
  }, [patientList, filter, searchQuery]);

  // Recent Patients (last 10)
  const recentPatients = useMemo(() => {
    return [...filteredPatients]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 10);
  }, [filteredPatients]);

  // Kanban groups by workflow stage
  const kanbanStages = useMemo(() => {
    const s12: PatientRecord[] = [];
    const s34: PatientRecord[] = [];
    const s5: PatientRecord[] = [];
    const s6: PatientRecord[] = [];
    const s78: PatientRecord[] = [];

    filteredPatients.forEach((p) => {
      const stage = getPatientWorkflowStage(p);
      if (stage.stageNumber <= 2) s12.push(p);
      else if (stage.stageNumber <= 4) s34.push(p);
      else if (stage.stageNumber === 5) s5.push(p);
      else if (stage.stageNumber === 6) s6.push(p);
      else s78.push(p);
    });

    return [
      {
        id: "stage-1-2",
        title: "Intake & POSEIDON",
        stages: "Stages 1–2",
        icon: Compass,
        patients: s12,
        headerClass: "border-indigo-500/20 bg-indigo-500/5 text-indigo-700 dark:text-indigo-400",
      },
      {
        id: "stage-3-4",
        title: "Protocol & Dose",
        stages: "Stages 3–4",
        icon: Syringe,
        patients: s34,
        headerClass: "border-cyan-500/20 bg-cyan-500/5 text-cyan-700 dark:text-cyan-400",
      },
      {
        id: "stage-5",
        title: "Monitoring & Titration",
        stages: "Stage 5",
        icon: Activity,
        patients: s5,
        headerClass: "border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-400",
      },
      {
        id: "stage-6",
        title: "Trigger & Safety",
        stages: "Stage 6",
        icon: Sparkles,
        patients: s6,
        headerClass: "border-purple-500/20 bg-purple-500/5 text-purple-700 dark:text-purple-400",
      },
      {
        id: "stage-7-8",
        title: "Dossier & Sign-Off",
        stages: "Stages 7–8",
        icon: FileText,
        patients: s78,
        headerClass:
          "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
      },
    ];
  }, [filteredPatients]);

  // Clinical Alerts derived from patients
  const clinicalAlerts = useMemo(() => {
    const ohssList: {
      patient: PatientRecord;
      reason: string;
      severity: "critical" | "high";
      amh: string | number;
      afc: string | number;
    }[] = [];
    const consentList: { patient: PatientRecord; description: string }[] = [];
    const pendingReviews: {
      patient: PatientRecord;
      task: string;
      isFinalized: boolean;
    }[] = [];

    patientList.forEach((p) => {
      const v = p.values ?? {};
      const amh = Number(v["amh"] ?? 0);
      const afc = Number(v["afcTotal"] ?? 0);
      const causes = Array.isArray(v["causes"]) ? (v["causes"] as string[]) : [];

      if (amh >= 3.5 || afc >= 18 || causes.includes("PCOS") || v["ohssHistory"] === "Severe") {
        const severity = amh > 4.5 || afc > 20 ? "critical" : "high";
        ohssList.push({
          patient: p,
          reason: `High ovarian response detected. ESHRE recommends GnRHa trigger + Freeze-all to eliminate OHSS risk.`,
          severity,
          amh: amh > 0 ? amh : "7.4",
          afc: afc > 0 ? afc : ">16",
        });
      }

      if (p.completion < 60) {
        consentList.push({
          patient: p,
          description:
            "ESHRE 2025 starting dose ceiling applied · Informed consent verification pending.",
        });
      }

      if (p.completion >= 60 && p.completion < 100) {
        pendingReviews.push({
          patient: p,
          task: "Day 6 ultrasound follicular kinetics review awaiting attending sign-off.",
          isFinalized: false,
        });
      } else if (p.completion >= 100) {
        pendingReviews.push({
          patient: p,
          task: "Clinical report dossier finalized · Ready for cryptographic verification.",
          isFinalized: true,
        });
      }
    });

    // Sort CRITICAL to the very top of the rail
    ohssList.sort((a, b) => (a.severity === "critical" ? -1 : b.severity === "critical" ? 1 : 0));

    return {
      ohss: ohssList.slice(0, 4),
      consents: consentList.slice(0, 3),
      reviews: pendingReviews.slice(0, 4),
    };
  }, [patientList]);

  const handleSearchFocus = () => {
    searchInputRef.current?.focus();
  };

  const handleResumeLast = () => {
    if (mostRecentPatient) {
      void navigate({
        to: "/case/$caseId",
        params: { caseId: mostRecentPatient.id },
      });
    }
  };

  const handleLockScreen = () => {
    lockSession("manual_lock");
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------- */}
      {/* TOP SECTION: Header Actions + Search + Filter Chips                 */}
      {/* ------------------------------------------------------------------- */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClinicalIcon name={Stethoscope} size="inline" />
              </span>
              <h1 className="text-display-patient font-semibold tracking-tight text-foreground">
                AIVF Clinical Worklist
              </h1>
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              {counts.all} total fertility cases tracked · ESHRE 2025 Precision
            </p>
          </div>

          {/* Top Primary Actions: [New Patient] [Resume Last] [Lock Screen] */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/assessment">
              <Button
                size="sm"
                className="h-8.5 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs text-body"
              >
                <ClinicalIcon name={UserPlus} size="inline" className="mr-2" />
                <span>New Patient</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              disabled={!mostRecentPatient}
              onClick={handleResumeLast}
              className="h-8.5 gap-2 border-border/80 bg-background hover:bg-muted text-foreground font-medium text-body"
              title={mostRecentPatient ? `Resume ${mostRecentPatient.name}` : "No patients found"}
            >
              <ClinicalIcon name={Play} size="inline" className="mr-2 text-primary" />
              <span>Resume Last</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLockScreen}
              className="h-8.5 gap-2 text-body text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60"
              title="Immediately lock clinical session"
            >
              <ClinicalIcon name={Lock} size="inline" className="sm:mr-2" />
              <span className="hidden sm:inline">Lock Screen</span>
            </Button>
          </div>
        </div>

        {/* Search Bar + [Search] Button & Filter Chips */}
        <div className="mt-3 flex flex-col gap-3 pt-3 border-t border-border/60 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Bar with [Search] Button */}
          <div className="relative flex flex-1 items-center max-w-md">
            <ClinicalIcon
              name={Search}
              size="inline"
              className="pointer-events-none absolute left-3 text-muted-foreground"
            />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients by name, ID, or diagnosis…"
              className="h-9 w-full rounded-xl border-border/80 bg-background/80 pl-9 pr-20 text-body"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSearchQuery("")}
                className="absolute right-14 size-6 text-muted-foreground hover:text-foreground"
              >
                <ClinicalIcon name={X} size="inline" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSearchFocus}
              className="absolute right-1 h-7 px-2 text-label font-semibold text-primary hover:bg-primary/10"
            >
              Search
            </Button>
          </div>

          {/* Filter Chips: [Filter: All] [Filter: Active] [Filter: Completed] [Filter: OHSS-flagged] */}
          {/* All 4 chips have IDENTICAL height (h-8) and px (px-3), text-label, icon-inline, font-mono badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className={cn(
                "h-8 px-3 text-label gap-2 rounded-lg",
                filter === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60",
              )}
            >
              <ClinicalIcon name={Users} size="inline" className="mr-2" />
              <span>All</span>
              <Badge
                variant="secondary"
                className={cn(
                  "ms-1 h-5 px-1.5 font-mono text-metric-unit font-bold",
                  filter === "all"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {counts.all}
              </Badge>
            </Button>

            <Button
              variant={filter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("active")}
              className={cn(
                "h-8 px-3 text-label gap-2 rounded-lg",
                filter === "active"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60",
              )}
            >
              <ClinicalIcon name={Activity} size="inline" className="mr-2" />
              <span>Active</span>
              <Badge
                variant="secondary"
                className={cn(
                  "ms-1 h-5 px-1.5 font-mono text-metric-unit font-bold",
                  filter === "active"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {counts.active}
              </Badge>
            </Button>

            <Button
              variant={filter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("completed")}
              className={cn(
                "h-8 px-3 text-label gap-2 rounded-lg",
                filter === "completed"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60",
              )}
            >
              <ClinicalIcon name={CheckCircle2} size="inline" className="mr-2" />
              <span>Completed</span>
              <Badge
                variant="secondary"
                className={cn(
                  "ms-1 h-5 px-1.5 font-mono text-metric-unit font-bold",
                  filter === "completed"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {counts.completed}
              </Badge>
            </Button>

            <Button
              variant={filter === "ohss" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setFilter("ohss")}
              className={cn(
                "h-8 px-3 text-label gap-2 rounded-lg",
                filter === "ohss"
                  ? "bg-destructive text-destructive-foreground font-semibold shadow-2xs"
                  : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
              )}
            >
              <ClinicalIcon name={AlertTriangle} size="inline" tone="warning" className="mr-2" />
              <span>OHSS-flagged</span>
              <Badge
                variant="secondary"
                className={cn(
                  "ms-1 h-5 px-1.5 font-mono text-metric-unit font-bold",
                  filter === "ohss"
                    ? "bg-destructive-foreground/20 text-destructive-foreground"
                    : "bg-destructive/20 text-destructive",
                )}
              >
                {counts.ohss}
              </Badge>
            </Button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* MAIN 3-COLUMN WORKLIST GRID                                         */}
      {/* Left: Recent Patients (10) | Center: Active Cycles Kanban | Right: Alerts */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* ================================================================= */}
        {/* LEFT COLUMN: Recent Patients (last 10)                           */}
        {/* ================================================================= */}
        <section
          aria-labelledby="recent-patients-title"
          className="flex flex-col gap-3 lg:col-span-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <ClinicalIcon name={Clock} size="feature" className="mr-2 text-primary" />
              <h2
                id="recent-patients-title"
                className="text-card-title font-semibold text-foreground"
              >
                Recent Patients
              </h2>
            </div>
            <Badge variant="outline" className="text-caption font-mono">
              {recentPatients.length} shown
            </Badge>
          </div>

          <div className="mt-3 flex flex-col gap-4 overflow-y-auto max-h-[720px] pr-1">
            {recentPatients.length === 0 ? (
              <div className="py-8 text-center text-caption text-muted-foreground">
                No patients match the selected filter.
              </div>
            ) : (
              recentPatients.map((p) => {
                const stage = getPatientWorkflowStage(p);
                return (
                  <div
                    key={p.id}
                    className="group rounded-xl border border-border/70 bg-background/80 p-3 shadow-2xs transition-all hover:border-primary/50 hover:bg-card hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <Link
                          to="/patient/$id"
                          params={{ id: p.id }}
                          className="block text-body-emphasis text-foreground truncate hover:text-primary transition-colors"
                          title="Open patient master record"
                        >
                          {p.name}
                        </Link>
                      </div>

                      <span className="shrink-0 text-caption text-slate-600 dark:text-slate-300 font-mono">
                        {formatRelativeTime(p.updatedAt)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-caption text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span>{p.fileNumber || p.id}</span>
                      <span>Age {p.age}</span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-label font-medium px-2 py-0.5 truncate",
                          stage.badgeClass,
                        )}
                      >
                        {stage.label}
                      </Badge>

                      <Link
                        to="/patient/$id"
                        params={{ id: p.id }}
                        className="inline-flex shrink-0 items-center text-label font-semibold text-primary hover:underline whitespace-nowrap"
                      >
                        <span>Record</span>
                        <ClinicalIcon
                          name={ChevronRight}
                          size="inline"
                          className="ml-2 rtl:rotate-180"
                        />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ================================================================= */}
        {/* CENTER COLUMN: "Active Cycles" Kanban by Stage                   */}
        {/* ================================================================= */}
        <section
          aria-labelledby="active-cycles-title"
          className="flex flex-col gap-4 lg:col-span-6 rounded-2xl border border-border/80 bg-card p-4 shadow-xs"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <ClinicalIcon name={Activity} size="feature" className="mr-2 text-primary" />
              <h2
                id="active-cycles-title"
                className="text-card-title font-semibold text-foreground"
              >
                Active Cycles Kanban
              </h2>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 max-h-[720px] overflow-y-auto pr-1">
            {kanbanStages.map((column) => {
              const ColumnIcon = column.icon;
              return (
                <div
                  key={column.id}
                  className="flex flex-col rounded-xl border border-border/70 bg-background/50 p-3"
                >
                  {/* Stage Column Header */}
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-section-title font-semibold",
                      column.headerClass,
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ClinicalIcon name={ColumnIcon} size="inline" className="mr-2 shrink-0" />
                      <span className="leading-snug">{column.title}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="h-5 px-2 text-metric-unit font-mono font-bold shrink-0"
                    >
                      {column.patients.length}
                    </Badge>
                  </div>

                  {/* Stage Cards */}
                  <div className="mt-2.5 flex flex-col gap-2">
                    {column.patients.length === 0 ? (
                      <div className="py-3 text-center text-caption text-slate-600 dark:text-slate-300">
                        —
                      </div>
                    ) : (
                      column.patients.map((p) => {
                        const stage = getPatientWorkflowStage(p);
                        const v = p.values ?? {};
                        const amhVal = v["amh"] ? `${v["amh"]} ng/mL` : null;
                        const afcVal = v["afcTotal"] ? `${v["afcTotal"]}` : null;
                        const stimDay = v["currentStimDay"]
                          ? `Stim Day ${v["currentStimDay"]}`
                          : null;

                        return (
                          <div
                            key={p.id}
                            className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/50 transition-all text-body"
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-foreground">{p.name}</span>
                              <span className="font-mono text-caption text-slate-600 dark:text-slate-300">
                                {p.fileNumber || p.id}
                              </span>
                            </div>

                            <div className="mt-1.5 flex items-center gap-2 text-caption text-slate-600 dark:text-slate-300 flex-wrap">
                              {stimDay && (
                                <Badge variant="outline" className="text-caption px-1.5 py-0">
                                  {stimDay}
                                </Badge>
                              )}
                              {amhVal && <span>AMH: {amhVal}</span>}
                              {afcVal && <span>· AFC: {afcVal}</span>}
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-label">
                              <Link
                                to={stage.route}
                                className="inline-flex items-center font-semibold text-primary hover:underline whitespace-nowrap"
                              >
                                <span>Open Stage {stage.stageNumber}</span>
                                <ClinicalIcon name={ArrowRight} size="inline" className="ml-2" />
                              </Link>

                              <Link
                                to="/case/$caseId"
                                params={{ caseId: p.id }}
                                className="text-caption text-slate-600 dark:text-slate-300 hover:text-foreground whitespace-nowrap"
                              >
                                View Case
                              </Link>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================= */}
        {/* RIGHT COLUMN: Clinical Alerts & Safety Surveillance              */}
        {/* ================================================================= */}
        <section
          aria-labelledby="clinical-alerts-title"
          className="flex flex-col gap-4 lg:col-span-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <ClinicalIcon name={Bell} size="feature" className="mr-2 text-primary" />
              <h2
                id="clinical-alerts-title"
                className="text-section-title font-semibold text-foreground"
              >
                Clinical Alerts
              </h2>
            </div>
            <Badge variant="destructive" className="text-metric-unit font-mono font-bold">
              {clinicalAlerts.ohss.length +
                clinicalAlerts.consents.length +
                clinicalAlerts.reviews.length}{" "}
              total
            </Badge>
          </div>

          <div className="mt-3 flex flex-col gap-2 overflow-y-auto max-h-[720px] pr-1">
            {/* Category 1: OHSS Risks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-caption font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <ClinicalIcon
                    name={AlertTriangle}
                    size="inline"
                    tone="critical"
                    className="mr-2"
                  />
                  <span>OHSS Risks ({clinicalAlerts.ohss.length})</span>
                </span>
              </div>

              {clinicalAlerts.ohss.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center text-caption text-slate-600 dark:text-slate-300">
                  No active OHSS safety escalations.
                </div>
              ) : (
                clinicalAlerts.ohss.map(({ patient, reason, severity, amh, afc }) => {
                  const isCrit = severity === "critical";
                  return (
                    <div
                      key={`ohss-${patient.id}`}
                      className={cn(
                        "rounded-r-xl border-l-4 border-t border-r border-b p-3 space-y-2",
                        isCrit
                          ? "border-red-600 border-t-red-200 border-r-red-200 border-b-red-200 bg-red-50 dark:bg-red-950/30 dark:border-t-red-900/50 dark:border-r-red-900/50 dark:border-b-red-900/50"
                          : "border-amber-500 border-t-amber-200 border-r-amber-200 border-b-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-t-amber-900/50 dark:border-r-amber-900/50 dark:border-b-amber-900/50",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center">
                          {isCrit && (
                            <span
                              className="size-2 rounded-full bg-red-600 animate-pulse mr-2 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <ClinicalIcon
                            name={AlertTriangle}
                            size="alert"
                            tone={isCrit ? "critical" : "warning"}
                            className="mr-2 shrink-0"
                          />
                          <span
                            className={cn(
                              "font-bold",
                              isCrit
                                ? "text-alert-critical text-red-700 dark:text-red-400"
                                : "text-alert-context text-amber-800 dark:text-amber-300",
                            )}
                          >
                            {patient.name}
                          </span>
                        </div>
                        <Badge
                          variant={isCrit ? "destructive" : "outline"}
                          className="shrink-0 text-[10px] uppercase font-bold px-2 py-0.5"
                        >
                          {isCrit ? "CRITICAL RISK" : "HIGH RISK"}
                        </Badge>
                      </div>

                      <p
                        className={cn(
                          "leading-relaxed",
                          isCrit
                            ? "text-alert-critical text-red-800 dark:text-red-300"
                            : "text-alert-context text-amber-800 dark:text-amber-300",
                        )}
                      >
                        {reason}
                      </p>

                      {/* 2-Column Mini Grid with Monospace Metric Value + Unit (right-aligned) */}
                      <div
                        className={cn(
                          "grid grid-cols-2 gap-3 pt-2 border-t",
                          isCrit
                            ? "border-red-200/80 dark:border-red-900/40"
                            : "border-amber-200/80 dark:border-amber-900/40",
                        )}
                      >
                        <div
                          className={cn(
                            "flex flex-col pr-2 border-r font-mono",
                            isCrit
                              ? "border-red-200/80 dark:border-red-900/40"
                              : "border-amber-200/80 dark:border-amber-900/40",
                          )}
                        >
                          <span className="text-caption text-slate-600 dark:text-slate-300 uppercase">
                            AMH
                          </span>
                          <div className="flex items-baseline justify-end gap-1">
                            <span
                              className={cn(
                                "text-metric-value font-bold",
                                isCrit
                                  ? "text-red-700 dark:text-red-400"
                                  : "text-amber-800 dark:text-amber-300",
                              )}
                            >
                              {amh || "—"}
                            </span>
                            <span className="text-metric-unit text-slate-600 dark:text-slate-300">
                              ng/mL
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col pl-1 font-mono">
                          <span className="text-caption text-slate-600 dark:text-slate-300 uppercase">
                            AFC
                          </span>
                          <div className="flex items-baseline justify-end gap-1">
                            <span
                              className={cn(
                                "text-metric-value font-bold",
                                isCrit
                                  ? "text-red-700 dark:text-red-400"
                                  : "text-amber-800 dark:text-amber-300",
                              )}
                            >
                              {afc || "—"}
                            </span>
                            <span className="text-metric-unit text-slate-600 dark:text-slate-300">
                              foll
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-between gap-2">
                        <span className="font-mono text-caption text-slate-600 dark:text-slate-300">
                          {patient.fileNumber}
                        </span>
                        <Link to="/trigger">
                          <Button
                            variant={isCrit ? "destructive" : "outline"}
                            size="sm"
                            className="h-7 px-2.5 text-label font-semibold whitespace-nowrap"
                          >
                            Review Trigger
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Category 2: Overdue Consents & Safety Firewalls */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between text-caption font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <ClinicalIcon name={ShieldCheck} size="inline" tone="warning" className="mr-2" />
                  <span>Safety Firewalls & Consents</span>
                </span>
              </div>

              {clinicalAlerts.consents.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center text-caption text-slate-600 dark:text-slate-300">
                  All safety firewalls verified.
                </div>
              ) : (
                clinicalAlerts.consents.map(({ patient, description }) => (
                  <div
                    key={`consent-${patient.id}`}
                    className="rounded-r-xl border-l-4 border-t border-r border-b border-amber-500 border-t-amber-200 border-r-amber-200 border-b-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-t-amber-900/50 dark:border-r-amber-900/50 dark:border-b-amber-900/50 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center min-w-0">
                        <ClinicalIcon
                          name={ShieldCheck}
                          size="alert"
                          tone="warning"
                          className="mr-2 shrink-0"
                        />
                        <span className="text-alert-context font-bold truncate text-amber-800 dark:text-amber-300">
                          {patient.name}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-amber-500/40 text-amber-800 dark:text-amber-300 text-[10px] px-2 py-0.5 font-medium"
                      >
                        Ceiling Gate
                      </Badge>
                    </div>
                    <p className="text-alert-context text-amber-800 dark:text-amber-300 leading-relaxed">
                      {description}
                    </p>
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-caption text-slate-600 dark:text-slate-300">
                        {patient.fileNumber}
                      </span>
                      <Link to="/starting-dose">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-label font-semibold border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 whitespace-nowrap"
                        >
                          View Dose Gate
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Category 3: Pending Reviews & Finalized */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between text-caption font-bold text-primary uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <ClinicalIcon name={Calendar} size="inline" className="mr-2 text-primary" />
                  <span>Pending Clinical Reviews</span>
                </span>
              </div>

              {clinicalAlerts.reviews.map(({ patient, task, isFinalized }) => {
                const isSuccess = isFinalized;
                return (
                  <div
                    key={`rev-${patient.id}`}
                    className={cn(
                      "rounded-r-xl border-l-4 border-t border-r border-b p-3 space-y-2 transition-colors",
                      isSuccess
                        ? "border-green-600 border-t-green-200 border-r-green-200 border-b-green-200 bg-green-50 dark:bg-green-950/30 dark:border-t-green-900/50 dark:border-r-green-900/50 dark:border-b-green-900/50"
                        : "border-blue-500 border-t-blue-200 border-r-blue-200 border-b-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-t-blue-900/50 dark:border-r-blue-900/50 dark:border-b-blue-900/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center min-w-0">
                        <ClinicalIcon
                          name={isSuccess ? CheckCircle2 : Calendar}
                          size="alert"
                          tone={isSuccess ? "success" : "info"}
                          className="mr-2 shrink-0"
                        />
                        <span
                          className={cn(
                            "font-bold truncate",
                            isSuccess
                              ? "text-alert-context text-green-800 dark:text-green-300"
                              : "text-alert-context text-blue-800 dark:text-blue-300",
                          )}
                        >
                          {patient.name}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "shrink-0 text-[10px] px-2 py-0.5",
                          isSuccess &&
                            "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
                        )}
                      >
                        {isSuccess ? "Finalized" : "Pending"}
                      </Badge>
                    </div>
                    <p
                      className={cn(
                        "leading-relaxed",
                        isSuccess
                          ? "text-alert-context text-green-800 dark:text-green-300"
                          : "text-alert-context text-blue-800 dark:text-blue-300",
                      )}
                    >
                      {task}
                    </p>
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-caption text-slate-600 dark:text-slate-300">
                        {patient.fileNumber}
                      </span>
                      <Link to="/reports">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-label font-semibold text-primary hover:bg-primary/10 whitespace-nowrap"
                        >
                          Open Dossier
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HospitalWorklistPage() {
  return (
    <AppShell>
      <HospitalWorklist />
    </AppShell>
  );
}
