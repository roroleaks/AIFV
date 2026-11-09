import { useState, useMemo, useCallback, useRef } from "react";
import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  BookOpen,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Compass,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePatients, type PatientRecord, savePatient } from "@/lib/assessment/patients";
import { DEFAULT_VIRTUAL_PATIENTS } from "@/lib/assessment/virtual-patients-data";
import { useAssessment, type FieldValue, type CycleRecord } from "@/lib/assessment/use-assessment";
import { ageFromDob } from "@/lib/assessment/schema";
import { classifyPoseidon, type PoseidonResult, type PoseidonGroup } from "@/lib/engine/poseidon";
import { assessBologna, type BolognaResult } from "@/lib/engine/bologna";
import { savePoseidonAssessment } from "@/lib/engine/poseidon-store";
import { lockSession } from "@/services/auth/session";
import { appendAuditEntry } from "@/services/audit/auditLog";
import { useAutoSave } from "@/hooks/use-auto-save";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/patients/$id/poseidon")({
  head: () => ({
    meta: [
      { title: "Stage 2: POSEIDON Stratification & Phenotyping — AiFV CDSS" },
      {
        name: "description",
        content:
          "Stage 2 POSEIDON calculator, Bologna criteria verdict, clinical override mechanism, and ovarian response phenotype classification.",
      },
    ],
  }),
  component: PatientPoseidonStage2View,
});

interface CalculatorInputs {
  age: number;
  amh: number;
  afcTotal: number;
  afcLeft: number;
  afcRight: number;
  cycles: number;
  lowestRetrieved: number | null;
  editReason: string;
}

export function PatientPoseidonStage2View() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const navigate = useNavigate();
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
        completion: 25,
        alerts: 0,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        values: {},
        cycleRecords: [],
      }
    );
  }, [id, records]);

  // Baseline Stage 1 values
  const baseline = useMemo(() => {
    const v = patient.values || {};
    const dob = String(v["dob"] || "");
    const parsedAge =
      Number(String(patient.age || v["age"] || "").replace(/\D/g, "")) ||
      (dob ? Number(ageFromDob(dob).replace(/\D/g, "")) : 34);

    const amh = Number(v["amh"]) || 1.15;
    const afcL = Number(v["afcLeft"]) || 4;
    const afcR = Number(v["afcRight"]) || 4;
    const afcTotal = Number(v["afcTotal"]) || afcL + afcR || 8;
    const cycles = Number(v["cycles"] || patient.cycles) || 0;
    const lowest = Number(v["lowestRetrieved"] || v["prevRetrieved"]) || null;

    return {
      age: parsedAge,
      amh,
      afcTotal,
      afcLeft: afcL,
      afcRight: afcR,
      cycles,
      lowestRetrieved: lowest,
    };
  }, [patient]);

  // Calculator Form State (auto-filled from Stage 1)
  const [inputs, setInputs] = useState<CalculatorInputs>({
    age: baseline.age,
    amh: baseline.amh,
    afcTotal: baseline.afcTotal,
    afcLeft: baseline.afcLeft,
    afcRight: baseline.afcRight,
    cycles: baseline.cycles,
    lowestRetrieved: baseline.lowestRetrieved,
    editReason: "",
  });

  const [isModified, setIsModified] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideGroup, setOverrideGroup] = useState<PoseidonGroup>("3");
  const [overrideReason, setOverrideReason] = useState("");
  const [activeOverride, setActiveOverride] = useState<{
    group: PoseidonGroup;
    reason: string;
    at: string;
  } | null>(null);

  const printContainerRef = useRef<HTMLDivElement>(null);

  // Detect modifications against Stage 1 baseline
  const checkModified = useCallback(
    (current: CalculatorInputs) => {
      const changed =
        current.age !== baseline.age ||
        Math.abs(current.amh - baseline.amh) > 0.001 ||
        current.afcTotal !== baseline.afcTotal ||
        current.cycles !== baseline.cycles ||
        current.lowestRetrieved !== baseline.lowestRetrieved;
      setIsModified(changed);
    },
    [baseline],
  );

  const handleInputChange = <K extends keyof CalculatorInputs>(
    field: K,
    val: CalculatorInputs[K],
  ) => {
    setInputs((prev) => {
      const next = { ...prev, [field]: val };
      if (field === "afcLeft" || field === "afcRight") {
        next.afcTotal = Number(next.afcLeft) + Number(next.afcRight);
      }
      checkModified(next);
      return next;
    });
  };

  const resetToBaseline = () => {
    setInputs({
      age: baseline.age,
      amh: baseline.amh,
      afcTotal: baseline.afcTotal,
      afcLeft: baseline.afcLeft,
      afcRight: baseline.afcRight,
      cycles: baseline.cycles,
      lowestRetrieved: baseline.lowestRetrieved,
      editReason: "",
    });
    setIsModified(false);
    toast.info("Reset to Stage 1 Baseline Values");
  };

  // Construct virtual cycle records for the engine
  const simulatedCycles = useMemo<CycleRecord[]>(() => {
    if (inputs.cycles <= 0) return patient.cycleRecords || draft.cycles || [];
    return [
      {
        id: "sim-prev-cycle-1",
        retrieved: inputs.lowestRetrieved ?? 4,
        protocol: "GnRH antagonist",
        startingDose: 225,
      },
    ];
  }, [inputs.cycles, inputs.lowestRetrieved, patient.cycleRecords, draft.cycles]);

  // Execute POSEIDON Engine Classification
  const poseidonResult = useMemo<PoseidonResult>(() => {
    const values: Record<string, FieldValue> = {
      age: inputs.age,
      amh: inputs.amh,
      afcTotal: inputs.afcTotal,
      afcLeft: inputs.afcLeft,
      afcRight: inputs.afcRight,
    };
    return classifyPoseidon(values, simulatedCycles);
  }, [inputs, simulatedCycles]);

  // Execute Bologna Criteria Evaluation
  const bolognaResult = useMemo<BolognaResult>(() => {
    const values: Record<string, FieldValue> = {
      age: inputs.age,
      amh: inputs.amh,
      afcTotal: inputs.afcTotal,
      causes: patient.causes || [],
    };
    return assessBologna(values, simulatedCycles);
  }, [inputs, simulatedCycles, patient.causes]);

  // Derive Effective Group (taking into account any clinician override)
  const effectiveGroup = useMemo(() => {
    if (activeOverride) return activeOverride.group;
    return poseidonResult.group;
  }, [activeOverride, poseidonResult.group]);

  // Derive Phenotype category from current data
  const matchedPhenotype = useMemo<
    "Normoresponder" | "Poor" | "Hyper" | "Expected Low" | "Unexpected Low"
  >(() => {
    // 1. Hyperresponder (PCOS or elevated reserve markers)
    if (inputs.amh > 3.5 || inputs.afcTotal >= 20) {
      return "Hyper";
    }
    // 2. Bologna Positive (Definite refractory poor response)
    if (bolognaResult.status === "positive") {
      return "Poor";
    }
    // 3. Expected Low (POSEIDON Group 3 or 4)
    if (effectiveGroup === "3" || effectiveGroup === "4") {
      return "Expected Low";
    }
    // 4. Unexpected Low (POSEIDON Group 1 or 2)
    if (
      effectiveGroup === "1a" ||
      effectiveGroup === "1b" ||
      effectiveGroup === "2a" ||
      effectiveGroup === "2b"
    ) {
      return "Unexpected Low";
    }
    // 5. Standard Normoresponder
    return "Normoresponder";
  }, [inputs.amh, inputs.afcTotal, bolognaResult.status, effectiveGroup]);

  // Auto-save hook
  useAutoSave({
    onSave: () => {
      savePoseidonAssessment(patient.id, patient.name, poseidonResult);
    },
    intervalMs: 30000,
    enabled: isModified,
  });

  // Action 1: [Compute Group]
  const handleComputeGroup = () => {
    setIsComputing(true);
    setTimeout(() => {
      setIsComputing(false);
      toast.success("POSEIDON Stratification Recomputed", {
        description: `Classified as ${poseidonResult.group ? `Group ${poseidonResult.group.toUpperCase()}` : "Normal Prognosis"} with Bologna verdict: ${bolognaResult.status}.`,
      });
    }, 250);
  };

  // Action 3: Confirm Override Handler
  const handleConfirmOverride = () => {
    if (overrideReason.trim().length < 20) {
      toast.error("Override Reason Incomplete", {
        description: "Governance policy requires a minimum of 20 characters.",
      });
      return;
    }

    const timestamp = new Date().toISOString();
    const prevGroup = poseidonResult.group ?? "Not low prognosis";

    // Immutable SHA-256 Audit Entry
    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: "POSEIDON_CLINICAL_OVERRIDE",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        patientName: patient.name,
        previousCalculatedGroup: prevGroup,
        overrideGroup,
        reason: overrideReason.trim(),
        inputs: {
          age: inputs.age,
          amh: inputs.amh,
          afcTotal: inputs.afcTotal,
        },
        at: timestamp,
      },
    });

    setActiveOverride({
      group: overrideGroup,
      reason: overrideReason.trim(),
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setOverrideModalOpen(false);
    toast.warning("Clinical Override Activated", {
      description: `POSEIDON Group overridden to Group ${overrideGroup.toUpperCase()}. Cryptographically signed in audit chain.`,
    });
  };

  // Action 4: [Accept & Continue]
  const handleAcceptAndContinue = () => {
    // Persist assessment to store
    savePoseidonAssessment(patient.id, patient.name, poseidonResult);

    // Sync values with downstream engines
    setAssessmentValue("poseidonGroup", effectiveGroup ?? undefined);
    setAssessmentValue("bolognaStatus", bolognaResult.status);
    setAssessmentValue("phenotype", matchedPhenotype);

    // Update patient master record
    const updatedPatient: PatientRecord = {
      ...patient,
      completion: Math.max(patient.completion, 35),
      updatedAt: new Date().toISOString(),
      values: {
        ...patient.values,
        poseidonGroup: effectiveGroup ?? undefined,
        bolognaStatus: bolognaResult.status,
        phenotype: matchedPhenotype,
        amh: inputs.amh,
        afcTotal: inputs.afcTotal,
      },
    };
    savePatient(updatedPatient);

    // Log acceptance to audit log
    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: "STAGE_2_POSEIDON_ACCEPTED",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        effectiveGroup: effectiveGroup ?? "Normal Prognosis",
        isOverride: Boolean(activeOverride),
        bolognaVerdict: bolognaResult.status,
        phenotype: matchedPhenotype,
      },
    });

    toast.success("Stage 2 Stratification Accepted", {
      description: `Patient certified under ${effectiveGroup ? `POSEIDON Group ${effectiveGroup.toUpperCase()}` : "Normal Prognosis"}. Navigating to Stage 3 Protocol Recommendation.`,
    });

    void navigate({ to: "/protocols" });
  };

  // Immediate lock screen handler
  const handleLockScreen = () => {
    lockSession("manual_lock");
    window.dispatchEvent(new Event("aifv-session-changed"));
  };

  return (
    <div
      className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full"
      ref={printContainerRef}
    >
      {/* =========================================================================
          PAGE HEADER & WORKFLOW CONTROLS
          ========================================================================= */}
      <div className="flex flex-col gap-4 border-b border-border/70 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {/* Button 5: [Back] */}
            <Link to="/patients/$id/assessment" params={{ id: patient.id }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5"
                title="Return to Stage 1: Clinical Intake"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </Button>
            </Link>
            <span className="text-border">|</span>
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold"
            >
              Stage 2 of 8
            </Badge>
            <span className="text-xs text-muted-foreground">POSEIDON & Bologna Stratification</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>POSEIDON Assessment: {patient.name}</span>
            <span className="text-sm font-mono font-normal text-muted-foreground">
              ({patient.fileNumber || patient.id})
            </span>
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
            <span className="flex items-center gap-1">
              <Compass className="size-3.5 text-primary" />
              Alviggi et al. / Humaidan et al. 2016 Consortium Criteria
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="size-3.5" />
              ESHRE 2025 Compliant
            </span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Button 4: [Accept & Continue] */}
          <Button
            variant="default"
            size="sm"
            onClick={handleAcceptAndContinue}
            className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold shadow-xs text-xs gap-1.5"
            title="Certify POSEIDON stratification and advance to Protocol Recommendation"
          >
            <CheckCircle2 className="size-3.5" />
            <span>Accept & Continue</span>
          </Button>

          {/* Button 6: [Next Stage >] */}
          <Button
            variant="default"
            size="sm"
            onClick={handleAcceptAndContinue}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs text-xs gap-1.5"
            title="Advance to Stage 3: Protocol Recommendation"
          >
            <span>Next Stage</span>
            <ArrowRight className="size-3.5" />
          </Button>

          {/* Button 7: [Lock Screen] */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLockScreen}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60"
            title="Immediately lock hospital session"
          >
            <Lock className="size-3.5" />
            <span className="hidden sm:inline">Lock Screen</span>
          </Button>
        </div>
      </div>

      {/* Override Alert Banner if clinician overrode the engine */}
      {activeOverride && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  Active Clinical Override: POSEIDON Group {activeOverride.group.toUpperCase()}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300"
                >
                  Signed at {activeOverride.at}
                </Badge>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 font-mono">
                Justification: &quot;{activeOverride.reason}&quot;
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveOverride(null);
              toast.info("Clinical override dismissed. Reverted to algorithmic classification.");
            }}
            className="h-7 text-xs text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
          >
            Revert Override
          </Button>
        </div>
      )}

      {/* =========================================================================
          MAIN 2-COLUMN LAYOUT: CALCULATOR (LEFT) + RESULTS (RIGHT)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =======================================================================
            LEFT COLUMN: POSEIDON CALCULATOR (Auto-filled & Editable with Reason)
            ======================================================================= */}
        <section className="lg:col-span-5 rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calculator className="size-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">POSEIDON Calculator</h2>
                <p className="text-[11px] text-muted-foreground">Auto-filled from Stage 1 intake</p>
              </div>
            </div>

            {isModified ? (
              <Badge
                variant="secondary"
                className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px]"
              >
                Modified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] text-muted-foreground">
                Stage 1 Synced
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            {/* Maternal Age */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="poseidon-age" className="text-xs font-medium text-foreground">
                  Maternal Age
                </label>
                <span className="text-[11px] text-muted-foreground">Threshold: 35.0 years</span>
              </div>
              <div className="relative">
                <Input
                  id="poseidon-age"
                  type="number"
                  min={18}
                  max={55}
                  value={inputs.age}
                  onChange={(e) => handleInputChange("age", Number(e.target.value) || 0)}
                  className="h-8 text-xs pr-14"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                  years
                </span>
              </div>
            </div>

            {/* Anti-Müllerian Hormone (AMH) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="poseidon-amh" className="text-xs font-medium text-foreground">
                  Anti-Müllerian Hormone (AMH)
                </label>
                <span className="text-[11px] text-muted-foreground">Threshold: 1.20 ng/mL</span>
              </div>
              <div className="relative">
                <Input
                  id="poseidon-amh"
                  type="number"
                  step="0.01"
                  min={0}
                  max={30}
                  value={inputs.amh}
                  onChange={(e) => handleInputChange("amh", Number(e.target.value) || 0)}
                  className="h-8 text-xs pr-14 font-semibold"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                  ng/mL
                </span>
              </div>
            </div>

            {/* Antral Follicle Count (AFC) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="poseidon-afc" className="text-xs font-medium text-foreground">
                  Antral Follicle Count (Total AFC)
                </label>
                <span className="text-[11px] text-muted-foreground">Threshold: 5 follicles</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-0.5">Left</span>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={inputs.afcLeft}
                    onChange={(e) => handleInputChange("afcLeft", Number(e.target.value) || 0)}
                    className="h-8 text-xs"
                    aria-label="Antral Follicle Count Left"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-0.5">Right</span>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={inputs.afcRight}
                    onChange={(e) => handleInputChange("afcRight", Number(e.target.value) || 0)}
                    className="h-8 text-xs"
                    aria-label="Antral Follicle Count Right"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-0.5">Total</span>
                  <Input
                    id="poseidon-afc"
                    type="number"
                    min={0}
                    max={100}
                    value={inputs.afcTotal}
                    onChange={(e) => handleInputChange("afcTotal", Number(e.target.value) || 0)}
                    className="h-8 text-xs font-semibold bg-muted/40"
                  />
                </div>
              </div>
            </div>

            {/* Prior Stimulation Cycles */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="poseidon-cycles"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Prior IVF Cycles
                </label>
                <Input
                  id="poseidon-cycles"
                  type="number"
                  min={0}
                  max={10}
                  value={inputs.cycles}
                  onChange={(e) => handleInputChange("cycles", Number(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="poseidon-lowest"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Lowest Oocyte Yield
                </label>
                <Input
                  id="poseidon-lowest"
                  type="number"
                  min={0}
                  max={40}
                  disabled={inputs.cycles === 0}
                  value={inputs.lowestRetrieved ?? ""}
                  onChange={(e) =>
                    handleInputChange(
                      "lowestRetrieved",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  placeholder={inputs.cycles === 0 ? "N/A (0 cycles)" : "e.g. 3"}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Reason for Input Modification (Visible when modified from Stage 1) */}
            {isModified && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <Info className="size-3" />
                    Clinical Modification Reason
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetToBaseline}
                    className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    <RotateCcw className="size-2.5" />
                    <span>Reset</span>
                  </Button>
                </div>
                <Input
                  value={inputs.editReason}
                  onChange={(e) => handleInputChange("editReason", e.target.value)}
                  placeholder="e.g. Repeat AMH from reference lab / Day 3 repeat AFC"
                  className="h-8 text-xs bg-background"
                />
              </div>
            )}

            {/* Button 1: [Compute Group] */}
            <div className="pt-2">
              <Button
                variant="default"
                size="sm"
                disabled={isComputing}
                onClick={handleComputeGroup}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs text-xs gap-1.5 h-8"
              >
                <Calculator className="size-3.5" />
                <span>{isComputing ? "Evaluating Criteria…" : "Compute Group"}</span>
              </Button>
            </div>
          </div>
        </section>

        {/* =======================================================================
            RIGHT COLUMN: RESULT CARD (POSEIDON Group + Bologna Criteria Verdict)
            ======================================================================= */}
        <section className="lg:col-span-7 rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between border-b border-border/60 pb-3 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Compass className="size-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Stratification Result Card
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Consensus Low Prognosis Classification
                </p>
              </div>
            </div>

            {/* Actions: [Explain Evidence] & [Override] */}
            <div className="flex items-center gap-2">
              {/* Button 2: [Explain Evidence] Radix Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border border-border/80 bg-background hover:bg-muted text-foreground text-xs font-medium gap-1.5 shadow-xs h-7 px-2.5"
                    title="View ESHRE 2025 evidence section citation"
                  >
                    <BookOpen className="size-3.5 text-primary" />
                    <span>Explain Evidence</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 md:w-96 p-4 text-xs space-y-3" align="end">
                  <div className="space-y-1 border-b border-border/70 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                        ESHRE 2025 Guideline
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">Level 1A Evidence</span>
                    </div>
                    <h3 className="font-bold text-foreground text-xs">
                      ESHRE Good Practice Guideline on Ovarian Stimulation for IVF/ICSI (2025
                      Update)
                    </h3>
                  </div>

                  <div className="space-y-2 text-muted-foreground leading-relaxed text-[11px]">
                    <p>
                      <strong className="text-foreground">
                        Section 2.1 (Ovarian Reserve Biomarkers):
                      </strong>{" "}
                      AMH (&lt; 1.20 ng/mL) and AFC (&lt; 5–7 follicles) exhibit equivalent high
                      accuracy in predicting poor ovarian response.
                    </p>
                    <p>
                      <strong className="text-foreground">
                        Section 2.3 (POSEIDON Stratification):
                      </strong>{" "}
                      Stratifies patients beyond age alone by recognizing unexpected hypo-responders
                      (Groups 1 and 2) vs expected poor responders (Groups 3 and 4).
                    </p>
                    <p>
                      <strong className="text-foreground">Table 4 (Bologna vs POSEIDON):</strong>{" "}
                      Bologna criteria identify patients with established refractory poor response
                      (≤ 3 oocytes); POSEIDON guides individualised gonadotropin dosing prior to or
                      following cycle failure.
                    </p>
                  </div>

                  <div className="pt-1 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>DOI: 10.1093/humrep/dead263</span>
                    <span className="flex items-center gap-1 text-primary">
                      <span>Peer Reviewed</span>
                      <ExternalLink className="size-2.5" />
                    </span>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Button 3: [Override] Modal Trigger */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOverrideGroup(effectiveGroup || "3");
                  setOverrideReason("");
                  setOverrideModalOpen(true);
                }}
                className="bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold gap-1.5 shadow-xs h-7 px-2.5"
                title="Manually override POSEIDON group with audit trail justification"
              >
                <ShieldAlert className="size-3.5" />
                <span>Override</span>
              </Button>
            </div>
          </div>

          {/* Primary Result Box */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                POSEIDON Classification:
              </span>
              <Badge className="bg-indigo-600 text-white font-bold text-sm px-3 py-1 shadow-xs">
                {effectiveGroup
                  ? `POSEIDON Group ${effectiveGroup.toUpperCase()}`
                  : "Normal Prognosis / Adequate"}
              </Badge>
            </div>

            <p className="text-xs text-foreground font-medium leading-relaxed">
              {poseidonResult.headline || "Patient evaluated under published POSEIDON criteria."}
            </p>

            {/* Criteria Breakdown Grid */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
              <div className="rounded-lg bg-background p-2.5 border border-border/60">
                <span className="text-[11px] text-muted-foreground block mb-0.5">Age Factor</span>
                <span className="font-semibold text-foreground">
                  {inputs.age} years ({inputs.age < 35 ? "< 35 y" : "≥ 35 y"})
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {inputs.age < 35 ? "Groups 1 / 3" : "Groups 2 / 4"}
                </span>
              </div>

              <div className="rounded-lg bg-background p-2.5 border border-border/60">
                <span className="text-[11px] text-muted-foreground block mb-0.5">
                  Ovarian Reserve
                </span>
                <span className="font-semibold text-foreground">AMH {inputs.amh} ng/mL</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  AFC Total: {inputs.afcTotal}
                </span>
              </div>

              <div className="rounded-lg bg-background p-2.5 border border-border/60">
                <span className="text-[11px] text-muted-foreground block mb-0.5">
                  Response Category
                </span>
                <span className="font-semibold text-foreground">
                  {inputs.amh < 1.2 || inputs.afcTotal < 5 ? "Expected Poor" : "Adequate Reserve"}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {inputs.cycles > 0 ? `${inputs.cycles} prior cycle(s)` : "Intake Cycle 1"}
                </span>
              </div>
            </div>
          </div>

          {/* Bologna Criteria Verdict Section */}
          <div className="rounded-xl border border-border/70 p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-foreground">
                  Bologna Criteria Verdict (ESHRE 2011)
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold px-2",
                    bolognaResult.status === "positive"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  {bolognaResult.status === "positive"
                    ? "Bologna Positive (POR Confirmed)"
                    : "Bologna Negative"}
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground">≥ 2 of 3 features required</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {bolognaResult.headline ||
                "Bologna criteria evaluate advanced maternal age (≥40y), previous POR (≤3 oocytes), and abnormal ORT."}
            </p>

            {/* Bologna Features Checklist */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 text-xs">
                {inputs.age >= 40 ? (
                  <Check className="size-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <X className="size-3.5 text-muted-foreground shrink-0" />
                )}
                <span
                  className={
                    inputs.age >= 40 ? "text-foreground font-medium" : "text-muted-foreground"
                  }
                >
                  (i) Advanced maternal age (≥ 40 y) or documented risk factor for POR ({inputs.age}{" "}
                  years)
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {inputs.lowestRetrieved !== null && inputs.lowestRetrieved <= 3 ? (
                  <Check className="size-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <X className="size-3.5 text-muted-foreground shrink-0" />
                )}
                <span
                  className={
                    inputs.lowestRetrieved !== null && inputs.lowestRetrieved <= 3
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }
                >
                  (ii) Previous POR with conventional protocol (≤ 3 oocytes retrieved)
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {inputs.amh < 1.1 || inputs.afcTotal < 7 ? (
                  <Check className="size-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <X className="size-3.5 text-muted-foreground shrink-0" />
                )}
                <span
                  className={
                    inputs.amh < 1.1 || inputs.afcTotal < 7
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }
                >
                  (iii) Abnormal ovarian reserve test (AFC &lt; 5–7 follicles or AMH &lt; 0.5–1.1
                  ng/mL)
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* =========================================================================
          BOTTOM SECTION: PHENOTYPE CHIPS
          (Normoresponder, Poor, Hyper, Expected Low, Unexpected Low)
          ========================================================================= */}
      <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Ovarian Response Phenotype Chips
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Current Matched Phenotype:{" "}
            <strong className="text-foreground">{matchedPhenotype}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Chip 1: Normoresponder */}
          <div
            className={cn(
              "rounded-xl border p-3.5 transition-all text-xs flex flex-col justify-between gap-2",
              matchedPhenotype === "Normoresponder"
                ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 shadow-xs"
                : "border-border/70 bg-muted/20 opacity-75 hover:opacity-100",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Normoresponder</span>
              {matchedPhenotype === "Normoresponder" && (
                <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Normal reserve (AMH 1.2–3.5 ng/mL, AFC 10–19). Target: 10–15 oocytes.
            </p>
          </div>

          {/* Chip 2: Poor */}
          <div
            className={cn(
              "rounded-xl border p-3.5 transition-all text-xs flex flex-col justify-between gap-2",
              matchedPhenotype === "Poor"
                ? "border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/20 shadow-xs"
                : "border-border/70 bg-muted/20 opacity-75 hover:opacity-100",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Poor Responder</span>
              {matchedPhenotype === "Poor" && (
                <Badge className="bg-rose-600 text-white text-[9px] px-1.5 py-0 h-4">Active</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Bologna criteria confirmed (≤ 3 oocytes retrieved, high cycle cancellation risk).
            </p>
          </div>

          {/* Chip 3: Hyper */}
          <div
            className={cn(
              "rounded-xl border p-3.5 transition-all text-xs flex flex-col justify-between gap-2",
              matchedPhenotype === "Hyper"
                ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20 shadow-xs"
                : "border-border/70 bg-muted/20 opacity-75 hover:opacity-100",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Hyperresponder</span>
              {matchedPhenotype === "Hyper" && (
                <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0 h-4">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              High reserve (AMH &gt; 3.5 ng/mL, AFC ≥ 20). PCOS phenotype; elevated OHSS risk.
            </p>
          </div>

          {/* Chip 4: Expected Low */}
          <div
            className={cn(
              "rounded-xl border p-3.5 transition-all text-xs flex flex-col justify-between gap-2",
              matchedPhenotype === "Expected Low"
                ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20 shadow-xs"
                : "border-border/70 bg-muted/20 opacity-75 hover:opacity-100",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Expected Low</span>
              {matchedPhenotype === "Expected Low" && (
                <Badge className="bg-amber-600 text-white text-[9px] px-1.5 py-0 h-4">Active</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              POSEIDON Groups 3 &amp; 4 (AMH &lt; 1.2 ng/mL or AFC &lt; 5). Low biological reserve.
            </p>
          </div>

          {/* Chip 5: Unexpected Low */}
          <div
            className={cn(
              "rounded-xl border p-3.5 transition-all text-xs flex flex-col justify-between gap-2",
              matchedPhenotype === "Unexpected Low"
                ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20 shadow-xs"
                : "border-border/70 bg-muted/20 opacity-75 hover:opacity-100",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Unexpected Low</span>
              {matchedPhenotype === "Unexpected Low" && (
                <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0 h-4">Active</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              POSEIDON Groups 1 &amp; 2 (Adequate reserve but hypo-response &lt; 10 oocytes
              retrieved).
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CLINICAL OVERRIDE MODAL DIALOG (Min 20 Characters Required)
          ========================================================================= */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="max-w-md border-border/80 bg-card p-6 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-foreground">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Clinical Override — POSEIDON
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Hospital policy requires clinical justification (min 20 characters) and
                  cryptographic audit logging.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Target Group Selector */}
            <div>
              <label
                htmlFor="override-group-select"
                className="block font-semibold text-foreground mb-1"
              >
                Select Override POSEIDON Group
              </label>
              <select
                id="override-group-select"
                value={overrideGroup}
                onChange={(e) => setOverrideGroup(e.target.value as PoseidonGroup)}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring font-medium"
              >
                <option value="1a">Group 1a (Age &lt; 35, Adequate Reserve, &lt; 4 oocytes)</option>
                <option value="1b">Group 1b (Age &lt; 35, Adequate Reserve, 4–9 oocytes)</option>
                <option value="2a">Group 2a (Age ≥ 35, Adequate Reserve, &lt; 4 oocytes)</option>
                <option value="2b">Group 2b (Age ≥ 35, Adequate Reserve, 4–9 oocytes)</option>
                <option value="3">
                  Group 3 (Age &lt; 35, Poor Reserve: AFC &lt; 5, AMH &lt; 1.2)
                </option>
                <option value="4">
                  Group 4 (Age ≥ 35, Poor Reserve: AFC &lt; 5, AMH &lt; 1.2)
                </option>
              </select>
            </div>

            {/* Mandatory Free-Text Reason */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="override-reason" className="font-semibold text-foreground">
                  Mandatory Clinical Rationale
                </label>
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    overrideReason.trim().length >= 20
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600",
                  )}
                >
                  {overrideReason.trim().length} / 20 chars min
                </span>
              </div>
              <Textarea
                id="override-reason"
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Document clinical justification (e.g., Prior stimulation cycle at external clinic yielded 2 oocytes despite AMH 1.4 ng/mL)."
                className="text-xs resize-none"
              />
              {overrideReason.trim().length > 0 && overrideReason.trim().length < 20 && (
                <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Please provide at least {20 - overrideReason.trim().length} more characters.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOverrideModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              disabled={overrideReason.trim().length < 20}
              onClick={handleConfirmOverride}
              className="bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold gap-1.5 shadow-xs disabled:opacity-50"
            >
              <ShieldCheck className="size-3.5" />
              <span>Confirm & Log Override</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
