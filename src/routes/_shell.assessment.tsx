import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CloudCheck,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { steps, visibleFields, visibleGroups } from "@/lib/assessment/schema";
import { buildAlerts } from "@/lib/assessment/derived";
import { recordFromDraft, savePatient, syncPatientFromDraft } from "@/lib/assessment/patients";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { AssessmentField } from "@/components/assessment/assessment-field";
import { CyclesStep } from "@/components/assessment/cycles-step";
import { ReviewStep } from "@/components/assessment/review-step";
import { DocumentsStep } from "@/components/assessment/documents-step";
import { TimelineStep } from "@/components/assessment/timeline-step";
import { ClinicalAlertsPanel } from "@/components/assessment/clinical-alerts";
import { SummaryPanel } from "@/components/assessment/summary-panel";

export const Route = createFileRoute("/_shell/assessment")({
  head: () => ({
    meta: [
      { title: "Patient Assessment — IVF Ai Calc" },
      {
        name: "description",
        content:
          "Twelve-step IVF/ICSI patient assessment wizard capturing history, labs, imaging and preferences.",
      },
      { property: "og:title", content: "Patient Assessment — IVF Ai Calc" },
      {
        property: "og:description",
        content:
          "Twelve-step IVF/ICSI patient assessment wizard capturing history, labs, imaging and preferences.",
      },
    ],
  }),
  component: Assessment,
});

function formatSaved(iso: string | null) {
  if (!iso) return "Not saved yet";
  const d = new Date(iso);
  return `Saved ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function Assessment() {
  const {
    draft,
    hydrated,
    savedAt,
    saving,
    completion,
    stepProgress,
    missingByStep,
    setValue,
    setStep,
    addCycle,
    removeCycle,
    setCycleValue,
    addDocuments,
    removeDocument,
    renameDocument,
    saveNow,
    reset,
  } = useAssessment();

  const [resumeShown, setResumeShown] = useState(false);
  const current = draft.currentStep;
  const step = steps[current]!;
  const StepIcon = step.icon;
  const stepPct = Math.round(((current + 1) / steps.length) * 100);
  const alerts = useMemo(
    () => buildAlerts(draft.values, draft.cycles),
    [draft.values, draft.cycles],
  );
  const groups = useMemo(() => visibleGroups(step, draft.values), [step, draft.values]);

  useEffect(() => {
    if (hydrated && savedAt && !resumeShown) {
      setResumeShown(true);
      if (draft.currentStep > 0 || Object.keys(draft.values).length > 0) {
        toast("Draft resumed", { description: `Continuing from step ${draft.currentStep + 1}.` });
      }
    }
  }, [hydrated, savedAt, resumeShown, draft.currentStep, draft.values]);

  // Keep an already-saved patient record in step with the live draft so every
  // engine and the intelligence report read the same values.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => syncPatientFromDraft(draft, completion), 600);
    return () => clearTimeout(t);
  }, [hydrated, draft, completion]);

  const gotoId = (id: string) => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx >= 0) goto(idx);
  };

  const goto = (i: number) => {
    setStep(i);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <PageHeader
        eyebrow={`Step ${current + 1} of ${steps.length}`}
        title="IVF / ICSI Patient Assessment"
        description="Complete structured intake. Data is stored locally for later clinical decision modules — no calculations are performed."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudCheck className="size-3.5 text-emerald" />
              )}
              {saving ? "Saving…" : formatSaved(savedAt)}
            </span>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                saveNow();
                savePatient(recordFromDraft(draft, completion));
                toast.success("Saved to patient records", {
                  description: "Draft stored on this device and listed under Patients.",
                });
              }}
            >
              <Save className="size-4" /> Save draft
            </Button>
            <Button
              variant="ghost"
              className="rounded-xl text-muted-foreground"
              onClick={() => {
                reset();
                toast("Assessment cleared");
              }}
            >
              <RotateCcw className="size-4" /> Reset
            </Button>
          </div>
        }
      />

      {/* Sticky progress + step navigation */}
      <div className="sticky top-16 z-30 -mx-1 rounded-2xl border border-border/70 bg-card/85 px-4 py-4 shadow-soft backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-lg">
              {stepPct}% through
            </Badge>
            <Badge className="rounded-lg bg-emerald-soft text-emerald hover:bg-emerald-soft">
              {completion}% complete
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground sm:hidden">{formatSaved(savedAt)}</p>
        </div>
        <Progress value={completion} className="mt-3 h-1.5" />
        <ol className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {steps.map((s, i) => {
            const prog = stepProgress[i];
            const done = (prog?.percent ?? 0) >= 1 && i !== current;
            const active = i === current;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => goto(i)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active && "border-border bg-primary-soft text-primary",
                    done && "text-emerald",
                    !active && !done && "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                      active && "bg-primary text-primary-foreground",
                      done && "bg-emerald-soft text-emerald",
                      !active && !done && "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap">{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Step header */}
      <div key={step.id} className="animate-rise space-y-5">
        <div className="flex items-start gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
            <StepIcon className="size-7" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{step.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-5">
            {step.custom === "cycles" ? (
              <CyclesStep
                cycles={draft.cycles}
                onAdd={addCycle}
                onRemove={removeCycle}
                onChange={setCycleValue}
              />
            ) : step.custom === "documents" ? (
              <DocumentsStep
                documents={draft.documents}
                onAdd={(files, category) => {
                  const n = addDocuments(files, category);
                  toast.success(`${n} file${n === 1 ? "" : "s"} added`, { description: category });
                }}
                onRemove={removeDocument}
                onRename={renameDocument}
              />
            ) : step.custom === "timeline" ? (
              <TimelineStep values={draft.values} cycles={draft.cycles} />
            ) : step.custom === "review" ? (
              <ReviewStep
                draft={draft}
                completion={completion}
                stepProgress={stepProgress}
                missingByStep={missingByStep}
                onEditStep={goto}
              />
            ) : (
              <div className="space-y-5">
                {groups.map((group) => (
                  <section
                    key={group.title}
                    className="animate-rise rounded-2xl border border-border/70 bg-card shadow-soft"
                  >
                    <div className="border-b border-border/60 px-5 py-4">
                      <h3 className="text-sm font-semibold">{group.title}</h3>
                      {group.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{group.description}</p>
                      )}
                    </div>
                    <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleFields(group, draft.values).map((field) => (
                        <AssessmentField
                          key={field.key}
                          field={field}
                          values={draft.values}
                          value={draft.values[field.key]}
                          onChange={(v) => setValue(field.key, v)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 xl:sticky xl:top-56 xl:self-start">
            <SummaryPanel values={draft.values} cycles={draft.cycles} completion={completion} />
            <ClinicalAlertsPanel alerts={alerts} onGoToStep={gotoId} />
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          className="rounded-xl"
          disabled={current === 0}
          onClick={() => goto(current - 1)}
        >
          <ChevronLeft className="size-4" /> Previous
        </Button>
        <span className="order-last w-full text-center text-xs text-muted-foreground sm:order-none sm:w-auto">
          {stepProgress[current]?.total
            ? `${stepProgress[current]?.filled}/${stepProgress[current]?.total} fields in this section`
            : "Section ready"}
        </span>
        <Button
          className="rounded-xl"
          disabled={current === steps.length - 1}
          onClick={() => goto(current + 1)}
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </>
  );
}
