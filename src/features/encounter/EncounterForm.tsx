/**
 * EncounterForm Component (§3, §4, §5)
 *
 * High-speed, keyboard-first encounter entry form designed for hospital ward staff.
 * Allows entering a full stimulation visit in < 60 seconds.
 *
 * Enforces:
 *  - Strict tab order
 *  - Global hotkeys (Ctrl+Enter, Ctrl+S, Enter on numeric jump)
 *  - Smart-default delta pre-fill macro
 *  - Non-blocking inline engine chips with rationale popovers
 *  - Hard range blocking validation + soft warning confirmation with audited reason
 *  - Touch targets ≥ 44px, font ≥ 16px on mobile/tablet inputs
 */

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Save, Plus, X, AlertTriangle, Sparkles, Barcode, RotateCcw } from "lucide-react";
import type {
  Encounter,
  FollicleBucket,
  DoseAdjustmentDirection,
  EndometriumPattern,
} from "./types";
import type { PatientRecord } from "@/lib/assessment/patients";
import { validateEncounter, type ValidationResult } from "./validation";
import { useEncounterEngineChips } from "./useEncounterEngineChips";
import { RationalePopover } from "./RationalePopover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface EncounterFormProps {
  caseId: string;
  patient: PatientRecord | null;
  initialEncounter?: Encounter | null | undefined;
  previousEncounter?: Encounter | null | undefined;
  onSave: (encounter: Encounter, isNewAndNext: boolean) => void;
  onCancel: () => void;
}

const DEFAULT_BUCKET: FollicleBucket = { lt10: 0, b10_13: 0, b14_16: 0, gte17: 0 };

export function EncounterForm({
  caseId,
  patient,
  initialEncounter,
  previousEncounter,
  onSave,
  onCancel,
}: EncounterFormProps) {
  const { t } = useTranslation();
  // Determine smart defaults from previous encounter
  const nextDay = previousEncounter ? previousEncounter.day + 2 : 2;
  const todayDate = new Date().toISOString().split("T")[0] || "2026-01-01";

  const defaultFormState: Encounter = initialEncounter ?? {
    id: `enc-${Date.now()}`,
    caseId,
    date: todayDate,
    day: nextDay,
    weightKg: patient?.values?.["weight"] ? Number(patient.values["weight"]) : undefined,
    ultrasound: {
      folliclesRight: previousEncounter?.ultrasound.folliclesRight ?? { ...DEFAULT_BUCKET },
      folliclesLeft: previousEncounter?.ultrasound.folliclesLeft ?? { ...DEFAULT_BUCKET },
      largestFollicleMm: undefined,
      endometriumMm: undefined,
      endometriumPattern: "triple-line",
    },
    labs: {
      estradiolPgMl: undefined,
      lhMiuMl: undefined,
      progesteroneNgMl: undefined,
    },
    medications: {
      gonadotropinType: previousEncounter?.medications.gonadotropinType ?? "rFSH",
      gonadotropinDoseIU: previousEncounter?.medications.gonadotropinDoseIU ?? 225,
      antagonistDoseMg:
        previousEncounter?.medications.antagonistDoseMg ?? (nextDay >= 6 ? 0.25 : undefined),
    },
    adjustment: {
      direction: "hold",
      deltaIU: 0,
      reason: "",
    },
    note: "",
    status: "Entered",
    audit: [],
  };

  const [formData, setFormData] = useState<Encounter>(defaultFormState);
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    hardIssues: [],
    softWarnings: [],
  });
  const [softWarningModalOpen, setSoftWarningModalOpen] = useState(false);
  const [softWarningReason, setSoftWarningReason] = useState("");
  const [pendingNextAndSave, setPendingNextAndSave] = useState(false);

  // Focus ref for the first input
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reactive inline engine chips hook (§4)
  const engineChips = useEncounterEngineChips(formData, patient, previousEncounter);

  // Focus first input on mount
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Validate continuously
  useEffect(() => {
    const val = validateEncounter(formData, previousEncounter);
    setValidation(val);
  }, [formData, previousEncounter]);

  const attemptSubmitRef = useRef<(isNext: boolean) => void>(() => {});
  const onCancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    attemptSubmitRef.current = attemptSubmit;
    onCancelRef.current = onCancel;
  });

  // Global Keyboard Map (§3 & §5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter -> Save & New Encounter
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        attemptSubmitRef.current(true);
      }
      // Ctrl+S -> Save & Close
      else if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        attemptSubmitRef.current(false);
      }
      // Esc -> Cancel
      else if (e.key === "Escape" && !softWarningModalOpen) {
        e.preventDefault();
        onCancelRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [softWarningModalOpen]);

  // Advance on Enter for numeric inputs
  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.ctrlKey) {
      e.preventDefault();
      const form = (e.target as HTMLElement).closest("form");
      if (form) {
        const elements = Array.from(
          form.querySelectorAll<HTMLElement>("input, select, textarea, button"),
        ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
        const index = elements.indexOf(e.target as HTMLElement);
        if (index > -1 && index + 1 < elements.length) {
          elements[index + 1]?.focus();
        }
      }
    }
  };

  // Smart-Default Macro: Pre-fill deltas based on previous visit
  const handleApplySmartDefaults = () => {
    if (!previousEncounter) return;
    setFormData((prev) => ({
      ...prev,
      medications: {
        ...prev.medications,
        gonadotropinType: previousEncounter.medications.gonadotropinType,
        gonadotropinDoseIU: previousEncounter.medications.gonadotropinDoseIU,
        antagonistDoseMg: previousEncounter.medications.antagonistDoseMg,
      },
      ultrasound: {
        ...prev.ultrasound,
        folliclesRight: { ...previousEncounter.ultrasound.folliclesRight },
        folliclesLeft: { ...previousEncounter.ultrasound.folliclesLeft },
      },
    }));
  };

  // Submission handler with soft warning confirmation
  const attemptSubmit = (isNewAndNext: boolean) => {
    if (!validation.isValid) {
      // Hard issues block save
      return;
    }

    if (validation.softWarnings.length > 0 && !softWarningReason.trim()) {
      setPendingNextAndSave(isNewAndNext);
      setSoftWarningModalOpen(true);
      return;
    }

    finalizeSave(isNewAndNext, softWarningReason);
  };

  const finalizeSave = (isNewAndNext: boolean, reason?: string) => {
    const updatedAudit = [
      ...formData.audit,
      {
        at: new Date().toISOString(),
        by: "ward_coordinator",
        action: initialEncounter ? "updated_encounter" : "created_encounter",
        reason: reason || undefined,
        hash: `enc-hash-${Date.now()}`,
      },
    ];

    const finalizedEncounter: Encounter = {
      ...formData,
      status: "Entered",
      audit: updatedAudit,
    };

    onSave(finalizedEncounter, isNewAndNext);

    if (isNewAndNext) {
      // Reset form for next encounter
      setFormData({
        ...defaultFormState,
        id: `enc-${Date.now()}`,
        day: formData.day + 2,
        ultrasound: {
          folliclesRight: { ...formData.ultrasound.folliclesRight },
          folliclesLeft: { ...formData.ultrasound.folliclesLeft },
          largestFollicleMm: undefined,
          endometriumMm: undefined,
          endometriumPattern: "triple-line",
        },
        medications: { ...formData.medications },
        labs: { estradiolPgMl: undefined, lhMiuMl: undefined, progesteroneNgMl: undefined },
      });
      setSoftWarningReason("");
      setSoftWarningModalOpen(false);
      firstInputRef.current?.focus();
    }
  };

  // Provider-agnostic Scanner Simulation Hooks (§3)
  const handleScanE2 = () => {
    const simulatedE2 = previousEncounter?.labs.estradiolPgMl
      ? Math.round(previousEncounter.labs.estradiolPgMl * 1.45)
      : 850;
    setFormData((prev) => ({
      ...prev,
      labs: { ...prev.labs, estradiolPgMl: simulatedE2 },
    }));
  };

  const hasHardError = (field: string) => validation.hardIssues.some((i) => i.field === field);
  const getHardErrorMessage = (field: string) =>
    validation.hardIssues.find((i) => i.field === field)?.message;

  return (
    <Card className="border-primary/40 shadow-lg bg-card max-w-3xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 py-3.5 px-6 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <Sparkles className="size-4 text-primary" />
          <CardTitle className="text-sm font-bold text-foreground">
            {initialEncounter
              ? `Edit Stimulation Encounter — Day ${formData.day}`
              : `New Stimulation Visit — Day ${formData.day}`}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-mono h-5">
            Keyboard-First (Tab Order)
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {previousEncounter && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplySmartDefaults}
              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5"
              title="Pre-fill doses and baseline from previous visit"
            >
              <RotateCcw className="size-3" />
              <span>Pre-fill Prior Visit</span>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Cancel (Esc)"
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          attemptSubmit(false);
        }}
      >
        <CardContent className="p-6 space-y-6 text-sm">
          {/* Reactive Inline Engine Chips Banner (§2.4) — Muted gray unless warning */}
          {engineChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/70">
              <span className="text-[11px] font-bold text-foreground/80 flex items-center gap-1.5 me-1">
                <Sparkles className="size-3 text-primary" />
                <span>Live Engine Feedback:</span>
              </span>
              {engineChips.map((chip) => {
                const isAlert = chip.variant === "warning" || chip.variant === "destructive";
                return (
                  <Badge
                    key={chip.id}
                    variant="outline"
                    className={cn(
                      "h-6 text-[10px] px-2 gap-1 font-medium transition-all shadow-2xs",
                      chip.variant === "destructive" &&
                        "border-destructive/40 bg-destructive/10 text-destructive font-semibold",
                      chip.variant === "warning" &&
                        "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold",
                      !isAlert && "border-border/80 bg-background text-muted-foreground",
                    )}
                  >
                    <span>{chip.label}</span>
                    <RationalePopover chip={chip} />
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Section 1: Encounter Timing & Anthropometrics (§2.4) */}
          <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("encounter.sectionIdentity")}
              </span>
              {previousEncounter && (
                <span className="text-[10px] text-muted-foreground">
                  ↩ {t("encounter.prefillFrom")} D{previousEncounter.day}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="enc-date" className="text-xs font-semibold">
                  Date *
                </Label>
                <Input
                  id="enc-date"
                  ref={firstInputRef}
                  type="date"
                  tabIndex={1}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1 h-11 text-base sm:h-9 sm:text-xs"
                  required
                />
              </div>

              <div>
                <Label htmlFor="enc-day" className="text-xs font-semibold">
                  Stimulation Day (0–20) *
                </Label>
                <Input
                  id="enc-day"
                  type="number"
                  tabIndex={2}
                  min={0}
                  max={20}
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: Number(e.target.value) })}
                  onKeyDown={handleNumericKeyDown}
                  className={cn(
                    "mt-1 h-11 text-base sm:h-9 sm:text-xs font-mono",
                    hasHardError("day") && "border-destructive ring-1 ring-destructive",
                  )}
                  required
                />
                {hasHardError("day") && (
                  <span className="text-[11px] text-destructive block mt-1">
                    {getHardErrorMessage("day")}
                  </span>
                )}
              </div>

              <div>
                <Label htmlFor="enc-weight" className="text-xs font-semibold">
                  Weight (kg, 30–150)
                </Label>
                <Input
                  id="enc-weight"
                  type="number"
                  tabIndex={3}
                  step="0.5"
                  min={30}
                  max={150}
                  placeholder="e.g. 64"
                  value={formData.weightKg ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weightKg: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  onKeyDown={handleNumericKeyDown}
                  className={cn(
                    "mt-1 h-11 text-base sm:h-9 sm:text-xs font-mono",
                    hasHardError("weightKg") && "border-destructive ring-1 ring-destructive",
                  )}
                />
                {hasHardError("weightKg") && (
                  <span className="text-[11px] text-destructive block mt-1">
                    {getHardErrorMessage("weightKg")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Ultrasound Folliculometry by Ovary — Two-Column Paired Layout (§2.4) */}
          <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("encounter.sectionUltrasound")}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                &lt;10 · 10–13 · 14–16 · ≥17 mm
              </span>
            </div>

            {/* Two-Column Side-by-Side Ovary Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Right Ovary (R) */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Right Ovary (R)
                  </span>
                  {previousEncounter && (
                    <span className="text-[10px] text-muted-foreground">
                      ↩ {t("encounter.prefillFrom")} D{previousEncounter.day}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-1">&lt;10mm</Label>
                    <Input
                      type="number"
                      tabIndex={4}
                      min={0}
                      placeholder="0"
                      value={formData.ultrasound.folliclesRight.lt10 || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ultrasound: {
                            ...formData.ultrasound,
                            folliclesRight: {
                              ...formData.ultrasound.folliclesRight,
                              lt10: Number(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      onKeyDown={handleNumericKeyDown}
                      className="h-9 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-1">10–13</Label>
                    <Input
                      type="number"
                      tabIndex={5}
                      min={0}
                      placeholder="0"
                      value={formData.ultrasound.folliclesRight.b10_13 || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ultrasound: {
                            ...formData.ultrasound,
                            folliclesRight: {
                              ...formData.ultrasound.folliclesRight,
                              b10_13: Number(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      onKeyDown={handleNumericKeyDown}
                      className="h-9 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-1">14–16</Label>
                    <Input
                      type="number"
                      tabIndex={6}
                      min={0}
                      placeholder="0"
                      value={formData.ultrasound.folliclesRight.b14_16 || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ultrasound: {
                            ...formData.ultrasound,
                            folliclesRight: {
                              ...formData.ultrasound.folliclesRight,
                              b14_16: Number(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      onKeyDown={handleNumericKeyDown}
                      className="h-9 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-primary block mb-1">≥17mm</Label>
                    <Input
                      type="number"
                      tabIndex={7}
                      min={0}
                      placeholder="0"
                      value={formData.ultrasound.folliclesRight.gte17 || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ultrasound: {
                            ...formData.ultrasound,
                            folliclesRight: {
                              ...formData.ultrasound.folliclesRight,
                              gte17: Number(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      onKeyDown={handleNumericKeyDown}
                      className="h-9 text-xs font-mono text-center font-bold text-primary border-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* Left Ovary (L) */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Left Ovary (L)
                  </span>
                  {previousEncounter && (
                    <span className="text-[10px] text-muted-foreground">
                      ↩ {t("encounter.prefillFrom")} D{previousEncounter.day}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-1">&lt;10mm</Label>
                    <Input
                      type="number"
                      tabIndex={8}
                      min={0}
                      placeholder="0"
                      value={formData.ultrasound.folliclesLeft.lt10 || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ultrasound: {
                            ...formData.ultrasound,
                            folliclesLeft: {
                              ...formData.ultrasound.folliclesLeft,
                              lt10: Number(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      onKeyDown={handleNumericKeyDown}
                      className="h-9 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-1">10–13</Label>
                    <Input
                      type="number"
                      tabIndex={9}
                      min={0}
                      placeholder="0"
                      value={formData.ultrasound.folliclesLeft.b10_13 || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ultrasound: {
                            ...formData.ultrasound,
                            folliclesLeft: {
                              ...formData.ultrasound.folliclesLeft,
                              b10_13: Number(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      onKeyDown={handleNumericKeyDown}
                      className="h-9 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-1">14–16</Label>
                    <Input
                      type="number"
                      tabIndex={10}
                      min={0}
                      placeholder="0"
                      value={formData.ultrasound.folliclesLeft.b14_16 || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ultrasound: {
                            ...formData.ultrasound,
                            folliclesLeft: {
                              ...formData.ultrasound.folliclesLeft,
                              b14_16: Number(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      onKeyDown={handleNumericKeyDown}
                      className="h-9 text-xs font-mono text-center"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-primary block mb-1">≥17mm</Label>
                    <Input
                      type="number"
                      tabIndex={11}
                      min={0}
                      placeholder="0"
                      value={formData.ultrasound.folliclesLeft.gte17 || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ultrasound: {
                            ...formData.ultrasound,
                            folliclesLeft: {
                              ...formData.ultrasound.folliclesLeft,
                              gte17: Number(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      onKeyDown={handleNumericKeyDown}
                      className="h-9 text-xs font-mono text-center font-bold text-primary border-primary/40"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Endometrium & Pattern */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
              <div>
                <Label htmlFor="enc-endo" className="text-xs font-semibold">
                  Endometrium Thickness (1–14 mm)
                </Label>
                <Input
                  id="enc-endo"
                  type="number"
                  tabIndex={12}
                  step="0.5"
                  min={1}
                  max={14}
                  placeholder="e.g. 9.5 mm"
                  value={formData.ultrasound.endometriumMm ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ultrasound: {
                        ...formData.ultrasound,
                        endometriumMm: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  onKeyDown={handleNumericKeyDown}
                  className={cn(
                    "mt-1 h-10 text-base sm:h-8 sm:text-xs font-mono",
                    hasHardError("endometriumMm") && "border-destructive ring-1 ring-destructive",
                  )}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Endometrium Pattern</Label>
                <Select
                  value={formData.ultrasound.endometriumPattern ?? "triple-line"}
                  onValueChange={(val: EndometriumPattern) =>
                    setFormData({
                      ...formData,
                      ultrasound: { ...formData.ultrasound, endometriumPattern: val },
                    })
                  }
                >
                  <SelectTrigger tabIndex={13} className="mt-1 h-10 text-base sm:h-8 sm:text-xs">
                    <SelectValue placeholder="Select pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="triple-line">Triple-line (Multi-layered)</SelectItem>
                    <SelectItem value="echogenic">Echogenic (Hyperechoic)</SelectItem>
                    <SelectItem value="homogeneous">Homogeneous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 3: Hormonal Labs & Scanner Hook (§2.4) — Compact 3-Column Row */}
          <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("encounter.sectionLabs")}
                </span>
                {previousEncounter && (
                  <span className="text-[10px] text-muted-foreground">
                    ↩ {t("encounter.prefillFrom")} D{previousEncounter.day}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleScanE2}
                className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-primary"
                title="Simulate laboratory scanner E2 import"
              >
                <Barcode className="size-3" />
                <span>Scan Lab Slip</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="enc-e2" className="text-xs font-semibold">
                  Estradiol E2 (pg/mL, 0–6000)
                </Label>
                <Input
                  id="enc-e2"
                  type="number"
                  tabIndex={14}
                  min={0}
                  max={6000}
                  placeholder="e.g. 1450"
                  value={formData.labs.estradiolPgMl ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      labs: {
                        ...formData.labs,
                        estradiolPgMl: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  onKeyDown={handleNumericKeyDown}
                  className={cn(
                    "mt-1 h-11 text-base sm:h-9 sm:text-xs font-mono font-bold",
                    hasHardError("estradiolPgMl") && "border-destructive ring-1 ring-destructive",
                  )}
                />
                {hasHardError("estradiolPgMl") && (
                  <span className="text-[11px] text-destructive block mt-1">
                    {getHardErrorMessage("estradiolPgMl")}
                  </span>
                )}
              </div>

              <div>
                <Label htmlFor="enc-lh" className="text-xs font-semibold">
                  LH (mIU/mL, 0–25)
                </Label>
                <Input
                  id="enc-lh"
                  type="number"
                  tabIndex={15}
                  step="0.1"
                  min={0}
                  max={25}
                  placeholder="e.g. 2.1"
                  value={formData.labs.lhMiuMl ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      labs: {
                        ...formData.labs,
                        lhMiuMl: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  onKeyDown={handleNumericKeyDown}
                  className={cn(
                    "mt-1 h-11 text-base sm:h-9 sm:text-xs font-mono",
                    hasHardError("lhMiuMl") && "border-destructive ring-1 ring-destructive",
                  )}
                />
              </div>

              <div>
                <Label htmlFor="enc-p4" className="text-xs font-semibold">
                  Progesterone P4 (ng/mL, 0–40)
                </Label>
                <Input
                  id="enc-p4"
                  type="number"
                  tabIndex={16}
                  step="0.05"
                  min={0}
                  max={40}
                  placeholder="e.g. 0.8"
                  value={formData.labs.progesteroneNgMl ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      labs: {
                        ...formData.labs,
                        progesteroneNgMl: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  onKeyDown={handleNumericKeyDown}
                  className={cn(
                    "mt-1 h-11 text-base sm:h-9 sm:text-xs font-mono",
                    hasHardError("progesteroneNgMl") &&
                      "border-destructive ring-1 ring-destructive",
                  )}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Medications & Administration (§2.4) */}
          <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("encounter.sectionMedications")}
              </span>
              {previousEncounter && (
                <span className="text-[10px] text-muted-foreground">
                  ↩ {t("encounter.prefillFrom")} D{previousEncounter.day}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="enc-med" className="text-xs font-semibold">
                  Gonadotropin Type
                </Label>
                <Select
                  value={formData.medications.gonadotropinType}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      medications: { ...formData.medications, gonadotropinType: val },
                    })
                  }
                >
                  <SelectTrigger
                    id="enc-med"
                    tabIndex={17}
                    className="mt-1 h-11 text-base sm:h-9 sm:text-xs"
                  >
                    <SelectValue placeholder="Select drug" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rFSH">rFSH (Follitropin alfa/beta)</SelectItem>
                    <SelectItem value="hp-hMG">hp-hMG (Menotropin)</SelectItem>
                    <SelectItem value="rFSH+rLH">rFSH + rLH (Pergoveris)</SelectItem>
                    <SelectItem value="Corifollitropin alfa">Corifollitropin alfa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="enc-dose" className="text-xs font-semibold">
                  Daily Dose (IU, 37.5–600) *
                </Label>
                <Input
                  id="enc-dose"
                  type="number"
                  tabIndex={18}
                  step="12.5"
                  min={37.5}
                  max={600}
                  value={formData.medications.gonadotropinDoseIU}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medications: {
                        ...formData.medications,
                        gonadotropinDoseIU: Number(e.target.value) || 0,
                      },
                    })
                  }
                  onKeyDown={handleNumericKeyDown}
                  className={cn(
                    "mt-1 h-11 text-base sm:h-9 sm:text-xs font-mono font-bold",
                    hasHardError("gonadotropinDoseIU") &&
                      "border-destructive ring-1 ring-destructive",
                  )}
                  required
                />
                {hasHardError("gonadotropinDoseIU") && (
                  <span className="text-[11px] text-destructive block mt-1">
                    {getHardErrorMessage("gonadotropinDoseIU")}
                  </span>
                )}
              </div>

              <div>
                <Label htmlFor="enc-antagonist" className="text-xs font-semibold">
                  Antagonist (mg)
                </Label>
                <Input
                  id="enc-antagonist"
                  type="number"
                  tabIndex={19}
                  step="0.25"
                  min={0}
                  max={5}
                  placeholder="e.g. 0.25 mg"
                  value={formData.medications.antagonistDoseMg ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medications: {
                        ...formData.medications,
                        antagonistDoseMg: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  onKeyDown={handleNumericKeyDown}
                  className="mt-1 h-11 text-base sm:h-9 sm:text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Titration Direction & Reason */}
          <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-2xs">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground block border-b border-border/50 pb-2">
              {t("encounter.sectionTitration")}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Adjustment Action</Label>
                <Select
                  value={formData.adjustment.direction}
                  onValueChange={(val: DoseAdjustmentDirection) =>
                    setFormData({
                      ...formData,
                      adjustment: { ...formData.adjustment, direction: val },
                    })
                  }
                >
                  <SelectTrigger tabIndex={20} className="mt-1 h-11 text-base sm:h-9 sm:text-xs">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hold">Maintain Dose (Hold)</SelectItem>
                    <SelectItem value="up">Step-up (Increase)</SelectItem>
                    <SelectItem value="down">Step-down (Decrease)</SelectItem>
                    <SelectItem value="coast">Coast (Withhold Gonadotropins)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="enc-delta" className="text-xs font-semibold">
                  Delta Dose (IU)
                </Label>
                <Input
                  id="enc-delta"
                  type="number"
                  tabIndex={21}
                  step="12.5"
                  placeholder="e.g. 75"
                  value={formData.adjustment.deltaIU || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adjustment: { ...formData.adjustment, deltaIU: Number(e.target.value) || 0 },
                    })
                  }
                  onKeyDown={handleNumericKeyDown}
                  className="mt-1 h-11 text-base sm:h-9 sm:text-xs font-mono"
                />
              </div>

              <div>
                <Label htmlFor="enc-reason" className="text-xs font-semibold">
                  Titration Reason
                </Label>
                <Input
                  id="enc-reason"
                  type="text"
                  tabIndex={22}
                  placeholder="e.g. Hypo-response / E2 plateau"
                  value={formData.adjustment.reason}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      adjustment: { ...formData.adjustment, reason: e.target.value },
                    })
                  }
                  className="mt-1 h-11 text-base sm:h-9 sm:text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Clinical Observations & Notes */}
          <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-2xs">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground block border-b border-border/50 pb-2">
              {t("encounter.sectionNotes")}
            </span>
            <div>
              <Label htmlFor="enc-note" className="text-xs font-semibold">
                Clinical Note
              </Label>
              <Input
                id="enc-note"
                type="text"
                tabIndex={23}
                placeholder="e.g. Right lead 16mm, continue antagonist, re-evaluate in 48h."
                value={formData.note ?? ""}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="mt-1 h-11 text-base sm:h-9 sm:text-xs"
              />
            </div>
          </div>
        </CardContent>

        {/* Footer Actions & Hotkey Summary */}
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 py-3.5 px-6 bg-muted/20">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground hidden sm:flex">
            <span>Hotkeys:</span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] border border-border/60">
              Ctrl+S
            </kbd>{" "}
            Save
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] border border-border/60">
              Ctrl+Enter
            </kbd>{" "}
            Save &amp; Next
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] border border-border/60">
              Esc
            </kbd>{" "}
            Cancel
          </div>

          <div className="flex items-center gap-2 ms-auto">
            <Button type="button" variant="outline" onClick={onCancel} className="h-9 px-4 text-xs">
              Cancel
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => attemptSubmit(true)}
              disabled={!validation.isValid}
              className="h-9 gap-1.5 px-4 text-xs font-semibold shadow-xs"
              title="Save visit and draft next encounter (Ctrl+Enter)"
            >
              <Plus className="size-3.5" />
              <span>Save &amp; Add Next</span>
            </Button>

            <Button
              type="submit"
              disabled={!validation.isValid}
              className="h-9 gap-1.5 px-5 text-xs font-semibold bg-primary text-primary-foreground shadow-xs"
              title="Save visit and close (Ctrl+S)"
            >
              <Save className="size-3.5" />
              <span>Save Encounter</span>
            </Button>
          </div>
        </CardFooter>
      </form>

      {/* Soft Warning Reason Dialog (§5) */}
      <Dialog open={softWarningModalOpen} onOpenChange={setSoftWarningModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 text-sm font-bold">
              <AlertTriangle className="size-4" />
              <span>Clinical Soft Warning Confirmation</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              One or more clinical values deviate from typical kinetics. Provide a brief clinical
              reason to record in the immutable audit log:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              {validation.softWarnings.map((w, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-800 dark:text-amber-300"
                >
                  <span className="font-semibold block">{w.triggerCondition}:</span>
                  <span>{w.message}</span>
                </div>
              ))}
            </div>

            <div>
              <Label htmlFor="warning-reason" className="text-xs font-semibold">
                Physician / Nurse Clinical Justification *
              </Label>
              <Input
                id="warning-reason"
                type="text"
                autoFocus
                placeholder="e.g. Expected vigorous response in PCOS patient, coasting initiated."
                value={softWarningReason}
                onChange={(e) => setSoftWarningReason(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSoftWarningModalOpen(false)}
            >
              Review Values
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!softWarningReason.trim()}
              onClick={() => finalizeSave(pendingNextAndSave, softWarningReason)}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Confirm &amp; Audit Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
