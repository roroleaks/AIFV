/**
 * IntakeDrawer Component (§2.1 - §2.6)
 *
 * Single-screen 5-section accordion intake flow replacing the legacy 8-step wizard.
 *
 * SPEC:
 *  - 5 accordion sections (Identity, Anthropometrics & History, Reserve Markers, Diagnosis, Cycle Intent)
 *  - First expanded by default, others collapsible & clickable in any order
 *  - Reactive debounced auto-stratification (≤ 200ms) with ZERO "Calculate" button
 *  - When age + AMH + AFC present: surfaces POSEIDON, Bologna, Phenotype, Response chips
 *  - When incomplete: surfaces neutral "Stratification incomplete — enter age, AMH, and AFC" badge
 *  - Hard ranges block save; soft warnings prompt confirmation
 *  - Save & Open Case creates internal caseId (No PHI in URL) + baseline D0 encounter pre-filled
 *  - Hotkeys: Ctrl+Enter (Save & Open), Ctrl+S (Save), Esc (Cancel)
 *  - Touch targets ≥ 44px, input font ≥ 16px
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  User,
  Activity,
  FlaskConical,
  Stethoscope,
  Layers,
  AlertTriangle,
  X,
  QrCode,
  Save,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  type IntakeData,
  INITIAL_INTAKE_DATA,
  type PrimaryInfertilityCause,
  type CycleIntentType,
  type EmbryoTransferPolicy,
} from "./types";
import { validateIntake } from "@/features/encounter/validation";
import { generateCaseId, saveCaseFromIntake, computeStratificationPreview } from "./intakeAdapter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface IntakeDrawerProps {
  open: boolean;
  onClose: () => void;
  onCaseCreated?: (caseId: string) => void;
}

const COMORBIDITY_OPTIONS = [
  "PCOS",
  "Endometriosis",
  "Thyroid Disorder",
  "Autoimmune Disease",
  "Diminished Ovarian Reserve (DOR)",
  "Hyperprolactinemia",
  "Tubal Occlusion",
  "Uterine Factor",
];

const SECONDARY_FLAGS = [
  "Male Factor Co-existing",
  "Prior Poor Response",
  "Prior OHSS",
  "Recurrent Implantation Failure",
  "Advanced Paternal Age",
];

export function IntakeDrawer({ open, onClose, onCaseCreated }: IntakeDrawerProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<IntakeData>(INITIAL_INTAKE_DATA);
  const [dirty, setDirty] = useState(false);
  const [showSoftWarningModal, setShowSoftWarningModal] = useState(false);
  const [softWarningProceedAction, setSoftWarningProceedAction] = useState<(() => void) | null>(
    null,
  );

  // Auto-calculated age from DOB
  const handleDobChange = (dob: string) => {
    let calculatedAge: number | null = null;
    if (dob) {
      const birth = new Date(dob);
      const now = new Date();
      if (!isNaN(birth.getTime())) {
        calculatedAge = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
          calculatedAge--;
        }
      }
    }

    setData((prev) => ({
      ...prev,
      identity: {
        ...prev.identity,
        dob,
        age: calculatedAge,
      },
    }));
    setDirty(true);
  };

  // Auto-calculated BMI from Height & Weight
  const handleAnthropometricsChange = (heightCm: number | null, weightKg: number | null) => {
    let calculatedBmi: number | null = null;
    if (heightCm && weightKg && heightCm > 50 && weightKg > 20) {
      const m = heightCm / 100;
      calculatedBmi = weightKg / (m * m);
    }

    setData((prev) => ({
      ...prev,
      anthropometrics: {
        ...prev.anthropometrics,
        heightCm,
        weightKg,
        bmi: calculatedBmi,
      },
    }));
    setDirty(true);
  };

  // Auto-calculated total AFC from Right & Left
  const handleAfcChange = (afcRight: number | null, afcLeft: number | null) => {
    const total = (afcRight ?? 0) + (afcLeft ?? 0);
    setData((prev) => ({
      ...prev,
      reserveMarkers: {
        ...prev.reserveMarkers,
        afcRight,
        afcLeft,
        afcTotal: afcRight !== null || afcLeft !== null ? total : null,
      },
    }));
    setDirty(true);
  };

  // Reactive Debounced Auto-Stratification (§2.2)
  const [debouncedData, setDebouncedData] = useState<IntakeData>(data);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedData(data);
    }, 180); // <= 200ms debouncing per spec
    return () => clearTimeout(timer);
  }, [data]);

  // Evaluate stratification reactively
  const stratificationPreview = useMemo(() => {
    return computeStratificationPreview(debouncedData);
  }, [debouncedData]);

  // Validation
  const validation = useMemo(() => validateIntake(data), [data]);

  // Execute Save Action
  const executeSave = useCallback(
    (isOpenCase: boolean) => {
      const newCaseId = generateCaseId();
      saveCaseFromIntake(data, newCaseId);

      onCaseCreated?.(newCaseId);

      if (isOpenCase) {
        onClose();
        navigate({ to: `/case/${newCaseId}` });
      } else {
        setDirty(false);
      }
    },
    [data, onCaseCreated, onClose, navigate],
  );

  // Trigger Save with Soft Warning Guard
  const handleSaveAttempt = useCallback(
    (isOpenCase: boolean) => {
      if (!validation.isValid) return;

      if (validation.softWarnings.length > 0) {
        setSoftWarningProceedAction(() => () => executeSave(isOpenCase));
        setShowSoftWarningModal(true);
        return;
      }

      executeSave(isOpenCase);
    },
    [validation.isValid, validation.softWarnings.length, executeSave],
  );

  // Keyboard navigation & shortcuts (§2.6)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSaveAttempt(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSaveAttempt(false);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (dirty) {
          if (confirm("Discard unsaved intake changes?")) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, dirty, handleSaveAttempt, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Drawer Surface */}
      <div className="flex h-full w-full max-w-2xl flex-col bg-card border-l border-border/80 shadow-2xl animate-in slide-in-from-right duration-250 sm:max-w-3xl overflow-hidden">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-4 bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">New Patient Intake</h2>
              <Badge variant="outline" className="text-[10px] font-mono">
                Case Creation
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comprehensive clinical intake with auto-calculated BMI, age, and reactive
              stratification.
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Close intake drawer"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Reactive Auto-Stratification Live Strip (§2.2 - ZERO Calculate Button) */}
        <div className="border-b border-border/60 bg-primary/5 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              Live Stratification Engine
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {stratificationPreview.isComplete ? (
                stratificationPreview.chips.map((chip, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className={cn(
                      "text-xs gap-1 font-medium px-2 py-0.5",
                      chip.variant === "destructive"
                        ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40"
                        : chip.variant === "warning"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40",
                    )}
                  >
                    <span>{chip.icon}</span>
                    <span>{chip.label}</span>
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary" className="text-xs text-muted-foreground gap-1.5 py-0.5">
                  <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                  Stratification incomplete — enter age, AMH, and AFC
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Hard Validation Issue Notice */}
        {!validation.isValid && (
          <div className="bg-red-500/10 border-b border-red-500/30 px-6 py-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{validation.hardIssues[0]?.message} (Resolve blocking errors to proceed)</span>
          </div>
        )}

        {/* 5-Section Accordion Form Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Accordion type="multiple" defaultValue={["identity-sec"]} className="space-y-4">
            {/* SECTION 1: Identity */}
            <AccordionItem
              value="identity-sec"
              className="border border-border/70 rounded-xl overflow-hidden bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:bg-muted/30">
                <div className="flex items-center gap-2.5 text-sm font-bold text-foreground">
                  <User className="size-4 text-primary" />
                  <span>1. Patient Identity</span>
                  {data.identity.fullName && (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({data.identity.fullName})
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <Label htmlFor="intake-mrn" className="text-xs font-semibold">
                      Medical Record Number (MRN) *
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="intake-mrn"
                        value={data.identity.mrn}
                        onChange={(e) => {
                          setData((prev) => ({
                            ...prev,
                            identity: { ...prev.identity, mrn: e.target.value },
                          }));
                          setDirty(true);
                        }}
                        placeholder="e.g. MRN-10492"
                        className="text-base sm:text-xs h-10 pe-9"
                      />
                      <button
                        type="button"
                        title="Simulate barcode/QR scan"
                        aria-label="Simulate barcode/QR scan"
                        onClick={() => {
                          const mockMrn = `MRN-${Math.floor(10000 + Math.random() * 90000)}`;
                          setData((prev) => ({
                            ...prev,
                            identity: { ...prev.identity, mrn: mockMrn },
                          }));
                          setDirty(true);
                        }}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                      >
                        <QrCode className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="intake-fullname" className="text-xs font-semibold">
                      Full Legal Name *
                    </Label>
                    <Input
                      id="intake-fullname"
                      value={data.identity.fullName}
                      onChange={(e) => {
                        setData((prev) => ({
                          ...prev,
                          identity: { ...prev.identity, fullName: e.target.value },
                        }));
                        setDirty(true);
                      }}
                      placeholder="e.g. Sarah Jenkins"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-dob" className="text-xs font-semibold">
                      Date of Birth (DOB) *
                    </Label>
                    <Input
                      id="intake-dob"
                      type="date"
                      value={data.identity.dob}
                      onChange={(e) => handleDobChange(e.target.value)}
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-age" className="text-xs font-semibold">
                      Auto-calculated Age
                    </Label>
                    <Input
                      id="intake-age"
                      readOnly
                      value={data.identity.age ? `${data.identity.age} years old` : "—"}
                      className="mt-1 text-base sm:text-xs h-10 bg-muted/40 font-semibold"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-partner" className="text-xs font-semibold">
                      Partner Name (Optional)
                    </Label>
                    <Input
                      id="intake-partner"
                      value={data.identity.partnerName}
                      onChange={(e) => {
                        setData((prev) => ({
                          ...prev,
                          identity: { ...prev.identity, partnerName: e.target.value },
                        }));
                        setDirty(true);
                      }}
                      placeholder="e.g. David Jenkins"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-phone" className="text-xs font-semibold">
                      Contact Phone Number
                    </Label>
                    <Input
                      id="intake-phone"
                      value={data.identity.contactPhone}
                      onChange={(e) => {
                        setData((prev) => ({
                          ...prev,
                          identity: { ...prev.identity, contactPhone: e.target.value },
                        }));
                        setDirty(true);
                      }}
                      placeholder="+1 (555) 019-2831"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SECTION 2: Anthropometrics & History */}
            <AccordionItem
              value="anthro-sec"
              className="border border-border/70 rounded-xl overflow-hidden bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:bg-muted/30">
                <div className="flex items-center gap-2.5 text-sm font-bold text-foreground">
                  <Activity className="size-4 text-primary" />
                  <span>2. Anthropometrics & Clinical History</span>
                  {data.anthropometrics.bmi && (
                    <span className="text-xs font-normal text-muted-foreground">
                      (BMI: {data.anthropometrics.bmi.toFixed(1)})
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <Label htmlFor="intake-height" className="text-xs font-semibold">
                      Height (cm)
                    </Label>
                    <Input
                      id="intake-height"
                      type="number"
                      value={data.anthropometrics.heightCm ?? ""}
                      onChange={(e) => {
                        const h = e.target.value ? Number(e.target.value) : null;
                        handleAnthropometricsChange(h, data.anthropometrics.weightKg);
                      }}
                      placeholder="165"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-weight" className="text-xs font-semibold">
                      Weight (kg)
                    </Label>
                    <Input
                      id="intake-weight"
                      type="number"
                      value={data.anthropometrics.weightKg ?? ""}
                      onChange={(e) => {
                        const w = e.target.value ? Number(e.target.value) : null;
                        handleAnthropometricsChange(data.anthropometrics.heightCm, w);
                      }}
                      placeholder="62"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-bmi" className="text-xs font-semibold">
                      Auto-calculated BMI
                    </Label>
                    <Input
                      id="intake-bmi"
                      readOnly
                      value={
                        data.anthropometrics.bmi
                          ? `${data.anthropometrics.bmi.toFixed(1)} kg/m²`
                          : "—"
                      }
                      className="mt-1 text-base sm:text-xs h-10 bg-muted/40 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                  <div>
                    <Label htmlFor="intake-gravidity" className="text-xs font-semibold">
                      Gravidity
                    </Label>
                    <Input
                      id="intake-gravidity"
                      type="number"
                      min={0}
                      value={data.anthropometrics.gravidity ?? 0}
                      onChange={(e) => {
                        setData((prev) => ({
                          ...prev,
                          anthropometrics: {
                            ...prev.anthropometrics,
                            gravidity: Number(e.target.value),
                          },
                        }));
                        setDirty(true);
                      }}
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-parity" className="text-xs font-semibold">
                      Parity
                    </Label>
                    <Input
                      id="intake-parity"
                      type="number"
                      min={0}
                      value={data.anthropometrics.parity ?? 0}
                      onChange={(e) => {
                        setData((prev) => ({
                          ...prev,
                          anthropometrics: {
                            ...prev.anthropometrics,
                            parity: Number(e.target.value),
                          },
                        }));
                        setDirty(true);
                      }}
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-attempts" className="text-xs font-semibold">
                      Prior IVF Attempts
                    </Label>
                    <Input
                      id="intake-attempts"
                      type="number"
                      min={0}
                      value={data.anthropometrics.previousIvfAttempts}
                      onChange={(e) => {
                        setData((prev) => ({
                          ...prev,
                          anthropometrics: {
                            ...prev.anthropometrics,
                            previousIvfAttempts: Number(e.target.value),
                          },
                        }));
                        setDirty(true);
                      }}
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>
                </div>

                {/* Comorbidities Multi-select */}
                <div className="pt-2">
                  <Label className="text-xs font-semibold block mb-1.5">
                    Documented Comorbidities
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMORBIDITY_OPTIONS.map((item) => {
                      const selected = data.anthropometrics.comorbidities.includes(item);
                      return (
                        <Badge
                          key={item}
                          variant={selected ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer text-xs px-2.5 py-1 select-none transition-colors",
                            selected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                          )}
                          onClick={() => {
                            setData((prev) => {
                              const list = prev.anthropometrics.comorbidities;
                              const next = selected
                                ? list.filter((c) => c !== item)
                                : [...list, item];
                              return {
                                ...prev,
                                anthropometrics: { ...prev.anthropometrics, comorbidities: next },
                              };
                            });
                            setDirty(true);
                          }}
                        >
                          {item}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Prior OHSS alert toggle */}
                <div className="flex items-center gap-3 pt-2 p-3 rounded-lg border border-border/60 bg-muted/20">
                  <input
                    type="checkbox"
                    id="prior-ohss"
                    checked={data.anthropometrics.previousOhss}
                    onChange={(e) => {
                      setData((prev) => ({
                        ...prev,
                        anthropometrics: {
                          ...prev.anthropometrics,
                          previousOhss: e.target.checked,
                        },
                      }));
                      setDirty(true);
                    }}
                    className="size-4 rounded accent-primary cursor-pointer"
                  />
                  <label htmlFor="prior-ohss" className="text-xs font-medium cursor-pointer">
                    Patient has a documented history of severe Ovarian Hyperstimulation Syndrome
                    (OHSS)
                  </label>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SECTION 3: Reserve Markers */}
            <AccordionItem
              value="reserve-sec"
              className="border border-border/70 rounded-xl overflow-hidden bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:bg-muted/30">
                <div className="flex items-center gap-2.5 text-sm font-bold text-foreground">
                  <FlaskConical className="size-4 text-primary" />
                  <span>3. Ovarian Reserve Markers (Drives POSEIDON & Bologna)</span>
                  {data.reserveMarkers.amh && (
                    <span className="text-xs font-normal text-muted-foreground">
                      (AMH: {data.reserveMarkers.amh} ng/mL, AFC:{" "}
                      {data.reserveMarkers.afcTotal ?? "—"})
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <Label htmlFor="intake-amh" className="text-xs font-semibold">
                      AMH (ng/mL) *
                    </Label>
                    <Input
                      id="intake-amh"
                      type="number"
                      step="0.01"
                      min={0}
                      max={20}
                      value={data.reserveMarkers.amh ?? ""}
                      onChange={(e) => {
                        const amh = e.target.value ? Number(e.target.value) : null;
                        setData((prev) => ({
                          ...prev,
                          reserveMarkers: { ...prev.reserveMarkers, amh },
                        }));
                        setDirty(true);
                      }}
                      placeholder="e.g. 2.4"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                    <span className="text-[10px] text-muted-foreground">Validated: 0–20 ng/mL</span>
                  </div>

                  <div>
                    <Label htmlFor="intake-afc-right" className="text-xs font-semibold">
                      Right Ovary AFC
                    </Label>
                    <Input
                      id="intake-afc-right"
                      type="number"
                      min={0}
                      max={30}
                      value={data.reserveMarkers.afcRight ?? ""}
                      onChange={(e) => {
                        const r = e.target.value ? Number(e.target.value) : null;
                        handleAfcChange(r, data.reserveMarkers.afcLeft);
                      }}
                      placeholder="e.g. 8"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-afc-left" className="text-xs font-semibold">
                      Left Ovary AFC
                    </Label>
                    <Input
                      id="intake-afc-left"
                      type="number"
                      min={0}
                      max={30}
                      value={data.reserveMarkers.afcLeft ?? ""}
                      onChange={(e) => {
                        const l = e.target.value ? Number(e.target.value) : null;
                        handleAfcChange(data.reserveMarkers.afcRight, l);
                      }}
                      placeholder="e.g. 7"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs pt-1">
                  <div>
                    <Label htmlFor="intake-afc-total" className="text-xs font-semibold">
                      Total Antral Follicles
                    </Label>
                    <Input
                      id="intake-afc-total"
                      readOnly
                      value={
                        data.reserveMarkers.afcTotal !== null
                          ? `${data.reserveMarkers.afcTotal} follicles`
                          : "—"
                      }
                      className="mt-1 text-base sm:text-xs h-10 bg-muted/40 font-semibold"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-fsh" className="text-xs font-semibold">
                      Basal FSH (mIU/mL)
                    </Label>
                    <Input
                      id="intake-fsh"
                      type="number"
                      step="0.1"
                      min={0}
                      max={40}
                      value={data.reserveMarkers.basalFsh ?? ""}
                      onChange={(e) => {
                        const fsh = e.target.value ? Number(e.target.value) : null;
                        setData((prev) => ({
                          ...prev,
                          reserveMarkers: { ...prev.reserveMarkers, basalFsh: fsh },
                        }));
                        setDirty(true);
                      }}
                      placeholder="6.5"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-e2" className="text-xs font-semibold">
                      Basal Estradiol (pg/mL)
                    </Label>
                    <Input
                      id="intake-e2"
                      type="number"
                      min={0}
                      max={200}
                      value={data.reserveMarkers.basalE2 ?? ""}
                      onChange={(e) => {
                        const e2 = e.target.value ? Number(e.target.value) : null;
                        setData((prev) => ({
                          ...prev,
                          reserveMarkers: { ...prev.reserveMarkers, basalE2: e2 },
                        }));
                        setDirty(true);
                      }}
                      placeholder="45"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="intake-lh" className="text-xs font-semibold">
                      Basal LH (mIU/mL)
                    </Label>
                    <Input
                      id="intake-lh"
                      type="number"
                      step="0.1"
                      min={0}
                      max={25}
                      value={data.reserveMarkers.basalLh ?? ""}
                      onChange={(e) => {
                        const lh = e.target.value ? Number(e.target.value) : null;
                        setData((prev) => ({
                          ...prev,
                          reserveMarkers: { ...prev.reserveMarkers, basalLh: lh },
                        }));
                        setDirty(true);
                      }}
                      placeholder="4.8"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SECTION 4: Infertility Diagnosis */}
            <AccordionItem
              value="diagnosis-sec"
              className="border border-border/70 rounded-xl overflow-hidden bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:bg-muted/30">
                <div className="flex items-center gap-2.5 text-sm font-bold text-foreground">
                  <Stethoscope className="size-4 text-primary" />
                  <span>4. Infertility Diagnosis</span>
                  <span className="text-xs font-normal text-muted-foreground capitalize">
                    ({data.diagnosis.primaryCause})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <Label className="text-xs font-semibold">Primary Diagnosis Cause *</Label>
                    <select
                      value={data.diagnosis.primaryCause}
                      onChange={(e) => {
                        setData((prev) => ({
                          ...prev,
                          diagnosis: {
                            ...prev.diagnosis,
                            primaryCause: e.target.value as PrimaryInfertilityCause,
                          },
                        }));
                        setDirty(true);
                      }}
                      className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3 text-base sm:text-xs"
                    >
                      <option value="unexplained">Unexplained Infertility</option>
                      <option value="tubal">Tubal Factor Infertility</option>
                      <option value="male-factor">Male Factor Infertility</option>
                      <option value="ovulatory">Ovulatory Dysfunction (PCOS / Anovulation)</option>
                      <option value="endometriosis">Endometriosis</option>
                      <option value="genetic">Genetic Carrier / Translocation</option>
                      <option value="advanced-maternal-age">Advanced Maternal Age</option>
                      <option value="mixed">Mixed Etiology</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">
                      Duration of Infertility (Months)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={240}
                      value={data.diagnosis.infertilityDuration ?? ""}
                      onChange={(e) => {
                        const d = e.target.value ? Number(e.target.value) : null;
                        setData((prev) => ({
                          ...prev,
                          diagnosis: { ...prev.diagnosis, infertilityDuration: d },
                        }));
                        setDirty(true);
                      }}
                      placeholder="e.g. 24"
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Label className="text-xs font-semibold block mb-1.5">
                    Secondary Clinical Flags
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SECONDARY_FLAGS.map((flag) => {
                      const selected = data.diagnosis.secondaryFlags.includes(flag);
                      return (
                        <Badge
                          key={flag}
                          variant={selected ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer text-xs px-2.5 py-1 select-none transition-colors",
                            selected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                          )}
                          onClick={() => {
                            setData((prev) => {
                              const list = prev.diagnosis.secondaryFlags;
                              const next = selected
                                ? list.filter((f) => f !== flag)
                                : [...list, flag];
                              return {
                                ...prev,
                                diagnosis: { ...prev.diagnosis, secondaryFlags: next },
                              };
                            });
                            setDirty(true);
                          }}
                        >
                          {flag}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SECTION 5: Cycle Intent */}
            <AccordionItem
              value="intent-sec"
              className="border border-border/70 rounded-xl overflow-hidden bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:bg-muted/30">
                <div className="flex items-center gap-2.5 text-sm font-bold text-foreground">
                  <Layers className="size-4 text-primary" />
                  <span>5. Stimulation Cycle Intent</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    ({data.cycleIntent.cycleType} · {data.cycleIntent.transferPolicy})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <Label className="text-xs font-semibold">Intended Modality *</Label>
                    <select
                      value={data.cycleIntent.cycleType}
                      onChange={(e) => {
                        setData((prev) => ({
                          ...prev,
                          cycleIntent: {
                            ...prev.cycleIntent,
                            cycleType: e.target.value as CycleIntentType,
                          },
                        }));
                        setDirty(true);
                      }}
                      className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3 text-base sm:text-xs"
                    >
                      <option value="ICSI">ICSI (Standard)</option>
                      <option value="IVF">Standard IVF</option>
                      <option value="ICSI + PGT-A">ICSI + PGT-A Biopsy</option>
                      <option value="freeze-all">Elective Freeze-All</option>
                      <option value="DuoStim">DuoStim Double Stimulation</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Planned Transfer Policy *</Label>
                    <select
                      value={data.cycleIntent.transferPolicy}
                      onChange={(e) => {
                        setData((prev) => ({
                          ...prev,
                          cycleIntent: {
                            ...prev.cycleIntent,
                            transferPolicy: e.target.value as EmbryoTransferPolicy,
                          },
                        }));
                        setDirty(true);
                      }}
                      className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3 text-base sm:text-xs"
                    >
                      <option value="fresh">Planned Fresh Embryo Transfer</option>
                      <option value="freeze-all">Mandatory Freeze-All (Deferred)</option>
                      <option value="planned fresh with fallback freeze">
                        Fresh with Fallback Freeze-All on Hyper-Response
                      </option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Cycle Sequence #</Label>
                    <Input
                      type="number"
                      min={1}
                      value={data.cycleIntent.cycleNumber}
                      onChange={(e) => {
                        setData((prev) => ({
                          ...prev,
                          cycleIntent: {
                            ...prev.cycleIntent,
                            cycleNumber: Number(e.target.value),
                          },
                        }));
                        setDirty(true);
                      }}
                      className="mt-1 text-base sm:text-xs h-10"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Drawer Sticky Footer with Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 px-6 py-4 bg-muted/20">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="hidden sm:inline">Shortcuts:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
              Ctrl+Enter
            </kbd>{" "}
            Save & Open ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
              Esc
            </kbd>{" "}
            Cancel
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-9 text-xs">
              Cancel
            </Button>

            <Button
              variant="secondary"
              size="sm"
              disabled={!validation.isValid}
              onClick={() => handleSaveAttempt(false)}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <Save className="size-3.5" />
              Save
            </Button>

            <Button
              size="sm"
              disabled={!validation.isValid}
              onClick={() => handleSaveAttempt(true)}
              className="h-9 gap-1.5 bg-primary text-primary-foreground text-xs font-semibold shadow-xs"
            >
              <span>Save & Open Case</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Soft Clinical Warning Confirmation Dialog */}
      <Dialog open={showSoftWarningModal} onOpenChange={setShowSoftWarningModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5" />
              Clinical Attention Flags
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1.5">
              The following soft clinical alerts were triggered by the entered physiological
              markers. Please review before opening the case.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {validation.softWarnings.map((warn, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200"
              >
                <div className="font-semibold">{warn.message}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Condition: {warn.triggerCondition}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowSoftWarningModal(false)}>
              Back to Edit
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowSoftWarningModal(false);
                softWarningProceedAction?.();
              }}
              className="bg-primary text-primary-foreground font-semibold"
            >
              Confirm & Open Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
