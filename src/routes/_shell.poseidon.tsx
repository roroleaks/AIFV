import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PoseidonCard } from "@/components/engine/poseidon-card";
import { PoseidonSummary } from "@/components/engine/poseidon-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { usePatients } from "@/lib/assessment/patients";
import { classifyPoseidon } from "@/lib/engine/poseidon";
import { POSEIDON_ENGINE_VERSION, savePoseidonAssessment } from "@/lib/engine/poseidon-store";
import { logAudit } from "@/lib/engine/audit";
import { WorkflowStepper } from "@/components/workflow-stepper";

const title = "POSEIDON Clinical Assessment — IVF Ai Calc";
const description =
  "Explainable POSEIDON clinical assessment based on female age, AMH, antral follicle count and previous ovarian response. Classification only — no treatment recommendation.";

export const Route = createFileRoute("/_shell/poseidon")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PoseidonPage,
});

function PoseidonPage() {
  const { draft } = useAssessment();
  const { records } = usePatients();
  const [selected, setSelected] = useState<string>("draft");
  const [processing, setProcessing] = useState(true);
  const [progress, setProgress] = useState(12);

  const source = useMemo(() => {
    const patient = records.find((r) => r.id === selected);
    if (patient)
      return {
        id: patient.id,
        name: patient.name,
        values: patient.values,
        cycles: patient.cycleRecords,
      };
    return {
      id: "draft",
      name: String(draft.values["fullName"] ?? "Current assessment draft"),
      values: draft.values,
      cycles: draft.cycles,
    };
  }, [records, selected, draft]);

  const result = useMemo(
    () => classifyPoseidon(source.values, source.cycles),
    [source.values, source.cycles],
  );

  // Short processing pass so the physician sees the engine run on each source change.
  useEffect(() => {
    setProcessing(true);
    setProgress(12);
    const steps = [
      window.setTimeout(() => setProgress(45), 90),
      window.setTimeout(() => setProgress(78), 220),
      window.setTimeout(() => setProgress(100), 340),
      window.setTimeout(() => setProcessing(false), 460),
    ];
    return () => steps.forEach((t) => window.clearTimeout(t));
  }, [selected, source.values, source.cycles]);

  // Persist the outcome for future modules + audit trail.
  useEffect(() => {
    if (processing) return;
    savePoseidonAssessment(source.id, source.name, result);
    logAudit({
      user: "Clinician (local session)",
      patient: source.name,
      moduleId: "poseidon",
      moduleName: "POSEIDON Clinical Assessment",
      action: "assessment-completed",
      version: POSEIDON_ENGINE_VERSION,
      detail: `${result.headline} · data ${result.dataQuality} · completeness ${result.confidence}%`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing, source.id, result.headline, result.dataQuality, result.confidence]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Workflow Stage 2 of 8 · POSEIDON & Reserve Phenotyping"
        title="2. POSEIDON Clinical Assessment"
        description="Stage 2 of the clinical workflow: Evaluates the patient against published POSEIDON criteria (Alviggi et al., 2016) and ovarian reserve biomarker thresholds to stratify low prognosis risk."
      />

      <WorkflowStepper currentStage={2} />

      {records.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Users className="size-3.5" /> Data source
          </span>
          <Button
            size="sm"
            variant={selected === "draft" ? "default" : "outline"}
            onClick={() => setSelected("draft")}
          >
            Current draft
          </Button>
          {records.slice(0, 8).map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={selected === r.id ? "default" : "outline"}
              onClick={() => setSelected(r.id)}
            >
              {r.name}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Badge variant="outline" className="rounded-full">
          Module 3 · POSEIDON Engine v{POSEIDON_ENGINE_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Classification only
        </Badge>
      </div>

      {processing ? (
        <section className="animate-rise rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="size-4 animate-spin text-primary" />
            Running POSEIDON assessment…
          </div>
          <Progress value={progress} className="mt-4 h-2" />
          <p className="mt-3 text-xs text-muted-foreground">
            Importing patient variables, validating entries and applying the published criteria.
          </p>
        </section>
      ) : (
        <>
          <PoseidonSummary result={result} patientName={source.name} />
          <PoseidonCard result={result} patientName={source.name} />
        </>
      )}
    </div>
  );
}
