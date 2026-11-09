import { useState, useMemo } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  ShieldCheck,
  AlertOctagon,
  Lock,
  RotateCcw,
  Sparkles,
  Check,
  ShieldAlert,
  Sliders,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { usePatients, type PatientRecord, savePatient } from "@/lib/assessment/patients";
import { DEFAULT_VIRTUAL_PATIENTS } from "@/lib/assessment/virtual-patients-data";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { ageFromDob } from "@/lib/assessment/schema";
import { lockSession } from "@/services/auth/session";
import { appendAuditEntry } from "@/services/audit/auditLog";
import { useAutoSave } from "@/hooks/use-auto-save";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/patients/$id/dose")({
  head: () => ({
    meta: [
      { title: "Stage 4: Starting Dose Engine & CONSORT Nomogram — AIVF CDSS v3.1" },
      {
        name: "description",
        content:
          "Stage 4 starting dose calculation using the published CONSORT nomogram, interactive dose curve, and ESHRE 2025 low-responder 300 IU safety ceiling firewall.",
      },
    ],
  }),
  component: PatientDoseStage4View,
});

interface NomogramPoint {
  score: number;
  dose: number;
  label: string;
}

const NOMOGRAM_STEPS: NomogramPoint[] = [
  { score: 0, dose: 112.5, label: "Score 0 (112.5 IU)" },
  { score: 1, dose: 112.5, label: "Score 1 (112.5 IU)" },
  { score: 2, dose: 150.0, label: "Score 2 (150.0 IU)" },
  { score: 3, dose: 150.0, label: "Score 3 (150.0 IU)" },
  { score: 4, dose: 187.5, label: "Score 4 (187.5 IU)" },
  { score: 5, dose: 187.5, label: "Score 5 (187.5 IU)" },
  { score: 6, dose: 225.0, label: "Score 6 (225.0 IU)" },
  { score: 7, dose: 225.0, label: "Score 7 (225.0 IU)" },
  { score: 8, dose: 262.5, label: "Score 8 (262.5 IU)" },
  { score: 9, dose: 262.5, label: "Score 9 (262.5 IU)" },
  { score: 10, dose: 300.0, label: "Score 10 (300.0 IU)" },
  { score: 11, dose: 300.0, label: "Score 11 (300.0 IU)" },
  { score: 12, dose: 300.0, label: "Score 12 (300.0 IU)" },
];

export function PatientDoseStage4View() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const { records } = usePatients();
  const { setValue: setAssessmentValue, draft } = useAssessment();

  // Find target patient master record
  const patient = useMemo<PatientRecord>(() => {
    const targetId = id ? decodeURIComponent(id) : "";
    const found = records.find(
      (r) =>
        r.id === targetId ||
        r.fileNumber === targetId ||
        r.id.toLowerCase() === targetId.toLowerCase(),
    );
    if (found) return found;

    const defaultFound = DEFAULT_VIRTUAL_PATIENTS.find(
      (r) =>
        r.id === targetId ||
        r.fileNumber === targetId ||
        r.id.toLowerCase() === targetId.toLowerCase(),
    );
    if (defaultFound) return defaultFound;

    return (
      records[0] ||
      DEFAULT_VIRTUAL_PATIENTS[0] || {
        id: "pt-default",
        name: "Intake Patient",
        fileNumber: "IVF-NEW",
        age: "34 years",
        partnerAge: "36",
        infertilityType: "Primary",
        causes: [],
        cycles: 0,
        completion: 45,
        alerts: 0,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        values: {},
        cycleRecords: [],
      }
    );
  }, [id, records]);

  // Baseline variables for CONSORT Nomogram
  const baselineAge = useMemo<number>(() => {
    if (patient.values?.["age"]) return Number(patient.values["age"]);
    if (patient.values?.["dob"]) {
      const parsed = ageFromDob(String(patient.values["dob"]));
      if (parsed) return Number(parsed);
    }
    const match = patient.age.match(/\d+/);
    return match ? Number(match[0]) : 34;
  }, [patient]);

  const baselineBmi = useMemo<number>(() => {
    const v = patient.values?.["bmi"] ?? draft.values["bmi"];
    return typeof v === "number" ? v : Number(v) || 24.2;
  }, [patient.values, draft.values]);

  const baselineFsh = useMemo<number>(() => {
    const v = patient.values?.["fsh"] ?? draft.values["fsh"];
    return typeof v === "number" ? v : Number(v) || 7.2;
  }, [patient.values, draft.values]);

  const baselineAfc = useMemo<number>(() => {
    const v = patient.values?.["afcTotal"] ?? draft.values["afcTotal"];
    return typeof v === "number" ? v : Number(v) || 11;
  }, [patient.values, draft.values]);

  const baselineAmh = useMemo<number>(() => {
    const v = patient.values?.["amh"] ?? draft.values["amh"];
    return typeof v === "number" ? v : Number(v) || 1.8;
  }, [patient.values, draft.values]);

  const poseidonGroup = useMemo<string>(() => {
    return String(
      patient.values?.["poseidonGroup"] ?? draft.values["poseidonGroup"] ?? "Not Low Prognosis",
    );
  }, [patient.values, draft.values]);

  // Is this patient classified as a poor responder requiring the 300 IU ceiling?
  const isPoorResponder = useMemo<boolean>(() => {
    if (poseidonGroup === "3" || poseidonGroup === "4") return true;
    if (
      patient.values?.["bolognaStatus"] === "positive" ||
      draft.values["bolognaStatus"] === "positive"
    ) {
      return true;
    }
    if (baselineAmh < 1.2 || baselineAfc < 7) return true;
    return false;
  }, [poseidonGroup, patient.values, draft.values, baselineAmh, baselineAfc]);

  // Editable Nomogram Parameters
  const [ageInput, setAgeInput] = useState<number>(Number(baselineAge));
  const [bmiInput, setBmiInput] = useState<number>(Number(baselineBmi));
  const [fshInput, setFshInput] = useState<number>(Number(baselineFsh));
  const [afcInput, setAfcInput] = useState<number>(Number(baselineAfc));

  // Ceiling override state
  const [ceilingOverridden, setCeilingOverridden] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideDose, setOverrideDose] = useState<number>(375);
  const [overrideReason, setOverrideReason] = useState("");
  const [activeOverride, setActiveOverride] = useState<{
    dose: number;
    reason: string;
    at: string;
  } | null>(null);

  const [isModified, setIsModified] = useState(false);

  // Calculate points for each parameter per validated CONSORT model
  const fshPoints = useMemo(() => {
    if (fshInput < 6.0) return 0;
    if (fshInput < 9.0) return 1;
    if (fshInput < 12.0) return 2;
    return 3;
  }, [fshInput]);

  const bmiPoints = useMemo(() => {
    if (bmiInput < 20.0) return 0;
    if (bmiInput < 25.0) return 1;
    if (bmiInput < 30.0) return 2;
    return 3;
  }, [bmiInput]);

  const agePoints = useMemo(() => {
    if (ageInput < 30) return 0;
    if (ageInput < 35) return 1;
    if (ageInput < 40) return 2;
    return 3;
  }, [ageInput]);

  const afcPoints = useMemo(() => {
    if (afcInput >= 16) return 0;
    if (afcInput >= 10) return 1;
    if (afcInput >= 5) return 2;
    return 3;
  }, [afcInput]);

  // Composite Nomogram Score (0 to 12)
  const compositeScore = useMemo(() => {
    return Math.min(12, Math.max(0, fshPoints + bmiPoints + agePoints + afcPoints));
  }, [fshPoints, bmiPoints, agePoints, afcPoints]);

  // Uncapped Calculated Dose from Nomogram Step Crosswalk
  const uncappedCalculatedDose = useMemo(() => {
    if (compositeScore <= 1) return 112.5;
    if (compositeScore <= 3) return 150.0;
    if (compositeScore <= 5) return 187.5;
    if (compositeScore <= 7) return 225.0;
    if (compositeScore <= 9) return 262.5;
    return 300.0;
  }, [compositeScore]);

  // Effective Clinical Dose (enforcing 300 IU ceiling unless overridden)
  const effectiveDose = useMemo(() => {
    if (ceilingOverridden && activeOverride) {
      return activeOverride.dose;
    }
    if (isPoorResponder) {
      // Hard ceiling of 300 IU for poor responders
      return Math.min(300.0, Math.max(225.0, uncappedCalculatedDose));
    }
    return uncappedCalculatedDose;
  }, [ceilingOverridden, activeOverride, isPoorResponder, uncappedCalculatedDose]);

  // Auto-save hook
  useAutoSave({
    onSave: () => {
      setAssessmentValue("startingDose", effectiveDose);
    },
    intervalMs: 30000,
    enabled: isModified,
  });

  // Action 1: [Compute Dose]
  const handleComputeDose = () => {
    setIsModified(true);
    setAssessmentValue("startingDose", effectiveDose);
    setAssessmentValue("consortScore", compositeScore);

    const updatedPatient: PatientRecord = {
      ...patient,
      updatedAt: new Date().toISOString(),
      completion: Math.max(patient.completion || 0, 60),
      values: {
        ...patient.values,
        ["startingDose"]: effectiveDose,
        ["consortScore"]: compositeScore,
      },
    };
    savePatient(updatedPatient);

    toast.success("Starting Dose Computed", {
      description: `Calculated ${effectiveDose} IU/day based on composite CONSORT score ${compositeScore}/12.`,
    });
  };

  // Action 2: [Apply Ceiling]
  const handleApplyCeiling = () => {
    setCeilingOverridden(false);
    setActiveOverride(null);
    setAssessmentValue("startingDose", 300);

    const updatedPatient: PatientRecord = {
      ...patient,
      updatedAt: new Date().toISOString(),
      values: {
        ...patient.values,
        ["startingDose"]: 300,
        ["ceilingEnforced"]: "true",
        ["ceilingOverridden"]: "false",
      },
    };
    savePatient(updatedPatient);

    // Cryptographic audit log
    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: "CEILING_HARD_APPLIED",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        patientName: patient.name,
        guideline: "ESHRE 2025 Rec 20",
        enforcedDose: 300,
        uncappedDose: uncappedCalculatedDose,
        isPoorResponder,
        timestamp: new Date().toISOString(),
      },
    });

    toast.success("ESHRE 2025 300 IU Ceiling Applied", {
      description:
        "Dose locked to 300 IU/day per clinical safety guidelines for poor ovarian response.",
    });
  };

  // Action 3: Confirm Override ([Override Ceiling (audit-logged)])
  const handleConfirmCeilingOverride = () => {
    if (overrideReason.trim().length < 20) {
      toast.error("Override Reason Incomplete", {
        description: "Clinical safety governance requires a minimum of 20 characters.",
      });
      return;
    }

    const timestamp = new Date().toISOString();

    // SHA-256 Audit Trail Entry
    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: "CEILING_CLINICAL_OVERRIDE",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        patientName: patient.name,
        previousCeilingDose: 300,
        overrideDose,
        reason: overrideReason.trim(),
        patientRiskProfile: {
          age: ageInput,
          bmi: bmiInput,
          amh: baselineAmh,
          afc: afcInput,
          poseidon: poseidonGroup,
        },
        at: timestamp,
      },
    });

    setCeilingOverridden(true);
    setActiveOverride({
      dose: overrideDose,
      reason: overrideReason.trim(),
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setAssessmentValue("startingDose", overrideDose);

    const updatedPatient: PatientRecord = {
      ...patient,
      updatedAt: timestamp,
      values: {
        ...patient.values,
        ["startingDose"]: overrideDose,
        ["ceilingOverridden"]: "true",
        ["overrideReason"]: overrideReason.trim(),
      },
    };
    savePatient(updatedPatient);

    setOverrideModalOpen(false);
    toast.warning("Safety Ceiling Overridden", {
      description: `Starting dose increased to ${overrideDose} IU/day. Override rationale cryptographically logged in audit chain.`,
    });
  };

  // Action 6: [Lock]
  const handleLockScreen = () => {
    lockSession("manual_lock");
    toast.info("Session Locked", {
      description: "Clinical workstation locked by clinician. Enter PIN to resume.",
    });
  };

  // Reset inputs to patient baseline
  const handleResetInputs = () => {
    setAgeInput(baselineAge);
    setBmiInput(baselineBmi);
    setFshInput(baselineFsh);
    setAfcInput(baselineAfc);
    toast.info("Parameters reset to baseline laboratory values.");
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          {/* Button: [Back] */}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5"
            aria-label="Back to Protocol Selection"
          >
            <Link to="/patients/$id/protocol" params={{ id: patient.id }}>
              <ArrowLeft className="size-4" />
              <span>Back to Protocol</span>
            </Link>
          </Button>

          <div className="h-4 w-px bg-border/60" />

          <div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-2xs font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20"
              >
                Stage 4: Starting Dose Engine
              </Badge>
              {ceilingOverridden && (
                <Badge
                  variant="outline"
                  className="text-2xs font-semibold bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                >
                  Ceiling Overridden ({activeOverride?.dose} IU)
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-0.5">
              CONSORT Nomogram Starting Dose
            </h1>
          </div>
        </div>

        {/* Action Button Cluster */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Button: [Compute Dose] Top Bar Quick Action */}
          <Button
            type="button"
            size="sm"
            onClick={handleComputeDose}
            className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            aria-label="Compute Starting Dose"
          >
            <Calculator className="size-3.5" />
            <span>Compute Dose</span>
          </Button>

          {/* Button: [Next >] */}
          <Button
            asChild
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            aria-label="Proceed to Monitoring"
          >
            <Link to="/patients/$id/monitoring" params={{ id: patient.id }}>
              <span>Next: Monitoring</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>

          {/* Button: [Lock] */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLockScreen}
            className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 gap-1.5"
            aria-label="Lock Clinical Session"
          >
            <Lock className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Lock</span>
          </Button>
        </div>
      </div>

      {/* Patient Stratification Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 p-3 rounded-lg border border-border/70 bg-card/60 backdrop-blur-xs text-xs">
        <div>
          <span className="text-muted-foreground text-2xs block">Patient</span>
          <span className="font-semibold text-foreground truncate block">{patient.name}</span>
          <span className="text-2xs text-muted-foreground font-mono">{patient.fileNumber}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Age / BMI</span>
          <span className="font-semibold text-foreground">{ageInput} yrs</span>
          <span className="text-2xs text-muted-foreground block">{bmiInput} kg/m²</span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Basal FSH / AMH</span>
          <span className="font-semibold text-foreground">{fshInput} IU/L</span>
          <span className="text-2xs text-muted-foreground block">AMH {baselineAmh} ng/mL</span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Antral Follicles</span>
          <span className="font-semibold text-foreground">{afcInput} follicles</span>
          <span className="text-2xs text-muted-foreground block">
            Score: {compositeScore}/12 pts
          </span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Response Profile</span>
          <Badge
            variant={isPoorResponder ? "destructive" : "secondary"}
            className="text-2xs font-semibold mt-0.5"
          >
            {isPoorResponder ? "Poor Responder (POR)" : "Normal / High Reserve"}
          </Badge>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Assigned Dose</span>
          <span className="font-bold text-sm text-primary block">{effectiveDose} IU/day</span>
          <span className="text-2xs text-muted-foreground">r-hFSH (follitropin alfa)</span>
        </div>
      </div>

      {/* HARD SAFETY CEILING RED BANNER for Poor Responders */}
      {isPoorResponder && (
        <div className="rounded-xl border-2 border-red-600 bg-red-500/10 dark:bg-red-950/40 p-4 text-red-900 dark:text-red-100 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertOctagon className="size-6 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm uppercase tracking-wide text-red-700 dark:text-red-400">
                    Clinical Safety Firewall: ESHRE 2025 Hard Ceiling Enforced (300 IU/day)
                  </span>
                  <Badge className="bg-red-600 text-white font-bold text-2xs">
                    Poor Responder Protocol
                  </Badge>
                </div>
                <p className="text-xs text-red-800/90 dark:text-red-200/90 leading-relaxed max-w-4xl">
                  <strong>ESHRE 2025 Recommendation 20 (Hum Reprod. 2026;41(4):498-514):</strong> A
                  gonadotropin starting dose higher than <strong>300 IU/day</strong> is NOT
                  recommended for predicted low responders. Multiple multicenter randomized
                  controlled trials confirm that starting doses exceeding 300 IU do not improve
                  follicle recruitment, oocyte yield, mature MII oocytes, or live birth rates, but
                  substantially increase financial and physiological burden.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {/* Button: [Apply Ceiling] */}
              <Button
                type="button"
                size="sm"
                onClick={handleApplyCeiling}
                className="h-8 text-xs font-semibold gap-1.5 bg-red-600 text-white hover:bg-red-700 shadow-xs"
                aria-label="Apply ESHRE 2025 300 IU Hard Ceiling"
              >
                <ShieldCheck className="size-3.5" />
                <span>Apply Ceiling</span>
              </Button>

              {/* Button: [Override Ceiling (audit-logged)] */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOverrideModalOpen(true)}
                className="h-8 text-xs font-semibold gap-1.5 bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20 border-red-500/40"
                aria-label="Override 300 IU Safety Ceiling"
              >
                <AlertOctagon className="size-3.5" />
                <span>Override Ceiling (audit-logged)</span>
              </Button>
            </div>
          </div>

          {ceilingOverridden && activeOverride && (
            <div className="rounded-lg bg-red-600/20 border border-red-600/40 p-2.5 text-xs text-red-900 dark:text-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-red-600 shrink-0" />
                <span>
                  <strong>Active Clinician Override:</strong> Dosing set to{" "}
                  <strong>{activeOverride.dose} IU/day</strong> ({activeOverride.reason}). Logged at{" "}
                  {activeOverride.at}.
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleApplyCeiling}
                className="h-6 text-2xs text-red-700 dark:text-red-300 hover:bg-red-500/20 underline"
              >
                Revert to 300 IU Ceiling
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: CONSORT Nomogram Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  CONSORT Baseline Nomogram Parameters
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetInputs}
                className="h-6 px-2 text-2xs text-muted-foreground hover:text-foreground gap-1"
                title="Reset to patient record laboratory values"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </Button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Parameter 1: Age */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-foreground">Age (years)</label>
                  <span className="text-2xs font-mono text-primary font-bold">
                    {agePoints} point{agePoints !== 1 ? "s" : ""} (
                    {ageInput < 30
                      ? "<30"
                      : ageInput < 35
                        ? "30–34"
                        : ageInput < 40
                          ? "35–39"
                          : "≥40"}
                    )
                  </span>
                </div>
                <Input
                  type="number"
                  min={18}
                  max={55}
                  value={ageInput}
                  onChange={(e) => {
                    setAgeInput(Number(e.target.value));
                    setIsModified(true);
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Parameter 2: BMI */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-foreground">Body Mass Index (kg/m²)</label>
                  <span className="text-2xs font-mono text-primary font-bold">
                    {bmiPoints} point{bmiPoints !== 1 ? "s" : ""} (
                    {bmiInput < 20
                      ? "<20"
                      : bmiInput < 25
                        ? "20–24.9"
                        : bmiInput < 30
                          ? "25–29.9"
                          : "≥30"}
                    )
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min={14}
                  max={60}
                  value={bmiInput}
                  onChange={(e) => {
                    setBmiInput(Number(e.target.value));
                    setIsModified(true);
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Parameter 3: Basal FSH */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-foreground">Basal Serum FSH (IU/L)</label>
                  <span className="text-2xs font-mono text-primary font-bold">
                    {fshPoints} point{fshPoints !== 1 ? "s" : ""} (
                    {fshInput < 6.0
                      ? "<6.0"
                      : fshInput < 9.0
                        ? "6.0–8.9"
                        : fshInput < 12.0
                          ? "9.0–11.9"
                          : "≥12.0"}
                    )
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min={0.1}
                  max={40}
                  value={fshInput}
                  onChange={(e) => {
                    setFshInput(Number(e.target.value));
                    setIsModified(true);
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Parameter 4: Antral Follicle Count */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-foreground">
                    Antral Follicle Count (total)
                  </label>
                  <span className="text-2xs font-mono text-primary font-bold">
                    {afcPoints} point{afcPoints !== 1 ? "s" : ""} (
                    {afcInput >= 16
                      ? "≥16"
                      : afcInput >= 10
                        ? "10–15"
                        : afcInput >= 5
                          ? "5–9"
                          : "<5"}
                    )
                  </span>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={afcInput}
                  onChange={(e) => {
                    setAfcInput(Number(e.target.value));
                    setIsModified(true);
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Score Sum Box */}
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between text-xs mt-3">
              <div>
                <span className="font-bold text-foreground block">Composite Nomogram Score</span>
                <span className="text-2xs text-muted-foreground">
                  Sum of 4 validated parameters
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-primary font-mono">
                  {compositeScore}
                </span>
                <span className="text-2xs text-muted-foreground block">/ 12 points</span>
              </div>
            </div>

            {/* Button: [Compute Dose] In-card Button */}
            <Button
              type="button"
              onClick={handleComputeDose}
              className="w-full text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              aria-label="Compute Starting Dose"
            >
              <Calculator className="size-3.5" />
              <span>Compute Dose</span>
            </Button>
          </div>
        </div>

        {/* Right Column: Recharts Nomogram & Starting Dose Output Card (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Starting Dose Output Card */}
          <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Individualized Starting Dose Recommendation
                </h3>
              </div>
              <Badge variant="outline" className="text-2xs font-mono">
                {isPoorResponder ? "Poor Responders Band" : "Individualized Band"}
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/40 border border-border/60">
              <div className="space-y-1">
                <span className="text-2xs uppercase tracking-wider text-muted-foreground block font-semibold">
                  Starting Recombinant FSH Daily Dose
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-primary font-mono tracking-tight">
                    {effectiveDose}
                  </span>
                  <span className="text-sm font-bold text-foreground">IU / day</span>
                </div>
                <span className="text-xs text-muted-foreground block">
                  Medication: <strong>Recombinant FSH (follitropin alfa)</strong>
                </span>
              </div>

              <div className="text-left sm:text-right space-y-1 text-xs">
                <span className="text-muted-foreground block text-2xs">Delivery Schedule:</span>
                <span className="font-semibold text-foreground block">
                  Day 2–3 Menstrual Initiation
                </span>
                <span className="text-2xs text-muted-foreground block">
                  Pen increment step: 37.5 IU
                </span>
                {ceilingOverridden && (
                  <Badge
                    variant="outline"
                    className="text-2xs font-bold text-red-600 border-red-500/40 bg-red-500/10"
                  >
                    Clinician Override
                  </Badge>
                )}
              </div>
            </div>

            {/* Recharts Nomogram Dose Progression Graph */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="size-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    CONSORT Dose Response Nomogram Curve
                  </span>
                </div>
                <div className="flex items-center gap-3 text-2xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-primary inline-block" /> Patient
                    Position
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-red-600 inline-block" /> 300 IU Ceiling
                  </span>
                </div>
              </div>

              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={NOMOGRAM_STEPS}
                    margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="score"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      label={{
                        value: "Composite Score",
                        position: "insideBottom",
                        offset: -2,
                        fontSize: 10,
                      }}
                    />
                    <YAxis
                      domain={[75, 375]}
                      ticks={[112.5, 150, 187.5, 225, 262.5, 300]}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      label={{
                        value: "Dose (IU)",
                        angle: -90,
                        position: "insideLeft",
                        offset: 15,
                        fontSize: 10,
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        const firstItem = payload?.[0];
                        if (active && firstItem?.payload) {
                          const data = firstItem.payload as NomogramPoint;
                          return (
                            <div className="rounded-lg border border-border bg-popover p-2 text-2xs shadow-md text-popover-foreground">
                              <p className="font-bold">CONSORT Score {data.score} / 12</p>
                              <p className="text-primary font-mono font-semibold">
                                Starting Dose: {data.dose} IU/day
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={300}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="4 4"
                      label={{
                        value: "ESHRE 2025 Hard Ceiling (300 IU)",
                        position: "top",
                        fill: "hsl(var(--destructive))",
                        fontSize: 10,
                      }}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="dose"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "hsl(var(--primary))" }}
                    />
                    <ReferenceDot
                      x={compositeScore}
                      y={effectiveDose}
                      r={6}
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Override Ceiling Modal Dialog */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
              <AlertOctagon className="size-5 shrink-0" />
              <span>Override 300 IU Clinical Safety Ceiling</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Exceeding the ESHRE 2025 low-responder 300 IU/day ceiling is considered an exceptional
              clinical deviation. A mandatory justification (minimum 20 characters) and physician
              authorization are required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">
                Target Starting Dose (IU/day)
              </label>
              <select
                value={overrideDose}
                onChange={(e) => setOverrideDose(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value={337.5}>337.5 IU/day</option>
                <option value={375}>375 IU/day</option>
                <option value={412.5}>412.5 IU/day</option>
                <option value={450}>450 IU/day</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground">
                  Clinical Justification (Mandatory min 20 chars)
                </label>
                <span
                  className={cn(
                    "text-2xs font-mono",
                    overrideReason.trim().length >= 20
                      ? "text-emerald-600 font-bold"
                      : "text-red-600",
                  )}
                >
                  {overrideReason.trim().length} / 20 chars
                </span>
              </div>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Specify clinical indication for exceeding 300 IU ceiling (e.g. severe Class III obesity with BMI > 40, documented FSH receptor polymorphism, previous cycle arrest at 300 IU)..."
                rows={4}
                className="text-xs resize-none"
              />
            </div>

            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-2xs text-red-800 dark:text-red-200">
              <span className="font-semibold block">Regulatory & Audit Warning:</span>
              This override will be cryptographically hashed (SHA-256) into the local audit trail
              with your timestamp and credentials (Dr. Raouf Roshdy).
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOverrideModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmCeilingOverride}
              disabled={overrideReason.trim().length < 20}
              className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              <Check className="size-3.5" />
              <span>Confirm & Log Override</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
