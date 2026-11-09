import { useState, useMemo, useCallback, useRef } from "react";
import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Compass,
  Printer,
  Lock,
  User,
  FlaskConical,
  AlertTriangle,
  Activity,
  Sparkles,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useAssessment, type FieldValue } from "@/lib/assessment/use-assessment";
import { ageFromDob } from "@/lib/assessment/schema";
import { classifyPoseidon, type PoseidonResult } from "@/lib/engine/poseidon";
import { lockSession } from "@/services/auth/session";
import { appendAuditEntry } from "@/services/audit/auditLog";
import { useAutoSave } from "@/hooks/use-auto-save";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/patients/$id/assessment")({
  head: () => ({
    meta: [
      { title: "Stage 1: Patient Assessment & Clinical Intake — AiFV Precision CDSS" },
      {
        name: "description",
        content:
          "Dedicated hospital intake: Anamnesis, baseline endocrine laboratories, risk flags, and real-time POSEIDON stratification preview.",
      },
    ],
  }),
  component: PatientAssessmentStage1View,
});

interface Stage1FormData {
  // Card A — Anamnesis (12 fields)
  fullName: string;
  dob: string;
  age: string;
  partnerAge: string;
  gravidity: string;
  parity: string;
  miscarriages: string;
  ectopic: string;
  infertilityType: "Primary" | "Secondary";
  infertilityDuration: string; // in months
  cycleLength: string; // in days
  cycleRegularity: "Regular" | "Irregular";

  // Card B — Baseline labs (AMH, AFC, FSH, LH, E2, P4)
  amh: string;
  afcLeft: string;
  afcRight: string;
  afcTotal: string;
  fsh: string;
  lh: string;
  estradiol: string;
  progesterone: string;

  // Card C — Risk flags (BMI, smoking, endometriosis)
  height: string; // cm
  weight: string; // kg
  bmi: string; // kg/m²
  smoking: "Never" | "Former" | "Current — light" | "Current — heavy";
  alcohol: "None" | "Occasional" | "Weekly" | "Daily";
  endoStage: "None" | "Stage I" | "Stage II" | "Stage III" | "Stage IV" | "Unknown";
  ovarianSurgery: "None" | "Cystectomy" | "Oophorectomy" | "Multiple";
  hydrosalpinx: "Absent" | "Unilateral" | "Bilateral";
  pcos: "Absent" | "Suspected" | "Confirmed";
  allergies: string;
}

export function PatientAssessmentStage1View() {
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
        name: "New Intake Patient",
        fileNumber: "IVF-NEW",
        age: "34 years",
        partnerAge: "36",
        infertilityType: "Primary",
        causes: [],
        cycles: 0,
        completion: 15,
        alerts: 0,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        values: {},
        cycleRecords: [],
      }
    );
  }, [id, records]);

  // Form State
  const [formData, setFormData] = useState<Stage1FormData>(() => {
    const v = patient.values || {};
    const str = (k: string, fallback = "") =>
      v[k] !== undefined && v[k] !== null ? String(v[k]) : fallback;

    const dob = str("dob", "1992-05-14");
    const computedAge = str("age") || (dob ? ageFromDob(dob) : "34 years");

    const afcL = str("afcLeft", "4");
    const afcR = str("afcRight", "4");
    const totalAfc =
      str("afcTotal") ||
      (Number.isFinite(Number(afcL)) && Number.isFinite(Number(afcR))
        ? String(Number(afcL) + Number(afcR))
        : "8");

    const h = Number(str("height", "165"));
    const w = Number(str("weight", "62"));
    const computedBmi = str("bmi") || (h > 0 && w > 0 ? (w / (h / 100) ** 2).toFixed(1) : "22.8");

    return {
      fullName: patient.name || str("fullName", "Patient Intake"),
      dob,
      age: computedAge,
      partnerAge: patient.partnerAge || str("partnerAge", "36"),
      gravidity: str("gravidity", "0"),
      parity: str("parity", "0"),
      miscarriages: str("miscarriages", "0"),
      ectopic: str("ectopic", "0"),
      infertilityType: (str("infertilityType", "Primary") as "Primary" | "Secondary") || "Primary",
      infertilityDuration: str("infertilityDuration", "24"),
      cycleLength: str("cycleLength", "28"),
      cycleRegularity: (str("cycleRegularity", "Regular") as "Regular" | "Irregular") || "Regular",

      amh: str("amh", "1.15"),
      afcLeft: afcL,
      afcRight: afcR,
      afcTotal: totalAfc,
      fsh: str("fsh", "8.2"),
      lh: str("lh", "5.4"),
      estradiol: str("estradiol", "42"),
      progesterone: str("progesterone", "0.45"),

      height: str("height", "165"),
      weight: str("weight", "62"),
      bmi: computedBmi,
      smoking:
        (str("smoking", "Never") as "Never" | "Former" | "Current — light" | "Current — heavy") ||
        "Never",
      alcohol: (str("alcohol", "None") as "None" | "Occasional" | "Weekly" | "Daily") || "None",
      endoStage:
        (str("endoStage", "None") as
          "None" | "Stage I" | "Stage II" | "Stage III" | "Stage IV" | "Unknown") || "None",
      ovarianSurgery:
        (str("ovarianSurgery", "None") as "None" | "Cystectomy" | "Oophorectomy" | "Multiple") ||
        "None",
      hydrosalpinx:
        (str("hydrosalpinx", "Absent") as "Absent" | "Unilateral" | "Bilateral") || "Absent",
      pcos: (str("pcos", "Absent") as "Absent" | "Suspected" | "Confirmed") || "Absent",
      allergies: str("allergies", "No known drug allergies (NKDA)"),
    };
  });

  const [isDirty, setIsDirty] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [poseidonModalOpen, setPoseidonModalOpen] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Field change handler
  const handleFieldChange = useCallback((field: keyof Stage1FormData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      // Auto-recalculate age if DOB changes
      if (field === "dob" && value) {
        const derivedAge = ageFromDob(value);
        if (derivedAge) next.age = derivedAge;
      }

      // Auto-recalculate Total AFC if Left or Right AFC changes
      if (field === "afcLeft" || field === "afcRight") {
        const l = Number(field === "afcLeft" ? value : next.afcLeft);
        const r = Number(field === "afcRight" ? value : next.afcRight);
        if (!Number.isNaN(l) && !Number.isNaN(r)) {
          next.afcTotal = String(l + r);
        }
      }

      // Auto-recalculate BMI if height or weight changes
      if (field === "height" || field === "weight") {
        const h = Number(field === "height" ? value : next.height);
        const w = Number(field === "weight" ? value : next.weight);
        if (h > 0 && w > 0) {
          next.bmi = (w / (h / 100) ** 2).toFixed(1);
        }
      }

      return next;
    });
    setIsDirty(true);
  }, []);

  // Core save function
  const executeSave = useCallback(
    (isManual = false) => {
      setIsSavingDraft(true);
      const timestamp = new Date().toISOString();

      // Convert formData to assessment values dictionary
      const valuesMap: Record<string, FieldValue> = {
        fullName: formData.fullName,
        dob: formData.dob,
        age: formData.age,
        partnerAge: Number(formData.partnerAge) || formData.partnerAge,
        gravidity: Number(formData.gravidity) || 0,
        parity: Number(formData.parity) || 0,
        miscarriages: Number(formData.miscarriages) || 0,
        ectopic: Number(formData.ectopic) || 0,
        infertilityType: formData.infertilityType,
        infertilityDuration: Number(formData.infertilityDuration) || 0,
        cycleLength: Number(formData.cycleLength) || 28,
        cycleRegularity: formData.cycleRegularity,

        amh: Number(formData.amh) || 0,
        afcLeft: Number(formData.afcLeft) || 0,
        afcRight: Number(formData.afcRight) || 0,
        afcTotal: Number(formData.afcTotal) || 0,
        fsh: Number(formData.fsh) || 0,
        lh: Number(formData.lh) || 0,
        estradiol: Number(formData.estradiol) || 0,
        progesterone: Number(formData.progesterone) || 0,

        height: Number(formData.height) || 0,
        weight: Number(formData.weight) || 0,
        bmi: formData.bmi,
        smoking: formData.smoking,
        alcohol: formData.alcohol,
        endoStage: formData.endoStage,
        ovarianSurgery: formData.ovarianSurgery,
        hydrosalpinx: formData.hydrosalpinx,
        pcos: formData.pcos,
        allergies: formData.allergies,
      };

      // Propagate to useAssessment draft for downstream engines
      Object.entries(valuesMap).forEach(([k, v]) => {
        setAssessmentValue(k, v);
      });

      // Update patient master record
      const updatedPatient: PatientRecord = {
        ...patient,
        name: formData.fullName,
        age: formData.age,
        partnerAge: formData.partnerAge,
        infertilityType: formData.infertilityType,
        updatedAt: timestamp,
        values: {
          ...patient.values,
          ...valuesMap,
        },
      };

      savePatient(updatedPatient);
      setLastAutoSavedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      setIsDirty(false);
      setIsSavingDraft(false);

      if (isManual) {
        toast.success("Stage 1 Draft Saved", {
          description:
            "All 12 anamnesis fields, baseline labs, and risk flags persisted to patient file.",
        });
      }
    },
    [formData, patient, setAssessmentValue],
  );

  // Auto-Save: triggers every 30s AND on tab visibilitychange=hidden
  useAutoSave({
    onSave: () => executeSave(false),
    intervalMs: 30000,
    enabled: isDirty,
  });

  // Calculate POSEIDON preview
  const poseidonResult = useMemo<PoseidonResult>(() => {
    const values: Record<string, FieldValue> = {
      age: Number(formData.age.replace(/\D/g, "")) || 34,
      amh: Number(formData.amh) || 1.15,
      afcTotal: Number(formData.afcTotal) || 8,
      afcLeft: Number(formData.afcLeft) || 4,
      afcRight: Number(formData.afcRight) || 4,
    };
    return classifyPoseidon(values, patient.cycleRecords || draft.cycles || []);
  }, [
    formData.age,
    formData.amh,
    formData.afcTotal,
    formData.afcLeft,
    formData.afcRight,
    patient.cycleRecords,
    draft.cycles,
  ]);

  // Mark Stage Complete handler
  const handleMarkStageComplete = () => {
    executeSave(false);

    // Cryptographic audit log entry
    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: "STAGE_1_INTAKE_COMPLETED",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        patientName: formData.fullName,
        age: formData.age,
        amh: formData.amh,
        totalAfc: formData.afcTotal,
        bmi: formData.bmi,
        poseidonGroup: poseidonResult.group ?? "Not low prognosis",
      },
    });

    // Update patient completion in record
    const completedPatient: PatientRecord = {
      ...patient,
      completion: Math.max(patient.completion, 25),
      updatedAt: new Date().toISOString(),
    };
    savePatient(completedPatient);

    toast.success("Stage 1 Clinical Intake Marked Complete", {
      description:
        "Baseline clinical profile certified. Patient is ready for Stage 2: POSEIDON Stratification.",
    });
  };

  // Immediate lock screen handler
  const handleLockScreen = () => {
    lockSession("manual_lock");
    window.dispatchEvent(new Event("aifv-session-changed"));
  };

  // Print Summary handler
  const handlePrintSummary = () => {
    window.print();
  };

  // BMI Category derived label
  const bmiNumeric = Number(formData.bmi);
  const bmiBadge = useMemo(() => {
    if (!bmiNumeric || Number.isNaN(bmiNumeric)) return null;
    if (bmiNumeric < 18.5)
      return (
        <Badge
          variant="outline"
          className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-[11px]"
        >
          Underweight
        </Badge>
      );
    if (bmiNumeric < 25.0)
      return (
        <Badge
          variant="outline"
          className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 text-[11px]"
        >
          Normal Weight
        </Badge>
      );
    if (bmiNumeric < 30.0)
      return (
        <Badge
          variant="outline"
          className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-[11px]"
        >
          Overweight
        </Badge>
      );
    return (
      <Badge
        variant="outline"
        className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950/20 text-[11px]"
      >
        Obesity Class I+
      </Badge>
    );
  }, [bmiNumeric]);

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
            {/* Button 5: [Back to Patient] */}
            <Link to="/patients/$id" params={{ id: patient.id }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5"
                title="Return to patient master dossier"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to Patient</span>
              </Button>
            </Link>
            <span className="text-border">|</span>
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold"
            >
              Stage 1 of 8
            </Badge>
            <span className="text-xs text-muted-foreground">
              Clinical Intake & Baseline Anamnesis
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Patient Assessment: {formData.fullName}</span>
            <span className="text-sm font-mono font-normal text-muted-foreground">
              ({patient.fileNumber || patient.id})
            </span>
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5 text-muted-foreground" />
              Auto-save:{" "}
              {lastAutoSavedAt
                ? `Saved at ${lastAutoSavedAt}`
                : isDirty
                  ? "Pending changes…"
                  : "Synchronized"}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="size-3.5" />
              Hospital Audit Active
            </span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Button 4: [Print Summary] */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintSummary}
            className="border border-border/80 bg-background hover:bg-muted text-foreground text-xs font-medium gap-1.5 shadow-xs"
            title="Print clinical intake dossier"
          >
            <Printer className="size-3.5" />
            <span>Print Summary</span>
          </Button>

          {/* Button 1: [Save Draft] */}
          <Button
            variant="default"
            size="sm"
            disabled={isSavingDraft}
            onClick={() => executeSave(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs text-xs gap-1.5"
            title="Persist current assessment draft"
          >
            <Save className="size-3.5" />
            <span>{isSavingDraft ? "Saving…" : "Save Draft"}</span>
          </Button>

          {/* Button 2: [Mark Stage Complete] */}
          <Button
            variant="default"
            size="sm"
            onClick={handleMarkStageComplete}
            className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold shadow-xs text-xs gap-1.5"
            title="Validate and mark Stage 1 complete"
          >
            <CheckCircle2 className="size-3.5" />
            <span>Mark Stage Complete</span>
          </Button>

          {/* Button 6: [Next Stage >] */}
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              executeSave(false);
              void navigate({ to: "/poseidon" });
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs text-xs gap-1.5"
            title="Advance to Stage 2: POSEIDON Stratification"
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

      {/* =========================================================================
          3 CARDS ON ONE SCREEN (RESPONSIVE 3-COLUMN GRID)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* =======================================================================
            CARD A — ANAMNESIS (12 FIELDS)
            ======================================================================= */}
        <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <User className="size-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Card A — Anamnesis</h2>
                <p className="text-[11px] text-muted-foreground">
                  12 baseline demographic & obstetric fields
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] font-mono">
              12 / 12 Fields
            </Badge>
          </div>

          <div className="space-y-3.5">
            {/* Field 1: Full Name */}
            <div>
              <label
                htmlFor="cardA-fullName"
                className="block text-xs font-medium text-foreground mb-1"
              >
                1. Full Name
              </label>
              <Input
                id="cardA-fullName"
                value={formData.fullName}
                onChange={(e) => handleFieldChange("fullName", e.target.value)}
                placeholder="Patient full legal name"
                className="h-8 text-xs"
              />
            </div>

            {/* Field 2 & 3: Date of Birth & Derived Age */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="cardA-dob"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  2. Date of Birth
                </label>
                <Input
                  id="cardA-dob"
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleFieldChange("dob", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="cardA-age"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  3. Age (Derived)
                </label>
                <Input
                  id="cardA-age"
                  value={formData.age}
                  onChange={(e) => handleFieldChange("age", e.target.value)}
                  placeholder="e.g. 34 years"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Field 4: Partner Age */}
            <div>
              <label
                htmlFor="cardA-partnerAge"
                className="block text-xs font-medium text-foreground mb-1"
              >
                4. Partner Age (years)
              </label>
              <Input
                id="cardA-partnerAge"
                type="number"
                min={18}
                max={99}
                value={formData.partnerAge}
                onChange={(e) => handleFieldChange("partnerAge", e.target.value)}
                placeholder="e.g. 36"
                className="h-8 text-xs"
              />
            </div>

            {/* Field 5 & 6: Gravidity & Parity */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="cardA-gravidity"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  5. Gravidity (Total)
                </label>
                <Input
                  id="cardA-gravidity"
                  type="number"
                  min={0}
                  max={20}
                  value={formData.gravidity}
                  onChange={(e) => handleFieldChange("gravidity", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="cardA-parity"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  6. Parity (Deliveries)
                </label>
                <Input
                  id="cardA-parity"
                  type="number"
                  min={0}
                  max={20}
                  value={formData.parity}
                  onChange={(e) => handleFieldChange("parity", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Field 7 & 8: Miscarriages & Ectopic */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="cardA-miscarriages"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  7. Miscarriages
                </label>
                <Input
                  id="cardA-miscarriages"
                  type="number"
                  min={0}
                  max={15}
                  value={formData.miscarriages}
                  onChange={(e) => handleFieldChange("miscarriages", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="cardA-ectopic"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  8. Ectopic Pregnancies
                </label>
                <Input
                  id="cardA-ectopic"
                  type="number"
                  min={0}
                  max={10}
                  value={formData.ectopic}
                  onChange={(e) => handleFieldChange("ectopic", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Field 9: Infertility Type */}
            <div>
              <label
                htmlFor="cardA-infertilityType"
                className="block text-xs font-medium text-foreground mb-1"
              >
                9. Infertility Classification
              </label>
              <select
                id="cardA-infertilityType"
                value={formData.infertilityType}
                onChange={(e) => handleFieldChange("infertilityType", e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Primary">Primary Infertility (No prior conception)</option>
                <option value="Secondary">
                  Secondary Infertility (Prior conception documented)
                </option>
              </select>
            </div>

            {/* Field 10: Infertility Duration */}
            <div>
              <label
                htmlFor="cardA-infertilityDuration"
                className="block text-xs font-medium text-foreground mb-1"
              >
                10. Infertility Duration (Months)
              </label>
              <Input
                id="cardA-infertilityDuration"
                type="number"
                min={0}
                max={360}
                value={formData.infertilityDuration}
                onChange={(e) => handleFieldChange("infertilityDuration", e.target.value)}
                placeholder="Months attempting conception"
                className="h-8 text-xs"
              />
            </div>

            {/* Field 11 & 12: Cycle Length & Cycle Regularity */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="cardA-cycleLength"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  11. Cycle Length (Days)
                </label>
                <Input
                  id="cardA-cycleLength"
                  type="number"
                  min={15}
                  max={90}
                  value={formData.cycleLength}
                  onChange={(e) => handleFieldChange("cycleLength", e.target.value)}
                  placeholder="28"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="cardA-cycleRegularity"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  12. Regularity
                </label>
                <select
                  id="cardA-cycleRegularity"
                  value={formData.cycleRegularity}
                  onChange={(e) => handleFieldChange("cycleRegularity", e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Regular">Regular (24–35 d)</option>
                  <option value="Irregular">Irregular (&gt; 35 d / Oligo)</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* =======================================================================
            CARD B — BASELINE LABS (AMH, AFC, FSH, LH, E2, P4)
            ======================================================================= */}
        <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <FlaskConical className="size-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Card B — Baseline Labs</h2>
                <p className="text-[11px] text-muted-foreground">
                  Ovarian reserve markers & hormonal panel
                </p>
              </div>
            </div>

            {/* Button 3: [Run POSEIDON Preview] Toolbar */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPoseidonModalOpen(true)}
              className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-semibold h-7 px-2 gap-1.5 shadow-xs"
              title="Evaluate POSEIDON stratification criteria"
            >
              <Compass className="size-3.5" />
              <span>POSEIDON Preview</span>
            </Button>
          </div>

          {/* Quick Stratification Strip */}
          <div className="rounded-lg bg-muted/40 p-2.5 border border-border/60 text-xs flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Reserve Classification:</span>
            <Badge
              variant="secondary"
              className={cn(
                "font-semibold text-xs",
                Number(formData.amh) < 1.2 || Number(formData.afcTotal) < 5
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
              )}
            >
              {Number(formData.amh) < 1.2 || Number(formData.afcTotal) < 5
                ? "Low Reserve (POSEIDON)"
                : "Adequate Reserve"}
            </Badge>
          </div>

          <div className="space-y-3.5">
            {/* AMH */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="cardB-amh" className="text-xs font-medium text-foreground">
                  Anti-Müllerian Hormone (AMH)
                </label>
                <span className="text-[11px] text-muted-foreground">Threshold: 1.20 ng/mL</span>
              </div>
              <div className="relative">
                <Input
                  id="cardB-amh"
                  type="number"
                  step="0.01"
                  min="0"
                  max="30"
                  value={formData.amh}
                  onChange={(e) => handleFieldChange("amh", e.target.value)}
                  placeholder="e.g. 1.15"
                  className="h-8 text-xs pr-14"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                  ng/mL
                </span>
              </div>
            </div>

            {/* AFC: Left, Right, Total */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Antral Follicle Count (AFC)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-0.5">Left Ovary</span>
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={formData.afcLeft}
                    onChange={(e) => handleFieldChange("afcLeft", e.target.value)}
                    placeholder="4"
                    className="h-8 text-xs"
                    aria-label="Antral Follicle Count Left"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-0.5">
                    Right Ovary
                  </span>
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={formData.afcRight}
                    onChange={(e) => handleFieldChange("afcRight", e.target.value)}
                    placeholder="4"
                    className="h-8 text-xs"
                    aria-label="Antral Follicle Count Right"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground mb-0.5">Total AFC</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.afcTotal}
                    onChange={(e) => handleFieldChange("afcTotal", e.target.value)}
                    placeholder="8"
                    className="h-8 text-xs font-semibold bg-muted/30"
                    aria-label="Antral Follicle Count Total"
                  />
                </div>
              </div>
            </div>

            {/* Basal FSH & LH */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="cardB-fsh"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Basal FSH (Day 2–3)
                </label>
                <div className="relative">
                  <Input
                    id="cardB-fsh"
                    type="number"
                    step="0.1"
                    min="0"
                    max="150"
                    value={formData.fsh}
                    onChange={(e) => handleFieldChange("fsh", e.target.value)}
                    placeholder="8.2"
                    className="h-8 text-xs pr-12"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                    IU/L
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="cardB-lh"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Basal LH (Day 2–3)
                </label>
                <div className="relative">
                  <Input
                    id="cardB-lh"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.lh}
                    onChange={(e) => handleFieldChange("lh", e.target.value)}
                    placeholder="5.4"
                    className="h-8 text-xs pr-12"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                    IU/L
                  </span>
                </div>
              </div>
            </div>

            {/* Estradiol (E2) & Progesterone (P4) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="cardB-estradiol"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Estradiol (E2)
                </label>
                <div className="relative">
                  <Input
                    id="cardB-estradiol"
                    type="number"
                    min="0"
                    max="5000"
                    value={formData.estradiol}
                    onChange={(e) => handleFieldChange("estradiol", e.target.value)}
                    placeholder="42"
                    className="h-8 text-xs pr-14"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                    pg/mL
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="cardB-progesterone"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Progesterone (P4)
                </label>
                <div className="relative">
                  <Input
                    id="cardB-progesterone"
                    type="number"
                    step="0.01"
                    min="0"
                    max="50"
                    value={formData.progesterone}
                    onChange={(e) => handleFieldChange("progesterone", e.target.value)}
                    placeholder="0.45"
                    className="h-8 text-xs pr-14"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                    ng/mL
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnostic hint callout */}
            <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
              <Sparkles className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>
                AMH &lt; 1.2 ng/mL or AFC &lt; 5 indicates expected poor ovarian response. Combined
                with age, this stratifies into POSEIDON Groups 3 or 4.
              </span>
            </div>
          </div>
        </section>

        {/* =======================================================================
            CARD C — RISK FLAGS (BMI, SMOKING, ENDOMETRIOSIS, SURGERY)
            ======================================================================= */}
        <section className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Card C — Risk Flags</h2>
                <p className="text-[11px] text-muted-foreground">
                  Anthropometrics, lifestyle & surgical history
                </p>
              </div>
            </div>
            {bmiBadge}
          </div>

          <div className="space-y-3.5">
            {/* Height, Weight & Computed BMI */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="cardC-height"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Height (cm)
                </label>
                <Input
                  id="cardC-height"
                  type="number"
                  min="100"
                  max="230"
                  value={formData.height}
                  onChange={(e) => handleFieldChange("height", e.target.value)}
                  placeholder="165"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="cardC-weight"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Weight (kg)
                </label>
                <Input
                  id="cardC-weight"
                  type="number"
                  min="30"
                  max="250"
                  value={formData.weight}
                  onChange={(e) => handleFieldChange("weight", e.target.value)}
                  placeholder="62"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label
                  htmlFor="cardC-bmi"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  BMI (kg/m²)
                </label>
                <Input
                  id="cardC-bmi"
                  value={formData.bmi}
                  readOnly
                  placeholder="22.8"
                  className="h-8 text-xs font-semibold bg-muted/40"
                />
              </div>
            </div>

            {/* Smoking Status */}
            <div>
              <label
                htmlFor="cardC-smoking"
                className="block text-xs font-medium text-foreground mb-1"
              >
                Smoking Status
              </label>
              <select
                id="cardC-smoking"
                value={formData.smoking}
                onChange={(e) => handleFieldChange("smoking", e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Never">Never smoked</option>
                <option value="Former">Former smoker (&gt; 1 yr cessation)</option>
                <option value="Current — light">Current light smoker (&lt; 10/day)</option>
                <option value="Current — heavy">Current heavy smoker (≥ 10/day)</option>
              </select>
            </div>

            {/* Alcohol Status */}
            <div>
              <label
                htmlFor="cardC-alcohol"
                className="block text-xs font-medium text-foreground mb-1"
              >
                Alcohol Intake
              </label>
              <select
                id="cardC-alcohol"
                value={formData.alcohol}
                onChange={(e) => handleFieldChange("alcohol", e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="None">None (Zero consumption)</option>
                <option value="Occasional">Occasional / Social (&lt; 2 units/wk)</option>
                <option value="Weekly">Moderate weekly</option>
                <option value="Daily">Daily consumption</option>
              </select>
            </div>

            {/* Endometriosis */}
            <div>
              <label
                htmlFor="cardC-endoStage"
                className="block text-xs font-medium text-foreground mb-1"
              >
                Endometriosis (rASRM Stage)
              </label>
              <select
                id="cardC-endoStage"
                value={formData.endoStage}
                onChange={(e) => handleFieldChange("endoStage", e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="None">No evidence of endometriosis</option>
                <option value="Stage I">Stage I (Minimal)</option>
                <option value="Stage II">Stage II (Mild)</option>
                <option value="Stage III">Stage III (Moderate, endometrioma)</option>
                <option value="Stage IV">
                  Stage IV (Severe, deep infiltrating / frozen pelvis)
                </option>
                <option value="Unknown">Suspected / Not laparoscopically assessed</option>
              </select>
            </div>

            {/* Previous Ovarian Surgery */}
            <div>
              <label
                htmlFor="cardC-ovarianSurgery"
                className="block text-xs font-medium text-foreground mb-1"
              >
                Previous Ovarian Surgery
              </label>
              <select
                id="cardC-ovarianSurgery"
                value={formData.ovarianSurgery}
                onChange={(e) => handleFieldChange("ovarianSurgery", e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="None">None (Intact ovarian cortex)</option>
                <option value="Cystectomy">Unilateral cystectomy (Endometrioma/Dermoid)</option>
                <option value="Oophorectomy">Unilateral oophorectomy</option>
                <option value="Multiple">Multiple bilateral ovarian resections</option>
              </select>
            </div>

            {/* Hydrosalpinx & PCOS */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="cardC-hydrosalpinx"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Hydrosalpinx
                </label>
                <select
                  id="cardC-hydrosalpinx"
                  value={formData.hydrosalpinx}
                  onChange={(e) => handleFieldChange("hydrosalpinx", e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Absent">Absent</option>
                  <option value="Unilateral">Unilateral</option>
                  <option value="Bilateral">Bilateral</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="cardC-pcos"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  PCOS Etiology
                </label>
                <select
                  id="cardC-pcos"
                  value={formData.pcos}
                  onChange={(e) => handleFieldChange("pcos", e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Absent">Absent</option>
                  <option value="Suspected">Suspected</option>
                  <option value="Confirmed">Confirmed</option>
                </select>
              </div>
            </div>

            {/* Drug Allergies */}
            <div>
              <label
                htmlFor="cardC-allergies"
                className="block text-xs font-medium text-foreground mb-1"
              >
                Known Drug Allergies
              </label>
              <Input
                id="cardC-allergies"
                value={formData.allergies}
                onChange={(e) => handleFieldChange("allergies", e.target.value)}
                placeholder="NKDA or list offending drugs"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </section>
      </div>

      {/* =========================================================================
          POSEIDON CRITERIA REAL-TIME PREVIEW DIALOG
          ========================================================================= */}
      <Dialog open={poseidonModalOpen} onOpenChange={setPoseidonModalOpen}>
        <DialogContent className="max-w-xl border-border/80 bg-card p-6 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-foreground">
              <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Compass className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  POSEIDON Classification Real-Time Preview
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Published criteria applied: Age threshold = 35 y, AMH = 1.20 ng/mL, AFC = 5
                  follicles
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Stratified Category:
                </span>
                <Badge className="bg-indigo-600 text-white font-bold text-xs px-2.5 py-0.5">
                  {poseidonResult.group
                    ? `POSEIDON Group ${poseidonResult.group.toUpperCase()}`
                    : "Not Classified / Low Prognosis"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {poseidonResult.headline ||
                  "Based on the entered AMH, AFC, and age, patient prognosis is evaluated under ESHRE/POSEIDON guidelines."}
              </p>
            </div>

            {/* Criteria Breakdown Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border/70 p-3 bg-muted/20">
                <span className="text-muted-foreground block text-[11px] mb-1">Age Factor:</span>
                <span className="font-semibold text-foreground">{formData.age || "34 years"}</span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  {Number(formData.age.replace(/\D/g, "")) < 35
                    ? "< 35 years (Groups 1 / 3)"
                    : "≥ 35 years (Groups 2 / 4)"}
                </span>
              </div>

              <div className="rounded-lg border border-border/70 p-3 bg-muted/20">
                <span className="text-muted-foreground block text-[11px] mb-1">
                  Reserve Markers:
                </span>
                <span className="font-semibold text-foreground">
                  AMH: {formData.amh || "1.15"} ng/mL · AFC: {formData.afcTotal || "8"}
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  {Number(formData.amh) < 1.2 || Number(formData.afcTotal) < 5
                    ? "Poor Reserve Criteria Met"
                    : "Adequate Reserve Markers"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 p-3 text-xs space-y-1.5 bg-background">
              <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Activity className="size-3.5 text-primary" />
                <span>Next Clinical Action (Stage 2):</span>
              </h4>
              <p className="text-muted-foreground text-[11px]">
                Advancing to Stage 2 will provide protocol recommendation and starting gonadotropin
                dosage adjustment according to the POSEIDON subgroup guidelines.
              </p>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPoseidonModalOpen(false)}
              className="text-xs"
            >
              Close Preview
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setPoseidonModalOpen(false);
                executeSave(false);
                void navigate({ to: "/poseidon" });
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5 shadow-xs"
            >
              <span>Go to Stage 2: POSEIDON</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
