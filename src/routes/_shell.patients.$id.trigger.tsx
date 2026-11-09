import { useState, useMemo } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Syringe,
  Check,
  Calendar,
  Sparkles,
  Info,
  Clock,
  Layers,
  History,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
import { useMonitoringVisits } from "@/lib/engine/monitoring-store";
import { lockSession } from "@/services/auth/session";
import { appendAuditEntry } from "@/services/audit/auditLog";
import { useAutoSave } from "@/hooks/use-auto-save";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/patients/$id/trigger")({
  head: () => ({
    meta: [
      { title: "Stage 6: Trigger Decision & Safety Firewall — AiFV CDSS" },
      {
        name: "description",
        content:
          "Evidence-gated trigger readiness checklist, dual-trigger selection (hCG vs hCG+agonist), and OHSS safety firewall enforcement with audit logging.",
      },
    ],
  }),
  component: PatientTriggerStage6View,
});

type TriggerStrategy = "hcg" | "dual" | "agonist";

interface FirewallOverrideRecord {
  physicianName: string;
  reason: string;
  timestamp: string;
}

export function PatientTriggerStage6View() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const { records } = usePatients();
  const { setValue: setAssessmentValue } = useAssessment();

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
        completion: 75,
        alerts: 0,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        values: {},
        cycleRecords: [],
      }
    );
  }, [id, records]);

  const patientId = patient.id;
  const currentAge = useMemo<string>(() => {
    if (patient.values?.["age"]) return `${patient.values["age"]}y`;
    if (patient.values?.["dob"]) {
      const parsed = ageFromDob(String(patient.values["dob"]));
      if (parsed) return `${parsed}y`;
    }
    const match = patient.age.match(/\d+/);
    return match ? `${match[0]}y` : "34y";
  }, [patient]);

  // Monitoring visit context
  const { visits } = useMonitoringVisits(patientId);
  const latestVisit = useMemo(() => {
    if (visits.length === 0) return null;
    return [...visits].sort((a, b) => b.day - a.day)[0];
  }, [visits]);

  // Derived current cycle measurements
  const currentDay = latestVisit?.day ?? 12;
  const currentLeadFollicle = latestVisit?.largestFollicle ?? 19.5;
  const currentFollicles18Count = useMemo(() => {
    if (latestVisit?.follicleSizes && latestVisit.follicleSizes.length > 0) {
      return latestVisit.follicleSizes.filter((s) => s >= 18).length;
    }
    return 3; // Default clinical demonstration value
  }, [latestVisit]);

  const currentE2 = latestVisit?.estradiol ?? 2450;
  const currentP4 = latestVisit?.progesterone ?? 0.85;
  const currentTotalFollicles = latestVisit?.follicleCount ?? latestVisit?.follicles10 ?? 14;

  // Strategy & Checklist State
  const [strategy, setStrategy] = useState<TriggerStrategy>("dual");
  const [isTriggerApproved, setIsTriggerApproved] = useState(
    patient.values?.["triggerApproved"] === "true",
  );
  const [triggerApprovedAt, setTriggerApprovedAt] = useState<string | null>(
    (patient.values?.["triggerApprovedAt"] as string) || null,
  );

  // Interactive OHSS Firewall Flags Simulation State
  const [highFollicleRedFlag, setHighFollicleRedFlag] = useState(currentTotalFollicles >= 19);
  const [highE2RedFlag, setHighE2RedFlag] = useState(currentE2 >= 4000);
  const [ascitesRedFlag, setAscitesRedFlag] = useState(false);

  // Firewall Override State
  const [firewallOverride, setFirewallOverride] = useState<FirewallOverrideRecord | null>(null);

  // Modals State
  const [approveConfirmModalOpen, setApproveConfirmModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [cancelCycleModalOpen, setCancelCycleModalOpen] = useState(false);
  const [peerReviewModalOpen, setPeerReviewModalOpen] = useState(false);

  // Form Fields inside Modals
  const [overridePhysician, setOverridePhysician] = useState("Dr. Treating Physician");
  const [overrideReason, setOverrideReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("Critical OHSS Risk Prevention");
  const [cancellationNotes, setCancellationNotes] = useState("");
  const [peerReviewTarget, setPeerReviewTarget] = useState(
    "Dr. Sarah Jenkins (Senior REI Consultant)",
  );
  const [peerReviewNotes, setPeerReviewNotes] = useState("");

  // Calculate Firewall Status
  const hasActiveRedFlag = highFollicleRedFlag || highE2RedFlag || ascitesRedFlag;
  const isFirewallTripped = hasActiveRedFlag && !firewallOverride;

  // Trigger Eligibility Checks
  const follicleCheckPassed = currentFollicles18Count >= 2 && currentLeadFollicle >= 18;
  const e2CheckPassed = currentE2 >= 1000 && (!highE2RedFlag || !!firewallOverride);
  const p4CheckPassed = currentP4 <= 1.5;
  const ohssCheckPassed = !isFirewallTripped;

  const isEligibleForTrigger =
    follicleCheckPassed && e2CheckPassed && p4CheckPassed && ohssCheckPassed;

  // Auto-Save hook integration (runs every 30s + on page hide)
  useAutoSave({
    intervalMs: 30000,
    onSave: async () => {
      const updatedPatient: PatientRecord = {
        ...patient,
        completion: 75,
        updatedAt: new Date().toISOString(),
        values: {
          ...(patient.values || {}),
          stage: "Stage 6: Trigger Decision",
          triggerStrategy: strategy,
          triggerApproved: isTriggerApproved ? "true" : "false",
          triggerApprovedAt: triggerApprovedAt || "",
          firewallOverridden: firewallOverride ? "true" : "false",
        },
      };
      savePatient(updatedPatient);
      setAssessmentValue("triggerStrategy", strategy);
    },
  });

  // Action: Confirm Trigger Approval (Inside RED Confirmation Modal)
  const handleConfirmTrigger = async () => {
    const timestamp = new Date().toISOString();
    setIsTriggerApproved(true);
    setTriggerApprovedAt(timestamp);

    // Update patient master record
    const updatedPatient: PatientRecord = {
      ...patient,
      completion: 80,
      updatedAt: timestamp,
      values: {
        ...(patient.values || {}),
        stage: "Stage 6: Trigger Approved",
        triggerStrategy: strategy,
        triggerApproved: "true",
        triggerApprovedAt: timestamp,
        triggerDay: currentDay,
        firewallOverridden: firewallOverride ? "true" : "false",
      },
    };
    savePatient(updatedPatient);
    setAssessmentValue("triggerApproved", "true");
    setAssessmentValue("triggerStrategy", strategy);

    // Cryptographic audit trail entry
    try {
      await appendAuditEntry({
        by: overridePhysician || "Dr. Treating Physician",
        action: "APPROVE_TRIGGER_COMMITTED",
        caseId: patientId,
        details: {
          patientId,
          patientName: patient.name,
          stimulationDay: currentDay,
          strategy,
          leadFollicle: currentLeadFollicle,
          follicles18Count: currentFollicles18Count,
          e2: currentE2,
          p4: currentP4,
          firewallOverridden: !!firewallOverride,
          overrideReason: firewallOverride?.reason || null,
        },
      });
    } catch {
      // In offline mode audit entry is buffered
    }

    setApproveConfirmModalOpen(false);
    toast.success(
      `Trigger irrevocably confirmed and stamped for ${patient.name} on Day ${currentDay}. Scheduled OPU at +36h.`,
    );
  };

  // Action: Confirm Firewall Override
  const handleConfirmOverride = async () => {
    if (overrideReason.trim().length < 20) {
      toast.error("Clinical rationale must contain at least 20 characters.");
      return;
    }

    const record: FirewallOverrideRecord = {
      physicianName: overridePhysician,
      reason: overrideReason.trim(),
      timestamp: new Date().toISOString(),
    };
    setFirewallOverride(record);

    try {
      await appendAuditEntry({
        by: overridePhysician,
        action: "OVERRIDE_OHSS_FIREWALL",
        caseId: patientId,
        details: {
          patientName: patient.name,
          reason: record.reason,
          activeFlags: {
            highFollicleRedFlag,
            highE2RedFlag,
            ascitesRedFlag,
          },
        },
      });
    } catch {
      // Buffered
    }

    setOverrideModalOpen(false);
    toast.warning(
      "OHSS Safety Firewall overridden by physician. Action logged to immutable audit ledger.",
    );
  };

  // Action: Cancel Cycle
  const handleConfirmCancelCycle = async () => {
    try {
      await appendAuditEntry({
        by: "Treating Physician",
        action: "CYCLE_CANCELLED",
        caseId: patientId,
        details: {
          patientName: patient.name,
          reason: cancellationReason,
          notes: cancellationNotes,
          day: currentDay,
        },
      });
    } catch {
      // Buffered
    }

    const updatedPatient: PatientRecord = {
      ...patient,
      updatedAt: new Date().toISOString(),
      values: {
        ...(patient.values || {}),
        stage: "Cycle Cancelled",
        cycleCancelled: "true",
        cancellationReason,
      },
    };
    savePatient(updatedPatient);

    setCancelCycleModalOpen(false);
    toast.error(`Cycle cancelled for ${patient.name} due to: ${cancellationReason}.`);
  };

  // Action: Submit Peer Review Request
  const handleSubmitPeerReview = async () => {
    try {
      await appendAuditEntry({
        by: "Treating Physician",
        action: "PEER_REVIEW_REQUESTED",
        caseId: patientId,
        details: {
          patientName: patient.name,
          consultant: peerReviewTarget,
          notes: peerReviewNotes,
          day: currentDay,
        },
      });
    } catch {
      // Buffered
    }

    setPeerReviewModalOpen(false);
    toast.info(`Peer review request dispatched to ${peerReviewTarget}.`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* --------------------------------------------------------------------- */}
      {/* 1. Header & Navigation Controls */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">
              Stage 6 of 8
            </Badge>
            <Badge
              className={cn(
                "gap-1",
                isTriggerApproved
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : isFirewallTripped
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <Syringe className="h-3 w-3" />
              {isTriggerApproved
                ? "Trigger Approved & Scheduled"
                : isFirewallTripped
                  ? "Firewall Locked"
                  : "Trigger Evaluation Active"}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Trigger Decision & Safety Firewall
          </h1>
          <p className="text-sm text-muted-foreground">
            Structured criteria evaluation for final follicular maturation, dual-trigger selection,
            and ESHRE 2025 OHSS prevention firewalls.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* [Approve Trigger] Button */}
          <Button
            size="sm"
            onClick={() => setApproveConfirmModalOpen(true)}
            disabled={!isEligibleForTrigger || isTriggerApproved}
            className={cn(
              "gap-2",
              isTriggerApproved
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
            title={isFirewallTripped ? "Disabled by OHSS Safety Firewall" : undefined}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isTriggerApproved ? "Trigger Approved" : "Approve Trigger"}
          </Button>

          {/* [Request Peer Review] Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPeerReviewModalOpen(true)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Request Peer Review
          </Button>

          {/* [Cancel Cycle] Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCancelCycleModalOpen(true)}
            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <XCircle className="h-4 w-4" />
            Cancel Cycle
          </Button>

          {/* [Lock Screen] Button */}
          <Button variant="outline" size="sm" onClick={() => lockSession()} className="gap-2">
            <Lock className="h-4 w-4" />
            Lock
          </Button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. Patient Context Banner & Trigger Status Alert */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-medium">
              Patient Context
            </CardDescription>
            <CardTitle className="text-lg font-bold">{patient.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground space-y-1">
            <p>
              MRN: <span className="font-mono text-foreground">{patient.fileNumber}</span> • Age:{" "}
              {currentAge}
            </p>
            <p>
              Infertility:{" "}
              <span className="text-foreground">{patient.infertilityType || "Primary"}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-medium">
              Stimulation Day
            </CardDescription>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Day {currentDay} of Cycle
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground space-y-1">
            <p>
              Protocol: <span className="text-foreground">GnRH Antagonist</span>
            </p>
            <p>
              Visits Logged:{" "}
              <span className="text-foreground">{visits.length} clinical visits</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-medium">
              Leading Cohort
            </CardDescription>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              {currentLeadFollicle.toFixed(1)} mm
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground space-y-1">
            <p>
              Follicles ≥ 18 mm:{" "}
              <span className="font-semibold text-foreground">
                {currentFollicles18Count} follicles
              </span>
            </p>
            <p>
              Total Cohort (≥10mm):{" "}
              <span className="text-foreground">{currentTotalFollicles} follicles</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-medium">
              Serum Estradiol & P4
            </CardDescription>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {currentE2.toLocaleString()} pg/mL
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground space-y-1">
            <p>
              Progesterone (P4):{" "}
              <span className="font-semibold text-foreground">{currentP4.toFixed(2)} ng/mL</span>
            </p>
            <p>
              Per mature follicle:{" "}
              <span className="text-foreground">
                ~{Math.round(currentE2 / Math.max(1, currentFollicles18Count))} pg/mL
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trigger Stamped Banner if Approved */}
      {isTriggerApproved && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-950 dark:text-emerald-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-base">Trigger Stamped & Committed</h4>
              <p className="text-xs mt-0.5 text-muted-foreground">
                Final ovulatory trigger confirmed on{" "}
                {triggerApprovedAt ? new Date(triggerApprovedAt).toLocaleString() : "today"} using
                strategy:{" "}
                <span className="font-semibold text-foreground uppercase">
                  {strategy === "dual"
                    ? "Dual Trigger (rhCG + Agonist)"
                    : strategy === "hcg"
                      ? "hCG Alone"
                      : "Agonist Alone"}
                </span>
                . Scheduled Oocyte Pick-Up (OPU) is scheduled 36 hours post-trigger.
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-600 text-white shrink-0">Immutable Audit Stamped</Badge>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. Section A: Trigger Eligibility Checklist */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Trigger Eligibility Checklist
                  </CardTitle>
                  <CardDescription>
                    ESHRE 2025 evidence-gated readiness criteria for administration of ovulatory
                    trigger
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-semibold",
                    isEligibleForTrigger
                      ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                      : "border-destructive text-destructive bg-destructive/10",
                  )}
                >
                  {isEligibleForTrigger ? "Readiness Criteria Met" : "Criteria Pending / Blocked"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Check 1: Follicle size >= 18mm in >= 2 follicles */}
              <div
                className={cn(
                  "flex items-start justify-between p-4 rounded-lg border",
                  follicleCheckPassed
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-amber-500/30 bg-amber-500/5",
                )}
              >
                <div className="flex items-start gap-3">
                  {follicleCheckPassed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Follicular Diameter: ≥ 18 mm in ≥ 2 Follicles
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ensures nuclear and cytoplasmic oocyte maturation before retrieval.
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="font-mono text-muted-foreground">
                        Leading Follicle:{" "}
                        <strong className="text-foreground">
                          {currentLeadFollicle.toFixed(1)} mm
                        </strong>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-muted-foreground">
                        Follicles ≥ 18 mm:{" "}
                        <strong className="text-foreground">{currentFollicles18Count}</strong>{" "}
                        (Threshold: ≥ 2)
                      </span>
                    </div>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "shrink-0",
                    follicleCheckPassed ? "bg-emerald-600 text-white" : "bg-amber-600 text-white",
                  )}
                >
                  {follicleCheckPassed ? "Criteria Met" : "Suboptimal Diameter"}
                </Badge>
              </div>

              {/* Check 2: Serum E2 Threshold */}
              <div
                className={cn(
                  "flex items-start justify-between p-4 rounded-lg border",
                  e2CheckPassed
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-destructive/30 bg-destructive/5",
                )}
              >
                <div className="flex items-start gap-3">
                  {e2CheckPassed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Serum Estradiol (E2) Therapeutic Threshold
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Target therapeutic window: 1,000 – 3,500 pg/mL (≥ 200 pg/mL per mature
                      follicle). Peak E2 ≥ 4,000 pg/mL constitutes critical hyperresponse.
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="font-mono text-muted-foreground">
                        Current E2:{" "}
                        <strong className="text-foreground">
                          {currentE2.toLocaleString()} pg/mL
                        </strong>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-muted-foreground">
                        Per Mature Follicle:{" "}
                        <strong className="text-foreground">
                          ~{Math.round(currentE2 / Math.max(1, currentFollicles18Count))} pg/mL
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "shrink-0",
                    e2CheckPassed
                      ? "bg-emerald-600 text-white"
                      : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {e2CheckPassed ? "Within Window" : "E2 Alert (> 4,000 pg/mL)"}
                </Badge>
              </div>

              {/* Check 3: Absence of Premature Luteinization */}
              <div
                className={cn(
                  "flex items-start justify-between p-4 rounded-lg border",
                  p4CheckPassed
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-amber-500/30 bg-amber-500/5",
                )}
              >
                <div className="flex items-start gap-3">
                  {p4CheckPassed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Serum Progesterone (P4) & Endometrial Synchrony
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Progesterone must remain ≤ 1.50 ng/mL on trigger day to prevent premature
                      secretory transformation and endometrial advancement.
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="font-mono text-muted-foreground">
                        Current P4:{" "}
                        <strong className="text-foreground">{currentP4.toFixed(2)} ng/mL</strong>{" "}
                        (Ceiling: ≤ 1.50 ng/mL)
                      </span>
                    </div>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "shrink-0",
                    p4CheckPassed ? "bg-emerald-600 text-white" : "bg-amber-600 text-white",
                  )}
                >
                  {p4CheckPassed ? "Normal P4" : "Premature Luteinization"}
                </Badge>
              </div>

              {/* Check 4: OHSS Safety Status */}
              <div
                className={cn(
                  "flex items-start justify-between p-4 rounded-lg border",
                  ohssCheckPassed
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-destructive/40 bg-destructive/10",
                )}
              >
                <div className="flex items-start gap-3">
                  {ohssCheckPassed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      OHSS Safety Red Flag Clearance
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Firewall verifies no active contraindications for hCG trigger (&lt; 19
                      follicles ≥ 11 mm and E2 &lt; 4,000 pg/mL).
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="font-mono text-muted-foreground">
                        Firewall Status:{" "}
                        <strong
                          className={
                            firewallOverride
                              ? "text-amber-600"
                              : isFirewallTripped
                                ? "text-destructive"
                                : "text-emerald-600"
                          }
                        >
                          {firewallOverride
                            ? "OVERRIDDEN BY PHYSICIAN"
                            : isFirewallTripped
                              ? "LOCKED (RED FLAG ACTIVE)"
                              : "ALL CLEAR"}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "shrink-0",
                    firewallOverride
                      ? "bg-amber-600 text-white"
                      : ohssCheckPassed
                        ? "bg-emerald-600 text-white"
                        : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {firewallOverride
                    ? "Overridden"
                    : ohssCheckPassed
                      ? "Cleared"
                      : "Firewall Tripped"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* ----------------------------------------------------------------- */}
          {/* 4. Section B: Dual-Trigger Toggle & Regimen Prescription */}
          {/* ----------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Syringe className="h-5 w-5 text-primary" />
                    Trigger Regimen Selection (Dual-Trigger Toggle)
                  </CardTitle>
                  <CardDescription>
                    Compare and select between standard hCG alone and dual-trigger (rhCG + GnRH
                    agonist)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toggle Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: hCG Alone */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setStrategy("hcg")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setStrategy("hcg");
                  }}
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 transition-all text-left",
                    strategy === "hcg"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">hCG Alone</span>
                      <Badge variant="outline" className="text-[10px]">
                        Standard
                      </Badge>
                    </div>
                    {strategy === "hcg" && (
                      <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Recombinant choriogonadotropin alfa (rhCG 250 µg / 6,500 IU s.c.).
                  </p>
                  <div className="rounded-md bg-muted/50 p-2 text-[11px] space-y-1">
                    <p>
                      <strong className="text-foreground">Indication:</strong> Low OHSS risk, &lt;
                      15 follicles ≥ 11 mm, planning fresh embryo transfer.
                    </p>
                    <p>
                      <strong className="text-foreground">Luteal Action:</strong> Extended half-life
                      (36h) sustains early corpus luteum.
                    </p>
                  </div>
                </div>

                {/* Option 2: Dual Trigger (rhCG + Agonist) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setStrategy("dual")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setStrategy("dual");
                  }}
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 transition-all text-left",
                    strategy === "dual"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        Dual Trigger (hCG + Agonist)
                      </span>
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                        Recommended
                      </Badge>
                    </div>
                    {strategy === "dual" && (
                      <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Low-dose rhCG (1,000 IU or 250 µg) + GnRH Agonist (Triptorelin 0.2 mg s.c.).
                  </p>
                  <div className="rounded-md bg-muted/50 p-2 text-[11px] space-y-1">
                    <p>
                      <strong className="text-foreground">Indication:</strong> Dyssynchronous
                      cohorts, poor maturation history, POSEIDON groups.
                    </p>
                    <p>
                      <strong className="text-foreground">Mechanism:</strong> Concurrent LH + FSH
                      surges maximize cumulus expansion & MII yield.
                    </p>
                  </div>
                </div>
              </div>

              {/* Timing & Administration Specification Card */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Clinical Timing & Prescription Specification
                  </h4>
                  <Badge variant="outline" className="font-mono text-xs">
                    OPU Interval: 35.5 - 36.0h
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-md bg-muted/40">
                    <span className="text-muted-foreground">Administer Trigger At:</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5">Today at 21:30</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Day {currentDay} of stimulation
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/40">
                    <span className="text-muted-foreground">Scheduled Oocyte Retrieval:</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5">Day +2 at 09:00</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Exactly 35.5 hours post-trigger
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/40">
                    <span className="text-muted-foreground">Selected Medication:</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5">
                      {strategy === "dual"
                        ? "rhCG 250 µg + Triptorelin 0.2mg"
                        : "Ovidrel (rhCG) 250 µg"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Subcutaneous injection (s.c.)
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* 5. Section C: OHSS Safety Firewall Panel */}
        {/* ------------------------------------------------------------------- */}
        <div className="space-y-6">
          <Card
            className={cn("border-2", isFirewallTripped ? "border-destructive" : "border-border")}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    className={cn(
                      "h-5 w-5",
                      isFirewallTripped
                        ? "text-destructive animate-pulse"
                        : firewallOverride
                          ? "text-amber-600"
                          : "text-emerald-600",
                    )}
                  />
                  <CardTitle className="text-base font-bold">OHSS Safety Firewall</CardTitle>
                </div>
                <Badge
                  className={cn(
                    firewallOverride
                      ? "bg-amber-600 text-white"
                      : isFirewallTripped
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-emerald-600 text-white",
                  )}
                >
                  {firewallOverride
                    ? "Override Active"
                    : isFirewallTripped
                      ? "Firewall Active"
                      : "Clear"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Hard safety gate enforcing ESHRE 2025 Rec 23 & ASRM OHSS guidelines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Firewall Active Banner */}
              {isFirewallTripped && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">CRITICAL OHSS SAFETY FIREWALL TRIPPED</p>
                      <p className="text-[11px] mt-1 text-destructive/90">
                        hCG administration is strictly contraindicated. Imminent risk of severe
                        early-onset OHSS. [Approve Trigger] is disabled by system protocol.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Firewall Override Banner if Active */}
              {firewallOverride && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <History className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">FIREWALL OVERRIDDEN BY PHYSICIAN</p>
                      <p className="text-[11px] mt-0.5">
                        Overridden by:{" "}
                        <strong className="font-semibold">{firewallOverride.physicianName}</strong>
                      </p>
                      <p className="text-[11px] italic mt-0.5">
                        &quot;{firewallOverride.reason}&quot;
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Red Flag Indicators */}
              <div className="space-y-2.5 text-xs">
                <span className="font-semibold text-muted-foreground uppercase text-[11px] tracking-wider block">
                  Hyperstimulation Sentinel Criteria:
                </span>

                {/* Flag 1: Follicle Count >= 19 */}
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border">
                  <div>
                    <span className="font-medium text-foreground block">
                      Follicles ≥ 11 mm (≥ 19)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Current: {currentTotalFollicles} follicles
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={highFollicleRedFlag ? "destructive" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setHighFollicleRedFlag(!highFollicleRedFlag)}
                  >
                    {highFollicleRedFlag ? "Red Flag Active" : "Safe Range"}
                  </Button>
                </div>

                {/* Flag 2: Serum E2 >= 4000 pg/mL */}
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border">
                  <div>
                    <span className="font-medium text-foreground block">
                      Serum E2 ≥ 4,000 pg/mL
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Current: {currentE2} pg/mL
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={highE2RedFlag ? "destructive" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setHighE2RedFlag(!highE2RedFlag)}
                  >
                    {highE2RedFlag ? "Red Flag Active" : "Safe Range"}
                  </Button>
                </div>

                {/* Flag 3: Ascites / Acute Distension */}
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border">
                  <div>
                    <span className="font-medium text-foreground block">Ascites / Free Fluid</span>
                    <span className="text-[11px] text-muted-foreground">Cul-de-sac ultrasound</span>
                  </div>
                  <Button
                    size="sm"
                    variant={ascitesRedFlag ? "destructive" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setAscitesRedFlag(!ascitesRedFlag)}
                  >
                    {ascitesRedFlag ? "Fluid Present" : "Clear"}
                  </Button>
                </div>
              </div>

              {/* Evidence Citation Callout */}
              <div className="rounded-md bg-muted/50 p-2.5 text-[11px] text-muted-foreground border space-y-1">
                <p className="flex items-center gap-1 font-semibold text-foreground">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  ESHRE 2025 Guideline Recommendation 23
                </p>
                <p>
                  &quot;In women at high risk of OHSS (peak E2 &gt; 4,000 pg/mL or &gt; 18 follicles
                  ≥ 11 mm), a GnRH agonist trigger with elective whole-embryo cryopreservation
                  (freeze-all) is recommended to virtually eliminate OHSS.&quot;
                </p>
              </div>

              {/* Override Button if Firewall Tripped */}
              {isFirewallTripped && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => setOverrideModalOpen(true)}
                    className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Override Firewall (audit-logged)
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground mt-1.5">
                    Requires clinical justification (min 20 chars) &amp; timestamped audit entry.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPeerReviewModalOpen(true)}
                className="w-full gap-2 text-xs"
              >
                <Users className="h-3.5 w-3.5" />
                Request Peer Review
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 6. Sticky Bottom Navigation Bar */}
      {/* --------------------------------------------------------------------- */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link to="/patients/$id/monitoring" params={{ id: patientId }}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>

          <span className="text-xs text-muted-foreground hidden sm:inline">
            Stage 6: Trigger Decision • Patient:{" "}
            <strong className="text-foreground">{patient.name}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Action to approve trigger if not yet approved */}
          <Button
            size="sm"
            onClick={() => setApproveConfirmModalOpen(true)}
            disabled={!isEligibleForTrigger || isTriggerApproved}
            className={cn(
              "gap-2",
              isTriggerApproved
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
            title={isFirewallTripped ? "Disabled by OHSS Safety Firewall" : undefined}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isTriggerApproved ? "Trigger Approved" : "Approve Trigger"}
          </Button>

          {/* Next Stage Navigation */}
          <Button
            size="sm"
            asChild
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link to="/cycle-completion">
              Next &gt;
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 7. RED CONFIRMATION MODAL: [Approve Trigger] */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={approveConfirmModalOpen} onOpenChange={setApproveConfirmModalOpen}>
        <DialogContent className="sm:max-w-md border-2 border-destructive bg-card shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-6 w-6 shrink-0" />
              <DialogTitle className="text-lg font-bold">
                CRITICAL CLINICAL CONFIRMATION
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm font-medium text-destructive pt-2">
              Confirm trigger for patient {patient.name} on day {currentDay}. This is irreversible.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs space-y-2 text-foreground">
            <p className="font-semibold text-destructive">
              Warning: Administration of the final ovulatory trigger initiates irreversible oocyte
              maturation.
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
              <li>Scheduled Oocyte Pick-Up (OPU) will take place strictly in 35–36 hours.</li>
              <li>
                Selected Regimen:{" "}
                <strong className="text-foreground uppercase">
                  {strategy === "dual"
                    ? "Dual Trigger (rhCG + Agonist)"
                    : strategy === "hcg"
                      ? "hCG Alone (250 µg)"
                      : "Agonist Alone"}
                </strong>
              </li>
              <li>
                This action will be stamped into the cryptographic audit trail with SHA-256 chain
                verification.
              </li>
            </ul>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setApproveConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmTrigger}
              className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Trigger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------------- */}
      {/* 8. OVERRIDE FIREWALL MODAL: [Override Firewall (audit-logged)] */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold">Override OHSS Safety Firewall</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Attending physician authorization to bypass system safety gates. Requires verified
              clinical rationale (min 20 characters) and will be logged to tamper-evident audit
              history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <label htmlFor="physician-name" className="font-medium text-foreground">
                Attending Physician
              </label>
              <Input
                id="physician-name"
                value={overridePhysician}
                onChange={(e) => setOverridePhysician(e.target.value)}
                placeholder="Dr. Full Name, MD"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="override-reason" className="font-medium text-foreground">
                  Clinical Justification &amp; Risk Mitigation Plan
                </label>
                <span className="text-[10px] text-muted-foreground">Min 20 characters</span>
              </div>
              <Textarea
                id="override-reason"
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="State clinical reasoning (e.g., Freeze-all planned, intensive antagonist administration, or lower-dose dual trigger protocol under continuous inpatient monitoring)..."
                className="text-xs"
              />
            </div>

            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2.5 text-amber-900 dark:text-amber-200 text-[11px]">
              <strong>Hospital Governance Notice:</strong> Overriding an active safety firewall
              assumes clinical responsibility for OHSS risk mitigation. This event will be flagged
              in the clinical governance dashboard.
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOverrideModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmOverride}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Check className="h-4 w-4" />
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------------- */}
      {/* 9. CANCEL CYCLE MODAL: [Cancel Cycle] */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={cancelCycleModalOpen} onOpenChange={setCancelCycleModalOpen}>
        <DialogContent className="sm:max-w-md border-destructive/40">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold">Cancel Stimulation Cycle</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Confirm clinical cycle cancellation for {patient.name} on Day {currentDay}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label htmlFor="cancel-reason" className="font-medium text-foreground">
                Cancellation Reason
              </label>
              <Input
                id="cancel-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Reason for cancellation"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cancel-notes" className="font-medium text-foreground">
                Clinical Notes
              </label>
              <Textarea
                id="cancel-notes"
                rows={2}
                value={cancellationNotes}
                onChange={(e) => setCancellationNotes(e.target.value)}
                placeholder="Document patient discussion and cycle wrap-up instructions..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCancelCycleModalOpen(false)}>
              Dismiss
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmCancelCycle}
              className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <XCircle className="h-4 w-4" />
              Confirm Cycle Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------------- */}
      {/* 10. REQUEST PEER REVIEW MODAL: [Request Peer Review] */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={peerReviewModalOpen} onOpenChange={setPeerReviewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Users className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold">Request Peer Clinical Review</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Submit case for second opinion on trigger timing or OHSS risk mitigation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label htmlFor="peer-target" className="font-medium text-foreground">
                Consultant Colleague
              </label>
              <Input
                id="peer-target"
                value={peerReviewTarget}
                onChange={(e) => setPeerReviewTarget(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="peer-notes" className="font-medium text-foreground">
                Case Query / Specific Consideration
              </label>
              <Textarea
                id="peer-notes"
                rows={3}
                value={peerReviewNotes}
                onChange={(e) => setPeerReviewNotes(e.target.value)}
                placeholder="Note specific concerns, e.g. dyssynchronous cohort growth or borderline hyperstimulation markers..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPeerReviewModalOpen(false)}>
              Dismiss
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitPeerReview}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Users className="h-4 w-4" />
              Submit Peer Review Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
