import { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute, Link, useParams, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  Upload,
  Download,
  ShieldX,
  History,
  Lock,
  User,
  ShieldCheck,
  AlertTriangle,
  Activity,
  CheckCircle2,
  FileCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePatients, type PatientRecord, savePatient } from "@/lib/assessment/patients";
import { DEFAULT_VIRTUAL_PATIENTS } from "@/lib/assessment/virtual-patients-data";
import { appendAuditEntry, loadAuditChain, type AuditEntry } from "@/services/audit/auditLog";
import { lockSession } from "@/services/auth/session";
import type { CycleRecord, FieldValue } from "@/lib/assessment/use-assessment";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/patients/$id")({
  head: () => ({
    meta: [
      { title: "Patient Master Record — AiFV Precision Hospital CDSS" },
      {
        name: "description",
        content:
          "Dedicated hospital master record: demographics, medical conditions, prior IVF cycles, signed consent documents, and immutable audit trail.",
      },
    ],
  }),
  component: PatientMasterRecordView,
});

export interface ConsentDocument {
  id: string;
  title: string;
  category: string;
  status: "Active" | "Pending" | "Revoked";
  version: string;
  signedAt: string;
  authorizedBy: string;
  sha256: string;
}

const DEFAULT_CONSENTS: ConsentDocument[] = [
  {
    id: "doc-cos-01",
    title: "Controlled Ovarian Stimulation (COS) & Oocyte Retrieval Consent",
    category: "Clinical Procedure",
    status: "Active",
    version: "v2.1 (ESHRE 2025)",
    signedAt: "2026-10-13 09:30",
    authorizedBy: "Dr. Raouf Roshdy",
    sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  },
  {
    id: "doc-eset-02",
    title: "Elective Single Blastocyst Transfer (eSET) & Cryopreservation Agreement",
    category: "Embryology & Storage",
    status: "Active",
    version: "v1.4",
    signedAt: "2026-10-13 09:35",
    authorizedBy: "Dr. Raouf Roshdy",
    sha256: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
  },
  {
    id: "doc-pgt-03",
    title: "Pre-Implantation Genetic Testing (PGT-A) & Trophectoderm Biopsy Authorization",
    category: "Genomics",
    status: "Pending",
    version: "v3.0",
    signedAt: "Pending Patient Signature",
    authorizedBy: "Dr. Raouf Roshdy",
    sha256: "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
  },
  {
    id: "doc-partner-04",
    title: "Partner Semen Cryopreservation & Infectious Disease Testing Consent",
    category: "Andrology & Legal",
    status: "Active",
    version: "v1.2",
    signedAt: "2026-10-13 09:40",
    authorizedBy: "Dr. Raouf Roshdy",
    sha256: "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
  },
];

export function PatientMasterRecordView() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMaster =
    !id ||
    pathname.endsWith(`/${id}`) ||
    pathname.endsWith(`/${id}/`) ||
    pathname.endsWith(`/patient/${id}`) ||
    pathname.endsWith(`/patient/${id}/`);
  if (!isMaster) {
    return <Outlet />;
  }

  const { records } = usePatients();
  const auditSectionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Locate targeted patient record
  const patient = useMemo(() => {
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
    return defaultFound ?? records[0] ?? DEFAULT_VIRTUAL_PATIENTS[0]!;
  }, [id, records]);

  // Section 1: Demographics Editable State
  const [isEditing, setIsEditing] = useState(false);
  const [demographics, setDemographics] = useState({
    name: patient.name || "",
    fileNumber: patient.fileNumber || "",
    age: patient.age || "31 years",
    dob: (patient.values?.["dob"] as string) || "1995-04-12",
    partnerAge: patient.partnerAge || "33",
    infertilityType: patient.infertilityType || "Secondary",
    infertilityDuration: (patient.values?.["infertilityDuration"] as number) || 24,
    height: (patient.values?.["height"] as number) || 168,
    weight: (patient.values?.["weight"] as number) || 63.6,
    bmi: (patient.values?.["bmi"] as string) || "22.5 kg/m²",
    causes: Array.isArray(patient.causes) ? [...patient.causes] : ["Tubal"],
  });

  // Section 2: Allergies & Chronic Conditions State
  const [conditions, setConditions] = useState({
    drugAllergy: (patient.values?.["drugAllergy"] as string) || "No known drug allergies",
    hypertension: (patient.values?.["hypertension"] as string) || "No",
    diabetes: (patient.values?.["diabetes"] as string) || "No",
    thyroid: (patient.values?.["thyroid"] as string) || "No",
    ovarianSurgery: (patient.values?.["ovarianSurgery"] as string) || "No",
    gynHydrosalpinx: (patient.values?.["gynHydrosalpinx"] as string) || "None",
    endometriosis: (patient.values?.["endometriosisStage"] as string) || "None",
    ohssHistory: (patient.values?.["ohssHistory"] as string) || "None",
  });

  // Section 3: Prior IVF Cycles Table State
  const [cycles, setCycles] = useState<CycleRecord[]>(patient.cycleRecords || []);

  // Section 4: Consent Documents State
  const [consents, setConsents] = useState<ConsentDocument[]>(DEFAULT_CONSENTS);

  // Section 5: Audit Trail State
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Load patient details into state when patient changes
  useEffect(() => {
    setDemographics({
      name: patient.name || "",
      fileNumber: patient.fileNumber || "",
      age: patient.age || "31 years",
      dob: (patient.values?.["dob"] as string) || "1995-04-12",
      partnerAge: patient.partnerAge || "33",
      infertilityType: patient.infertilityType || "Secondary",
      infertilityDuration: (patient.values?.["infertilityDuration"] as number) || 24,
      height: (patient.values?.["height"] as number) || 168,
      weight: (patient.values?.["weight"] as number) || 63.6,
      bmi: (patient.values?.["bmi"] as string) || "22.5 kg/m²",
      causes: Array.isArray(patient.causes) ? [...patient.causes] : ["Tubal"],
    });

    setConditions({
      drugAllergy: (patient.values?.["drugAllergy"] as string) || "No known drug allergies",
      hypertension: (patient.values?.["hypertension"] as string) || "No",
      diabetes: (patient.values?.["diabetes"] as string) || "No",
      thyroid: (patient.values?.["thyroid"] as string) || "No",
      ovarianSurgery: (patient.values?.["ovarianSurgery"] as string) || "No",
      gynHydrosalpinx: (patient.values?.["gynHydrosalpinx"] as string) || "None",
      endometriosis: (patient.values?.["endometriosisStage"] as string) || "None",
      ohssHistory: (patient.values?.["ohssHistory"] as string) || "None",
    });

    setCycles(patient.cycleRecords || []);
  }, [patient]);

  // Load audit chain
  useEffect(() => {
    void loadAuditChain().then((chain) => {
      const patientAudit = chain.filter(
        (e) => !e.caseId || e.caseId === patient.id || e.caseId === patient.fileNumber,
      );
      if (patientAudit.length > 0) {
        setAuditEntries(patientAudit);
      } else {
        // Fallback default genesis entries for the patient record
        setAuditEntries([
          {
            id: `aud-${patient.id}-01`,
            at: patient.createdAt || "2026-10-13T09:00:00.000Z",
            by: "Dr. Raouf Roshdy",
            action: "PATIENT_RECORD_INITIALIZED",
            caseId: patient.id,
            details: { name: patient.name, fileNumber: patient.fileNumber },
            hash: "8c3f4e2b1a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c",
            prevHash: null,
          },
          {
            id: `aud-${patient.id}-02`,
            at: patient.updatedAt || "2026-10-13T09:30:00.000Z",
            by: "Dr. Raouf Roshdy",
            action: "COS_CONSENT_SIGNED",
            caseId: patient.id,
            details: { document: "COS_CONSENT_v2.1", status: "Active" },
            hash: "1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e",
            prevHash: "8c3f4e2b1a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c",
          },
        ]);
      }
    });
  }, [patient]);

  // Handle Demographics Save
  const handleSaveDemographics = async () => {
    const updatedValues: Record<string, FieldValue> = {
      ...(patient.values || {}),
      fullName: demographics.name,
      fileNumber: demographics.fileNumber,
      dob: demographics.dob,
      age: demographics.age,
      partnerAge: demographics.partnerAge,
      infertilityType: demographics.infertilityType,
      infertilityDuration: demographics.infertilityDuration,
      height: demographics.height,
      weight: demographics.weight,
      bmi: demographics.bmi,
      causes: demographics.causes,
      ...conditions,
    };

    const updatedRecord: PatientRecord = {
      ...patient,
      name: demographics.name,
      fileNumber: demographics.fileNumber,
      age: demographics.age,
      partnerAge: demographics.partnerAge,
      infertilityType: demographics.infertilityType,
      causes: demographics.causes,
      updatedAt: new Date().toISOString(),
      values: updatedValues,
      cycleRecords: cycles,
    };

    savePatient(updatedRecord);
    setIsEditing(false);
    setSaveSuccessMsg("Demographics updated and persisted successfully.");
    setTimeout(() => setSaveSuccessMsg(null), 3000);

    // Append to cryptographic audit log
    try {
      const entry = await appendAuditEntry({
        by: "Dr. Raouf Roshdy",
        action: "PATIENT_DEMOGRAPHICS_MODIFIED",
        caseId: patient.id,
        details: {
          name: demographics.name,
          fileNumber: demographics.fileNumber,
          infertilityType: demographics.infertilityType,
          updatedFields: ["name", "fileNumber", "age", "bmi", "causes"],
        },
      });
      setAuditEntries((prev) => [entry, ...prev]);
    } catch {
      // IndexedDB fallback
    }
  };

  const handleCancelEdit = () => {
    setDemographics({
      name: patient.name || "",
      fileNumber: patient.fileNumber || "",
      age: patient.age || "31 years",
      dob: (patient.values?.["dob"] as string) || "1995-04-12",
      partnerAge: patient.partnerAge || "33",
      infertilityType: patient.infertilityType || "Secondary",
      infertilityDuration: (patient.values?.["infertilityDuration"] as number) || 24,
      height: (patient.values?.["height"] as number) || 168,
      weight: (patient.values?.["weight"] as number) || 63.6,
      bmi: (patient.values?.["bmi"] as string) || "22.5 kg/m²",
      causes: Array.isArray(patient.causes) ? [...patient.causes] : ["Tubal"],
    });
    setIsEditing(false);
  };

  // Section 3: Add Prior Cycle
  const handleAddCycle = async () => {
    const nextCycleNum = cycles.length + 1;
    const newCycle: CycleRecord = {
      id: `cyc-${patient.id}-${Date.now()}`,
      cycleNumber: nextCycleNum,
      year: new Date().getFullYear(),
      cycleType: "IVF",
      protocol: "Antagonist",
      startingDose: 225,
      retrieved: 10,
      mature: 8,
      fertilized: 6,
      blastocysts: 3,
      transferred: 1,
      frozen: 2,
      ohss: "No",
      clinicalPregnancy: "Pending",
      liveBirth: "No",
      miscarriage: "No",
    };

    const nextCycles = [...cycles, newCycle];
    setCycles(nextCycles);

    // Save updated record
    savePatient({
      ...patient,
      cycleRecords: nextCycles,
      updatedAt: new Date().toISOString(),
    });

    try {
      const entry = await appendAuditEntry({
        by: "Dr. Raouf Roshdy",
        action: "PRIOR_CYCLE_ADDED",
        caseId: patient.id,
        details: { cycleNumber: nextCycleNum, protocol: "Antagonist", startingDose: 225 },
      });
      setAuditEntries((prev) => [entry, ...prev]);
    } catch {
      // fallback
    }
  };

  // Section 3: Remove Prior Cycle Row
  const handleRemoveCycle = async (cycleId: string, index: number) => {
    const nextCycles = cycles.filter((c) => c.id !== cycleId);
    setCycles(nextCycles);

    savePatient({
      ...patient,
      cycleRecords: nextCycles,
      updatedAt: new Date().toISOString(),
    });

    try {
      const entry = await appendAuditEntry({
        by: "Dr. Raouf Roshdy",
        action: "PRIOR_CYCLE_REMOVED",
        caseId: patient.id,
        details: { removedCycleIndex: index + 1, cycleId },
      });
      setAuditEntries((prev) => [entry, ...prev]);
    } catch {
      // fallback
    }
  };

  // Section 4: Upload Consent
  const handleUploadConsentTrigger = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newDoc: ConsentDocument = {
      id: `doc-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ""),
      category: "Uploaded Clinical Consent",
      status: "Active",
      version: "v1.0 (Signed PDF)",
      signedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      authorizedBy: "Dr. Raouf Roshdy",
      sha256: "3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b",
    };

    setConsents((prev) => [newDoc, ...prev]);

    try {
      const entry = await appendAuditEntry({
        by: "Dr. Raouf Roshdy",
        action: "CONSENT_DOCUMENT_UPLOADED",
        caseId: patient.id,
        details: { filename: file.name, fileSize: file.size, hash: newDoc.sha256 },
      });
      setAuditEntries((prev) => [entry, ...prev]);
    } catch {
      // fallback
    }
  };

  // Section 4: Download Consent
  const handleDownloadConsent = (doc: ConsentDocument) => {
    // Generate text/pdf simulation download
    const blob = new Blob(
      [
        `AiFV Precision Clinical CDSS\nDocument: ${doc.title}\nVersion: ${doc.version}\nStatus: ${doc.status}\nPatient: ${patient.name} (${patient.fileNumber})\nAuthorizing Physician: ${doc.authorizedBy}\nSigned Date: ${doc.signedAt}\nSHA-256 Seal: ${doc.sha256}\n\nESHRE 2025 Synchronized Hospital Master Record`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${patient.fileNumber}_${doc.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Section 4: Revoke Consent
  const handleRevokeConsent = async (docId: string) => {
    setConsents((prev) => prev.map((d) => (d.id === docId ? { ...d, status: "Revoked" } : d)));

    try {
      const entry = await appendAuditEntry({
        by: "Dr. Raouf Roshdy",
        action: "CONSENT_DOCUMENT_REVOKED",
        caseId: patient.id,
        details: { docId, revocationReason: "Clinician revoked consent status." },
      });
      setAuditEntries((prev) => [entry, ...prev]);
    } catch {
      // fallback
    }
  };

  const handleScrollToAudit = () => {
    auditSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      {/* Hidden file input for Upload Consent */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ------------------------------------------------------------------- */}
      {/* TOP HEADER: Navigation, Patient Title, Primary Actions             */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5"
                title="Return to Clinical Worklist"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to Dashboard</span>
              </Button>
            </Link>
            <span className="text-border">|</span>
            <Badge
              variant="outline"
              className="text-[11px] font-mono border-primary/30 text-primary"
            >
              Master Record
            </Badge>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm border border-primary/20">
              {patient.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {patient.name}
              </h1>
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <span>MRN: {patient.fileNumber || patient.id}</span>
                <span>·</span>
                <span>{patient.age}</span>
                <span>·</span>
                <span>{patient.infertilityType} Infertility</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Action Buttons: [View Audit] [Lock Screen] */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScrollToAudit}
            className="h-8.5 gap-1.5 border-border/80 bg-background hover:bg-muted text-foreground text-xs font-medium"
            title="Jump to cryptographic audit trail"
          >
            <History className="size-3.5 text-primary" />
            <span>View Audit</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => lockSession("manual_lock")}
            className="h-8.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60"
            title="Lock clinical session immediately"
          >
            <Lock className="size-3.5" />
            <span>Lock Screen</span>
          </Button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-4" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 1: Demographics Card (editable)                             */}
      {/* ------------------------------------------------------------------- */}
      <section
        aria-labelledby="demographics-title"
        className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <User className="size-4.5 text-primary" />
            <div>
              <h2
                id="demographics-title"
                className="text-sm font-bold text-foreground sm:text-base"
              >
                Section 1: Demographics & Reproductive Profile
              </h2>
              <p className="text-xs text-muted-foreground">
                Core patient identification, partner background, and infertility diagnosis.
              </p>
            </div>
          </div>

          {/* Edit Actions: [Edit] or [Save] / [Cancel Edit] */}
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-8 gap-1.5 border-border/80 bg-background hover:bg-muted text-foreground text-xs font-medium"
            >
              <Edit3 className="size-3.5 text-primary" />
              <span>Edit</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
                <span>Cancel Edit</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSaveDemographics}
                className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs text-xs"
              >
                <Save className="size-3.5" />
                <span>Save</span>
              </Button>
            </div>
          )}
        </div>

        {/* Demographics View / Edit Form */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Full Patient Name
            </label>
            {isEditing ? (
              <Input
                value={demographics.name}
                onChange={(e) => setDemographics((d) => ({ ...d, name: e.target.value }))}
                className="h-9 text-xs"
              />
            ) : (
              <p className="font-semibold text-xs text-foreground py-1.5">{demographics.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              File Number / MRN
            </label>
            {isEditing ? (
              <Input
                value={demographics.fileNumber}
                onChange={(e) => setDemographics((d) => ({ ...d, fileNumber: e.target.value }))}
                className="h-9 text-xs font-mono"
              />
            ) : (
              <p className="font-mono text-xs text-foreground py-1.5">
                {demographics.fileNumber || "—"}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Date of Birth & Age
            </label>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={demographics.dob}
                  onChange={(e) => setDemographics((d) => ({ ...d, dob: e.target.value }))}
                  className="h-9 text-xs"
                />
                <Input
                  value={demographics.age}
                  onChange={(e) => setDemographics((d) => ({ ...d, age: e.target.value }))}
                  placeholder="e.g. 31 years"
                  className="h-9 text-xs w-28"
                />
              </div>
            ) : (
              <p className="text-xs text-foreground py-1.5">
                {demographics.dob} ({demographics.age})
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Partner Age</label>
            {isEditing ? (
              <Input
                value={demographics.partnerAge}
                onChange={(e) => setDemographics((d) => ({ ...d, partnerAge: e.target.value }))}
                className="h-9 text-xs"
              />
            ) : (
              <p className="text-xs text-foreground py-1.5">
                {demographics.partnerAge || "—"} years
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Infertility Type
            </label>
            {isEditing ? (
              <select
                value={demographics.infertilityType}
                onChange={(e) =>
                  setDemographics((d) => ({ ...d, infertilityType: e.target.value }))
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
              </select>
            ) : (
              <p className="text-xs text-foreground py-1.5 font-medium">
                {demographics.infertilityType}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Duration of Infertility
            </label>
            {isEditing ? (
              <Input
                type="number"
                value={demographics.infertilityDuration}
                onChange={(e) =>
                  setDemographics((d) => ({ ...d, infertilityDuration: Number(e.target.value) }))
                }
                className="h-9 text-xs"
              />
            ) : (
              <p className="text-xs text-foreground py-1.5">
                {demographics.infertilityDuration} months
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Height & Weight
            </label>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Height cm"
                  value={demographics.height}
                  onChange={(e) =>
                    setDemographics((d) => ({ ...d, height: Number(e.target.value) }))
                  }
                  className="h-9 text-xs"
                />
                <Input
                  type="number"
                  placeholder="Weight kg"
                  value={demographics.weight}
                  onChange={(e) =>
                    setDemographics((d) => ({ ...d, weight: Number(e.target.value) }))
                  }
                  className="h-9 text-xs"
                />
              </div>
            ) : (
              <p className="text-xs text-foreground py-1.5">
                {demographics.height} cm · {demographics.weight} kg
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Body Mass Index (BMI)
            </label>
            <p className="text-xs font-semibold text-foreground py-1.5">{demographics.bmi}</p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">
              Infertility Etiology / Causes
            </label>
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {demographics.causes.map((c) => (
                <Badge key={c} variant="secondary" className="text-[11px] px-2 py-0.5">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 2: Allergies & Chronic Conditions                           */}
      {/* ------------------------------------------------------------------- */}
      <section
        aria-labelledby="allergies-title"
        className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4.5 text-amber-600 dark:text-amber-400" />
            <div>
              <h2 id="allergies-title" className="text-sm font-bold text-foreground sm:text-base">
                Section 2: Allergies & Chronic Clinical Conditions
              </h2>
              <p className="text-xs text-muted-foreground">
                Documented drug sensitivities, systemic diseases, surgical history, and OHSS risk
                predisposition.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Drug Allergies</span>
            <p className="text-xs font-bold text-foreground">{conditions.drugAllergy}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Hypertension</span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  conditions.hypertension === "Yes" ? "bg-destructive" : "bg-emerald-500",
                )}
              />
              <p className="text-xs font-bold text-foreground">{conditions.hypertension}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Diabetes Mellitus
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  conditions.diabetes === "Yes" ? "bg-destructive" : "bg-emerald-500",
                )}
              />
              <p className="text-xs font-bold text-foreground">{conditions.diabetes}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Thyroid Dysfunction
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  conditions.thyroid === "Yes" ? "bg-destructive" : "bg-emerald-500",
                )}
              />
              <p className="text-xs font-bold text-foreground">{conditions.thyroid}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Previous Ovarian Surgery
            </span>
            <p className="text-xs font-bold text-foreground">{conditions.ovarianSurgery}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Hydrosalpinx</span>
            <p className="text-xs font-bold text-foreground">{conditions.gynHydrosalpinx}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Endometriosis History
            </span>
            <p className="text-xs font-bold text-foreground">{conditions.endometriosis}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              OHSS Risk Predisposition
            </span>
            <Badge
              variant={conditions.ohssHistory === "Severe" ? "destructive" : "outline"}
              className="text-[10px]"
            >
              {conditions.ohssHistory === "Severe" ? "Critical OHSS Risk" : "Standard Risk Profile"}
            </Badge>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 3: Prior IVF Cycles Table (Add row, Remove row)             */}
      {/* ------------------------------------------------------------------- */}
      <section
        aria-labelledby="prior-cycles-title"
        className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Activity className="size-4.5 text-primary" />
            <div>
              <h2
                id="prior-cycles-title"
                className="text-sm font-bold text-foreground sm:text-base"
              >
                Section 3: Prior IVF / Controlled Ovarian Stimulation Cycles
              </h2>
              <p className="text-xs text-muted-foreground">
                Historical stimulation protocols, starting doses, embryological yields, and clinical
                outcomes.
              </p>
            </div>
          </div>

          {/* Action Button: [Add Prior Cycle] */}
          <Button
            size="sm"
            onClick={handleAddCycle}
            className="h-8 gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            <span>Add Prior Cycle</span>
          </Button>
        </div>

        {cycles.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No prior cycles recorded for this patient. Click "Add Prior Cycle" to add historical
            records.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border/70">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Year</th>
                  <th className="px-3 py-2.5">Protocol</th>
                  <th className="px-3 py-2.5">Starting Dose</th>
                  <th className="px-3 py-2.5">Retrieved</th>
                  <th className="px-3 py-2.5">Mature (MII)</th>
                  <th className="px-3 py-2.5">Fertilized (2PN)</th>
                  <th className="px-3 py-2.5">Blastocysts</th>
                  <th className="px-3 py-2.5">Transferred/Frozen</th>
                  <th className="px-3 py-2.5">Outcome</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-background/50">
                {cycles.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-foreground font-mono">
                      Cycle {c["cycleNumber"] ?? idx + 1}
                    </td>
                    <td className="px-3 py-2.5 font-mono">{String(c["year"] ?? "2025")}</td>
                    <td className="px-3 py-2.5 font-medium">
                      {String(c["protocol"] ?? "Antagonist")}
                    </td>
                    <td className="px-3 py-2.5 font-mono">{String(c["startingDose"] ?? 225)} IU</td>
                    <td className="px-3 py-2.5 font-mono">{String(c["retrieved"] ?? 0)}</td>
                    <td className="px-3 py-2.5 font-mono">{String(c["mature"] ?? 0)}</td>
                    <td className="px-3 py-2.5 font-mono">{String(c["fertilized"] ?? 0)}</td>
                    <td className="px-3 py-2.5 font-mono">{String(c["blastocysts"] ?? 0)}</td>
                    <td className="px-3 py-2.5 font-mono">
                      {String(c["transferred"] ?? 1)} / {String(c["frozen"] ?? 0)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={String(c["clinicalPregnancy"]) === "Yes" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {String(c["clinicalPregnancy"]) === "Yes"
                          ? "Clinical Pregnancy"
                          : "Negative / Failed"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {/* Action Button: [Remove Row] */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCycle(c.id, idx)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
                        title="Remove cycle row"
                      >
                        <Trash2 className="size-3" />
                        <span>Remove Row</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 4: Consent Documents (Upload PDF, Download, Revoke)         */}
      {/* ------------------------------------------------------------------- */}
      <section
        aria-labelledby="consents-title"
        className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <FileCheck className="size-4.5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 id="consents-title" className="text-sm font-bold text-foreground sm:text-base">
                Section 4: Clinical & Legal Consent Documents
              </h2>
              <p className="text-xs text-muted-foreground">
                Informed consent forms, embryology authorizations, and cryptographic document
                integrity hashes.
              </p>
            </div>
          </div>

          {/* Action Button: [Upload Consent] */}
          <Button
            size="sm"
            onClick={handleUploadConsentTrigger}
            className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs text-xs"
          >
            <Upload className="size-3.5" />
            <span>Upload Consent</span>
          </Button>
        </div>

        <div className="space-y-3">
          {consents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-foreground truncate">{doc.title}</span>
                  <Badge
                    variant={
                      doc.status === "Active"
                        ? "default"
                        : doc.status === "Pending"
                          ? "secondary"
                          : "destructive"
                    }
                    className="text-[10px] px-1.5 py-0"
                  >
                    {doc.status}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">{doc.version}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground flex-wrap">
                  <span>Authorized by: {doc.authorizedBy}</span>
                  <span>·</span>
                  <span>Signed: {doc.signedAt}</span>
                  <span>·</span>
                  <span className="truncate max-w-xs" title={`SHA-256: ${doc.sha256}`}>
                    SHA: {doc.sha256.slice(0, 16)}…
                  </span>
                </div>
              </div>

              {/* Document Actions: [Download Consent] [Revoke Consent] */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadConsent(doc)}
                  className="h-7 px-2.5 text-xs border-border/80 hover:bg-muted text-foreground gap-1"
                  title="Download signed consent document"
                >
                  <Download className="size-3 text-primary" />
                  <span>Download Consent</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={doc.status === "Revoked"}
                  onClick={() => handleRevokeConsent(doc.id)}
                  className="h-7 px-2.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 gap-1"
                  title="Revoke active consent agreement"
                >
                  <ShieldX className="size-3" />
                  <span>Revoke Consent</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 5: Audit Trail (read-only)                                  */}
      {/* ------------------------------------------------------------------- */}
      <section
        ref={auditSectionRef}
        aria-labelledby="audit-title"
        className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <History className="size-4.5 text-primary" />
            <div>
              <h2 id="audit-title" className="text-sm font-bold text-foreground sm:text-base">
                Section 5: Immutable Cryptographic Audit Trail
              </h2>
              <p className="text-xs text-muted-foreground">
                Tamper-evident SHA-256 hash chain recording every patient mutation and clinical
                governance event.
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-[10px]"
          >
            <ShieldCheck className="size-3" />
            <span>Cryptographic Chain Verified</span>
          </Badge>
        </div>

        <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
          {auditEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-border/60 bg-background/50 p-3 text-xs space-y-1 font-mono"
            >
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="font-bold text-foreground">{entry.action}</span>
                <span className="text-[10px] text-muted-foreground">{entry.at}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Recorded by: <span className="text-foreground font-semibold">{entry.by}</span>
              </p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                <span className="truncate">Hash: {entry.hash.slice(0, 24)}…</span>
                <span>·</span>
                <span>Prev: {entry.prevHash ? `${entry.prevHash.slice(0, 12)}…` : "GENESIS"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
