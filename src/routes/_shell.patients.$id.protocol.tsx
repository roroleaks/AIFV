import { useState, useMemo } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Columns,
  ShieldAlert,
  CheckCircle2,
  Lock,
  ExternalLink,
  BookOpen,
  Calendar,
  Pill,
  Sparkles,
  Info,
  Check,
  Activity,
  Layers,
  HeartPulse,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_shell/patients/$id/protocol")({
  head: () => ({
    meta: [
      { title: "Stage 3: Protocol Recommendation & Selection — AIVF CDSS v3.1" },
      {
        name: "description",
        content:
          "Stage 3 ovarian stimulation protocol recommendation, side-by-side alternative protocol review, clinical rationale, and clinical override mechanism.",
      },
    ],
  }),
  component: PatientProtocolStage3View,
});

export interface ProtocolSpec {
  id: string;
  name: string;
  badge: string;
  recommended: boolean;
  stimulationStart: string;
  suppressionMechanism: string;
  triggerOptions: string;
  durationDays: string;
  ohssRiskRate: string;
  freshTransfer: string;
  advantages: string[];
  disadvantages: string[];
  indications: string[];
  evidenceLevel: string;
  guidelineAnchor: string;
}

const PROTOCOL_ANTAGONIST: ProtocolSpec = {
  id: "antagonist",
  name: "GnRH Antagonist Protocol",
  badge: "Recommended First-Line (ESHRE 2025)",
  recommended: true,
  stimulationStart: "Cycle Day 2–3 with individualized gonadotropin starting dose",
  suppressionMechanism:
    "GnRH Antagonist (0.25 mg/day ganirelix/cetrorelix) fixed Day 5–6 or flexible (lead follicle ≥ 14 mm)",
  triggerOptions:
    "GnRH agonist trigger (OHSS elimination), dual trigger (agonist + low-dose hCG), or urinary/recombinant hCG",
  durationDays: "9 – 10 days",
  ohssRiskRate: "1.2% (RR 0.53 vs long agonist)",
  freshTransfer:
    "Permitted with hCG / dual trigger; freeze-all advised if peak E2 > 4,000 pg/mL or > 18 follicles",
  advantages: [
    "Substantially reduced risk of moderate and severe OHSS (RR 0.53)",
    "Shorter stimulation duration (-1.5 to 2 days) compared to long agonist",
    "Lower cumulative gonadotropin dose required",
    "Flexibility of GnRH agonist trigger to virtually eliminate severe OHSS",
    "No ovarian cyst formation or prolonged pituitary suppression phase",
  ],
  disadvantages: [
    "Requires strict patient adherence to daily antagonist injection timing (± 2 hours)",
    "Slightly fewer oocytes retrieved in some historical cohorts, though equivalent cumulative live birth rate",
  ],
  indications: [
    "First-line standard of care for normoresponders and hyperresponders (PCOS)",
    "Patients with elevated baseline AMH (> 3.5 ng/mL) or AFC (≥ 16)",
    "Poor ovarian responders (POSEIDON Groups 1–4) allowing flexible trigger",
  ],
  evidenceLevel: "Level 1A (High Quality)",
  guidelineAnchor: "ESHRE 2025 Guidelines Rec 1–4; Cochrane Database Syst Rev 2016",
};

const PROTOCOL_LONG_AGONIST: ProtocolSpec = {
  id: "long-agonist",
  name: "Long GnRH Agonist Protocol",
  badge: "Alternative: Pituitary Down-Regulation",
  recommended: false,
  stimulationStart:
    "Gonadotropin initiation after confirmed pituitary desensitization (serum E2 < 50 pg/mL, lining < 4 mm)",
  suppressionMechanism:
    "GnRH agonist (triptorelin / leuprolide acetate) initiated mid-luteal (Day 21) or follicular phase",
  triggerOptions:
    "hCG trigger (5,000 – 10,000 IU) mandatory (GnRH agonist trigger ineffective due to desensitized receptors)",
  durationDays: "11 – 13 days of stimulation (plus 10–14 days down-regulation)",
  ohssRiskRate: "5.8% – 8.4% (Highest among protocols)",
  freshTransfer: "Permitted, standard luteal phase support with micronized progesterone",
  advantages: [
    "Complete prevention of premature LH surges (< 1%)",
    "Convenient cycle batching and clinical programming of oocyte retrieval",
    "Beneficial suppression for patients with advanced endometriosis or adenomyosis",
  ],
  disadvantages: [
    "Significantly elevated risk of moderate to severe OHSS in high responders",
    "Prolonged treatment cycle and higher total gonadotropin consumption (+400–600 IU)",
    "Agonist trigger impossible for OHSS rescue",
    "Hypo-estrogenic side effects (hot flashes, headaches, mood alterations)",
  ],
  indications: [
    "Severe endometriosis (rASRM Stage III/IV) or symptomatic adenomyosis",
    "History of premature luteinization in antagonist cycles",
    "Clinical programming requirements for lab schedule optimization",
  ],
  evidenceLevel: "Level 1A (High Quality)",
  guidelineAnchor: "ESHRE 2025 Guidelines Rec 5; Cochrane Review 2016",
};

const PROTOCOL_PPOS: ProtocolSpec = {
  id: "ppos",
  name: "Progestin-Primed Ovarian Stimulation (PPOS)",
  badge: "Alternative: Oral LH Suppression (Freeze-All)",
  recommended: false,
  stimulationStart: "Cycle Day 2–3 concomitant with oral progestin",
  suppressionMechanism:
    "Oral medroxyprogesterone acetate (10 mg/day) or dydrogesterone (20 mg/day) from Day 2/3 until trigger",
  triggerOptions: "Dual trigger or GnRH agonist trigger (0.2 mg triptorelin) with freeze-all",
  durationDays: "10 – 11 days",
  ohssRiskRate: "1.1% (Near-zero when paired with GnRH agonist trigger and freeze-all)",
  freshTransfer:
    "Contraindicated — Mandatory freeze-all due to premature secretory endometrial transformation",
  advantages: [
    "100% oral pituitary suppression (eliminates daily injectable antagonist)",
    "Robust prevention of premature LH surge without compromising oocyte yield or euploidy",
    "Cost-effective with high patient convenience and satisfaction",
    "Compatible with GnRH agonist trigger to eliminate OHSS",
  ],
  disadvantages: [
    "Obligate freeze-all and subsequent frozen embryo transfer (FET) cycle",
    "Cannot be utilized when fresh embryo transfer is planned",
    "Lacks long-term obstetric follow-up data compared to antagonist/agonist regimens",
  ],
  indications: [
    "Elective Freeze-All cycles and Preimplantation Genetic Testing (PGT-A / PGT-M)",
    "Oocyte donor cycles and social or oncology fertility preservation",
    "High responders at severe OHSS risk in a planned segmented cycle strategy",
  ],
  evidenceLevel: "Level 1B (Moderate Quality)",
  guidelineAnchor: "ESHRE 2025 Guidelines Rec 6; Reprod Biomed Online 2021",
};

const AVAILABLE_PROTOCOLS: Record<string, ProtocolSpec> = {
  antagonist: PROTOCOL_ANTAGONIST,
  "long-agonist": PROTOCOL_LONG_AGONIST,
  ppos: PROTOCOL_PPOS,
};

export function PatientProtocolStage3View() {
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
        completion: 35,
        alerts: 0,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        values: {},
        cycleRecords: [],
      }
    );
  }, [id, records]);

  // Derived patient parameters
  const patientAge = useMemo(() => {
    if (patient.values?.["age"]) return Number(patient.values["age"]);
    if (patient.values?.["dob"]) {
      const parsed = ageFromDob(String(patient.values["dob"]));
      if (parsed) return parsed;
    }
    const match = patient.age.match(/\d+/);
    return match ? Number(match[0]) : 34;
  }, [patient]);

  const patientAmh = useMemo(() => {
    const v = patient.values?.["amh"] ?? draft.values["amh"];
    return typeof v === "number" ? v : Number(v) || 2.1;
  }, [patient.values, draft.values]);

  const patientAfc = useMemo(() => {
    const v = patient.values?.["afcTotal"] ?? draft.values["afcTotal"];
    return typeof v === "number" ? v : Number(v) || 12;
  }, [patient.values, draft.values]);

  const patientBmi = useMemo(() => {
    const v = patient.values?.["bmi"] ?? draft.values["bmi"];
    return typeof v === "number" ? v : Number(v) || 23.4;
  }, [patient.values, draft.values]);

  const patientPoseidon = useMemo(() => {
    return String(
      patient.values?.["poseidonGroup"] ?? draft.values["poseidonGroup"] ?? "Not Low Prognosis",
    );
  }, [patient.values, draft.values]);

  // Selection states
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>("antagonist");
  const [isModified, setIsModified] = useState(false);

  // Modals state
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideProtocolId, setOverrideProtocolId] = useState<string>("long-agonist");
  const [overrideReason, setOverrideReason] = useState("");
  const [activeOverride, setActiveOverride] = useState<{
    protocolId: string;
    reason: string;
    at: string;
  } | null>(null);

  // Auto-save hook
  useAutoSave({
    onSave: () => {
      setAssessmentValue("protocol", selectedProtocolId);
    },
    intervalMs: 30000,
    enabled: isModified,
  });

  // Action 1: [Accept]
  const handleAcceptProtocol = (protoId?: string) => {
    const targetId = protoId || selectedProtocolId;
    const proto = AVAILABLE_PROTOCOLS[targetId] ?? PROTOCOL_ANTAGONIST;
    setSelectedProtocolId(targetId);

    // Save to assessment draft
    setAssessmentValue("protocol", proto.name);
    setAssessmentValue("protocolId", targetId);

    // Update patient record
    const updatedPatient: PatientRecord = {
      ...patient,
      updatedAt: new Date().toISOString(),
      completion: Math.max(patient.completion || 0, 50),
      values: {
        ...patient.values,
        ["protocol"]: proto.name,
        ["protocolId"]: targetId,
        ["protocolAcceptedAt"]: new Date().toISOString(),
      },
    };
    savePatient(updatedPatient);
    setIsModified(false);

    // Log to clinical audit trail
    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: "PROTOCOL_ACCEPTED",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        patientName: patient.name,
        protocolId: targetId,
        protocolName: proto.name,
        isRecommended: proto.recommended,
        acceptedAt: new Date().toISOString(),
      },
    });

    toast.success("Protocol Confirmed and Accepted", {
      description: `${proto.name} has been locked into patient ${patient.name}'s clinical plan.`,
    });
  };

  // Action 2: Confirm Override
  const handleConfirmOverride = () => {
    if (overrideReason.trim().length < 20) {
      toast.error("Override Reason Incomplete", {
        description: "Clinical governance policy requires a minimum of 20 characters.",
      });
      return;
    }

    const proto = AVAILABLE_PROTOCOLS[overrideProtocolId] ?? PROTOCOL_ANTAGONIST;
    setSelectedProtocolId(overrideProtocolId);

    // Write cryptographic audit entry
    void appendAuditEntry({
      by: "Dr. Raouf Roshdy",
      action: "PROTOCOL_CLINICAL_OVERRIDE",
      caseId: patient.id,
      details: {
        patientId: patient.id,
        patientName: patient.name,
        recommendedProtocol: PROTOCOL_ANTAGONIST.name,
        overrideProtocolId,
        overrideProtocolName: proto.name,
        reason: overrideReason.trim(),
        at: new Date().toISOString(),
      },
    });

    setActiveOverride({
      protocolId: overrideProtocolId,
      reason: overrideReason.trim(),
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setAssessmentValue("protocol", proto.name);
    setAssessmentValue("protocolId", overrideProtocolId);

    const updatedPatient: PatientRecord = {
      ...patient,
      updatedAt: new Date().toISOString(),
      values: {
        ...patient.values,
        ["protocol"]: proto.name,
        ["protocolId"]: overrideProtocolId,
        ["protocolOverrideReason"]: overrideReason.trim(),
      },
    };
    savePatient(updatedPatient);

    setOverrideModalOpen(false);
    toast.warning("Protocol Clinical Override Confirmed", {
      description: `Regimen changed to ${proto.name}. Reason cryptographically anchored in audit trail.`,
    });
  };

  // Action 6: [Lock]
  const handleLockScreen = () => {
    lockSession("manual_lock");
    toast.info("Session Locked", {
      description: "Clinical workstation locked by clinician. Enter PIN to resume.",
    });
  };

  const recommendedProto = PROTOCOL_ANTAGONIST;
  const longAgonistProto = PROTOCOL_LONG_AGONIST;
  const pposProto = PROTOCOL_PPOS;

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
            aria-label="Back to POSEIDON Stratification"
          >
            <Link to="/patients/$id/poseidon" params={{ id: patient.id }}>
              <ArrowLeft className="size-4" />
              <span>Back to POSEIDON</span>
            </Link>
          </Button>

          <div className="h-4 w-px bg-border/60" />

          <div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-2xs font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20"
              >
                Stage 3: Protocol Recommendation
              </Badge>
              {activeOverride && (
                <Badge
                  variant="outline"
                  className="text-2xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                >
                  Override Active ({activeOverride.at})
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-0.5">
              Ovarian Stimulation Protocol Selection
            </h1>
          </div>
        </div>

        {/* Action Button Cluster */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Button: [Compare] */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCompareModalOpen(true)}
            className="h-8 text-xs font-medium gap-1.5 border-border/80 bg-background hover:bg-muted text-foreground shadow-xs"
            aria-label="Compare Protocols"
          >
            <Columns className="size-3.5 text-primary" />
            <span>Compare</span>
          </Button>

          {/* Button: [Override] */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOverrideModalOpen(true)}
            className="h-8 text-xs font-semibold gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border-amber-500/30"
            aria-label="Override Protocol Recommendation"
          >
            <ShieldAlert className="size-3.5" />
            <span>Override</span>
          </Button>

          {/* Button: [Next >] */}
          <Button
            asChild
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            aria-label="Proceed to Starting Dose Engine"
          >
            <Link to="/patients/$id/dose" params={{ id: patient.id }}>
              <span>Next: Starting Dose</span>
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

      {/* Patient Stratification Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 p-3 rounded-lg border border-border/70 bg-card/60 backdrop-blur-xs text-xs">
        <div>
          <span className="text-muted-foreground text-2xs block">Patient</span>
          <span className="font-semibold text-foreground truncate block">{patient.name}</span>
          <span className="text-2xs text-muted-foreground font-mono">{patient.fileNumber}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Age / BMI</span>
          <span className="font-semibold text-foreground">{patientAge} yrs</span>
          <span className="text-2xs text-muted-foreground block">{patientBmi} kg/m²</span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Ovarian Reserve</span>
          <span className="font-semibold text-foreground">AMH {patientAmh} ng/mL</span>
          <span className="text-2xs text-muted-foreground block">AFC {patientAfc} follicles</span>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">POSEIDON Stratum</span>
          <Badge variant="secondary" className="text-2xs font-semibold mt-0.5">
            {patientPoseidon === "Not Low Prognosis"
              ? "Normal Reserve"
              : `Group ${patientPoseidon}`}
          </Badge>
        </div>
        <div>
          <span className="text-muted-foreground text-2xs block">Current Selection</span>
          <span className="font-semibold text-primary block truncate">
            {AVAILABLE_PROTOCOLS[selectedProtocolId]?.name ?? "GnRH Antagonist"}
          </span>
          <span className="text-2xs text-muted-foreground">
            {selectedProtocolId === "antagonist" ? "Recommended" : "Clinician Selected"}
          </span>
        </div>
        <div className="flex items-center justify-end">
          {/* Button: [Accept] Header Quick Action */}
          <Button
            type="button"
            size="sm"
            onClick={() => handleAcceptProtocol(selectedProtocolId)}
            className="h-7 text-xs font-semibold gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
            aria-label="Accept Protocol"
          >
            <CheckCircle2 className="size-3.5" />
            <span>Accept</span>
          </Button>
        </div>
      </div>

      {/* Primary Recommended Protocol Card (Highlighted) */}
      <div
        className={cn(
          "relative rounded-xl border-2 transition-all p-5 shadow-sm space-y-4",
          selectedProtocolId === "antagonist"
            ? "border-primary/80 bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/30"
            : "border-border/80 bg-card hover:border-primary/40",
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary text-primary-foreground font-semibold text-xs tracking-wide">
                {recommendedProto.badge}
              </Badge>
              <Badge
                variant="outline"
                className="text-2xs font-medium text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
              >
                OHSS Risk: {recommendedProto.ohssRiskRate}
              </Badge>
              <Badge variant="outline" className="text-2xs font-mono text-muted-foreground">
                Stimulation: {recommendedProto.durationDays}
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mt-1">
              <Sparkles className="size-5 text-primary" />
              <span>{recommendedProto.name}</span>
            </h2>
            <p className="text-xs text-muted-foreground max-w-3xl">
              Standard-of-care protocol per ESHRE 2025. Delivers equivalent cumulative live birth
              rates to long agonist protocols while reducing moderate-to-severe OHSS by over 50%.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Button: [Accept] Inside Recommended Card */}
            <Button
              type="button"
              onClick={() => handleAcceptProtocol("antagonist")}
              className={cn(
                "h-8 text-xs font-semibold gap-1.5 shadow-xs transition-all",
                selectedProtocolId === "antagonist"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              aria-label="Accept GnRH Antagonist Protocol"
            >
              {selectedProtocolId === "antagonist" ? (
                <>
                  <Check className="size-3.5" />
                  <span>Accepted (Active)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Accept Protocol</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Detailed Protocol Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-lg border border-border/70 bg-background/80 space-y-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5 text-2xs uppercase tracking-wider text-muted-foreground">
              <Calendar className="size-3 text-primary" /> Stimulation Initiation
            </span>
            <p className="text-foreground">{recommendedProto.stimulationStart}</p>
          </div>
          <div className="p-3 rounded-lg border border-border/70 bg-background/80 space-y-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5 text-2xs uppercase tracking-wider text-muted-foreground">
              <Pill className="size-3 text-primary" /> Pituitary Suppression
            </span>
            <p className="text-foreground">{recommendedProto.suppressionMechanism}</p>
          </div>
          <div className="p-3 rounded-lg border border-border/70 bg-background/80 space-y-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5 text-2xs uppercase tracking-wider text-muted-foreground">
              <HeartPulse className="size-3 text-primary" /> Ovulation Trigger
            </span>
            <p className="text-foreground">{recommendedProto.triggerOptions}</p>
          </div>
        </div>

        {/* Advantages & Disadvantages Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
          <div className="space-y-1.5">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-2xs uppercase tracking-wider block">
              Key Clinical Advantages
            </span>
            <ul className="space-y-1">
              {recommendedProto.advantages.map((adv, i) => (
                <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{adv}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <span className="font-semibold text-amber-700 dark:text-amber-300 text-2xs uppercase tracking-wider block">
              Clinical Considerations & Disadvantages
            </span>
            <ul className="space-y-1">
              {recommendedProto.disadvantages.map((dis, i) => (
                <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                  <Info className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>{dis}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 2 Alternative Protocols Side-by-Side */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Alternative Ovarian Stimulation Protocols
            </h3>
          </div>
          <span className="text-2xs text-muted-foreground">
            Side-by-side alternative clinical choices with dedicated indications
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Alternative Card A: Long GnRH Agonist */}
          <div
            className={cn(
              "rounded-xl border p-4 space-y-3 transition-all",
              selectedProtocolId === "long-agonist"
                ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm ring-1 ring-primary/30"
                : "border-border/80 bg-card hover:border-border",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <Badge
                  variant="outline"
                  className="text-2xs font-medium text-muted-foreground border-border"
                >
                  {longAgonistProto.badge}
                </Badge>
                <h4 className="text-base font-bold text-foreground">{longAgonistProto.name}</h4>
              </div>
              <Button
                type="button"
                size="sm"
                variant={selectedProtocolId === "long-agonist" ? "default" : "outline"}
                onClick={() => handleAcceptProtocol("long-agonist")}
                className="h-7 text-xs font-semibold gap-1.5 shadow-xs"
                aria-label="Select Long GnRH Agonist Protocol"
              >
                {selectedProtocolId === "long-agonist" ? (
                  <>
                    <Check className="size-3" />
                    <span>Selected</span>
                  </>
                ) : (
                  <span>Select Agonist</span>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Mid-luteal pituitary down-regulation followed by gonadotropin stimulation. Indicated
              for cycle programming or severe endometriosis/adenomyosis.
            </p>

            <div className="space-y-1.5 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mean Duration:</span>
                <span className="font-medium text-foreground">{longAgonistProto.durationDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OHSS Risk Rate:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {longAgonistProto.ohssRiskRate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fresh Transfer:</span>
                <span className="font-medium text-foreground">
                  {longAgonistProto.freshTransfer}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-semibold text-foreground text-2xs block">
                Primary Indications:
              </span>
              <ul className="space-y-0.5 text-muted-foreground">
                {longAgonistProto.indications.map((ind, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-primary">•</span>
                    <span>{ind}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Alternative Card B: Progestin-Primed Ovarian Stimulation (PPOS) */}
          <div
            className={cn(
              "rounded-xl border p-4 space-y-3 transition-all",
              selectedProtocolId === "ppos"
                ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm ring-1 ring-primary/30"
                : "border-border/80 bg-card hover:border-border",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <Badge
                  variant="outline"
                  className="text-2xs font-medium text-muted-foreground border-border"
                >
                  {pposProto.badge}
                </Badge>
                <h4 className="text-base font-bold text-foreground">{pposProto.name}</h4>
              </div>
              <Button
                type="button"
                size="sm"
                variant={selectedProtocolId === "ppos" ? "default" : "outline"}
                onClick={() => handleAcceptProtocol("ppos")}
                className="h-7 text-xs font-semibold gap-1.5 shadow-xs"
                aria-label="Select PPOS Protocol"
              >
                {selectedProtocolId === "ppos" ? (
                  <>
                    <Check className="size-3" />
                    <span>Selected</span>
                  </>
                ) : (
                  <span>Select PPOS</span>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Oral progestin administration starting Day 2/3 for complete suppression of premature
              LH surge without injectables. Requires obligate freeze-all.
            </p>

            <div className="space-y-1.5 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mean Duration:</span>
                <span className="font-medium text-foreground">{pposProto.durationDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OHSS Risk Rate:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {pposProto.ohssRiskRate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fresh Transfer:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {pposProto.freshTransfer}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-semibold text-foreground text-2xs block">
                Primary Indications:
              </span>
              <ul className="space-y-0.5 text-muted-foreground">
                {pposProto.indications.map((ind, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-primary">•</span>
                    <span>{ind}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Rationale Panel & Evidence Links */}
      <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <BookOpen className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            Clinical Rationale & Evidence Anchors
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <span className="font-semibold text-foreground block">
              Patient Stratification Synthesis:
            </span>
            <p className="text-muted-foreground leading-relaxed">
              Patient <strong className="text-foreground">{patient.name}</strong> (Age {patientAge},
              AMH {patientAmh} ng/mL, AFC {patientAfc}, BMI {patientBmi}) has been stratified under
              POSEIDON criteria as{" "}
              <strong className="text-foreground">
                {patientPoseidon === "Not Low Prognosis"
                  ? "Normal Ovarian Reserve"
                  : `POSEIDON Group ${patientPoseidon}`}
              </strong>
              .
            </p>
            <p className="text-muted-foreground leading-relaxed">
              The <strong className="text-foreground">GnRH Antagonist Protocol</strong> is
              prioritized because it offers the optimal benefit-to-risk ratio. It drastically
              reduces OHSS risk (RR 0.53) without sacrificing cumulative live birth rate or oocyte
              maturity. Should an exaggerated follicular response emerge, a GnRH agonist trigger or
              dual trigger can be safely deployed.
            </p>
          </div>

          <div className="space-y-2.5">
            <span className="font-semibold text-foreground block">
              Indexed Clinical Guidelines & Cochrane Systematic Reviews:
            </span>
            <div className="space-y-2">
              <a
                href="https://www.eshre.eu/Guidelines-and-Legal/Guidelines/Ovarian-Stimulation-in-IVF-ICSI"
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <ExternalLink className="size-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground block">
                    ESHRE 2025 Guideline on Ovarian Stimulation
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    Recommendations 1–4: GnRH antagonist is recommended over long agonist for safety
                    and OHSS prevention.
                  </span>
                </div>
              </a>

              <a
                href="https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD001750.pub4/full"
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <ExternalLink className="size-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground block">
                    Cochrane Review (2016): GnRH Antagonists vs Agonists
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    73 RCTs (n=12,212): Antagonist reduces severe OHSS from 8.9% to 5.1% with
                    equivalent live birth rate.
                  </span>
                </div>
              </a>

              <a
                href="https://www.asrm.org/practice-guidance/practice-committee-documents/prevention-of-moderate-and-severe-ovarian-hyperstimulation-syndrome-a-guideline-2016/"
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <ExternalLink className="size-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground block">
                    ASRM Practice Committee (2016): Prevention of OHSS
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    Recommends GnRH antagonist protocols and agonist triggers for patients at risk
                    of hyperresponse.
                  </span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Protocol Comparison Dialog ([Compare]) */}
      <Dialog open={compareModalOpen} onOpenChange={setCompareModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Columns className="size-5 text-primary" />
              <span>Side-by-Side Protocol Comparative Matrix</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Rigorous comparative review of evidence-anchored ovarian stimulation protocols per
              ESHRE 2025 and Cochrane guidelines.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto border border-border/70 rounded-lg text-xs mt-3">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/60 text-left border-b border-border/70">
                  <th className="p-2.5 font-semibold text-muted-foreground">Clinical Parameter</th>
                  <th className="p-2.5 font-semibold text-primary bg-primary/5">
                    GnRH Antagonist (Recommended)
                  </th>
                  <th className="p-2.5 font-semibold text-foreground">Long GnRH Agonist</th>
                  <th className="p-2.5 font-semibold text-foreground">PPOS (Oral Progestin)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="p-2.5 font-medium text-foreground">Suppression Mechanism</td>
                  <td className="p-2.5 bg-primary/5 text-foreground">
                    Competitive GnRH receptor blockade (Immediate)
                  </td>
                  <td className="p-2.5 text-muted-foreground">
                    Pituitary desensitization via down-regulation (10–14 days)
                  </td>
                  <td className="p-2.5 text-muted-foreground">
                    Hypothalamic-pituitary LH pulse suppression via oral progestin
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">Mean Stimulation Days</td>
                  <td className="p-2.5 bg-primary/5 font-semibold text-emerald-600 dark:text-emerald-400">
                    9 – 10 days
                  </td>
                  <td className="p-2.5 text-muted-foreground">11 – 13 days (+ 14 days down-reg)</td>
                  <td className="p-2.5 text-muted-foreground">10 – 11 days</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">Moderate / Severe OHSS Risk</td>
                  <td className="p-2.5 bg-primary/5 font-semibold text-emerald-600 dark:text-emerald-400">
                    1.2% (RR 0.53 vs Long)
                  </td>
                  <td className="p-2.5 font-semibold text-red-600 dark:text-red-400">
                    5.8% – 8.4% (Highest)
                  </td>
                  <td className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    1.1% (Low)
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">Agonist Trigger Rescue</td>
                  <td className="p-2.5 bg-primary/5 font-semibold text-emerald-600 dark:text-emerald-400">
                    Fully Compatible
                  </td>
                  <td className="p-2.5 font-semibold text-red-600 dark:text-red-400">
                    Contraindicated (Receptors Down-regulated)
                  </td>
                  <td className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    Fully Compatible
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">Fresh Embryo Transfer</td>
                  <td className="p-2.5 bg-primary/5 text-foreground">
                    Feasible (standard luteal support)
                  </td>
                  <td className="p-2.5 text-foreground">Feasible (standard luteal support)</td>
                  <td className="p-2.5 font-semibold text-amber-600 dark:text-amber-400">
                    Contraindicated (Mandatory Freeze-All)
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">Cumulative Live Birth Rate</td>
                  <td className="p-2.5 bg-primary/5 font-semibold text-foreground">
                    Equivalent (Cochrane 2016)
                  </td>
                  <td className="p-2.5 text-foreground">Equivalent baseline benchmark</td>
                  <td className="p-2.5 text-foreground">Equivalent in freeze-all cohorts</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-medium text-foreground">Evidence Level</td>
                  <td className="p-2.5 bg-primary/5 font-bold text-primary">
                    Level 1A (High Quality)
                  </td>
                  <td className="p-2.5 font-medium text-muted-foreground">
                    Level 1A (High Quality)
                  </td>
                  <td className="p-2.5 font-medium text-muted-foreground">
                    Level 1B (Moderate Quality)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCompareModalOpen(false)}
              className="text-xs"
            >
              Close Comparison
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Clinical Override Dialog ([Override]) */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-400">
              <ShieldAlert className="size-5 shrink-0" />
              <span>Clinical Protocol Override Authorization</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Overriding the ESHRE 2025 first-line recommendation requires a documented clinical
              justification (minimum 20 characters) and is cryptographically recorded in the SHA-256
              audit chain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">
                Select Alternative Protocol
              </label>
              <select
                value={overrideProtocolId}
                onChange={(e) => setOverrideProtocolId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="long-agonist">Long GnRH Agonist Protocol</option>
                <option value="ppos">Progestin-Primed Ovarian Stimulation (PPOS)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground">
                  Clinical Rationale (Mandatory min 20 chars)
                </label>
                <span
                  className={cn(
                    "text-2xs font-mono",
                    overrideReason.trim().length >= 20
                      ? "text-emerald-600 font-bold"
                      : "text-amber-600",
                  )}
                >
                  {overrideReason.trim().length} / 20 chars
                </span>
              </div>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Document clinical indication for overriding first-line antagonist protocol (e.g. severe stage IV endometriosis, scheduled freeze-all cycle, previous premature luteinization)..."
                rows={4}
                className="text-xs resize-none"
              />
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-2xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold block">Audit Governance Notice:</span>
              This action will be signed with treating physician credentials (Dr. Raouf Roshdy) and
              appended to the immutable local audit chain.
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
              onClick={handleConfirmOverride}
              disabled={overrideReason.trim().length < 20}
              className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              <Activity className="size-3.5" />
              <span>Confirm & Log Override</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
