import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Brain, CircleDashed, Database, Lock, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { knowledgeModules } from "@/lib/clinical/knowledge-model";
import { buildClinicalDataset, moduleReadiness } from "@/lib/clinical/data-mapping";
import { findEvidence } from "@/lib/evidence/library";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { usePatients } from "@/lib/assessment/patients";
import { PHENOTYPE_ENGINE_VERSION, buildPhenotype } from "@/lib/engine/phenotype";
import { savePhenotypeAssessment, usePhenotypeHistory } from "@/lib/engine/phenotype-store";
import { logAudit } from "@/lib/engine/audit";
import {
  OVARIAN_RESPONSE_ENGINE_VERSION,
  predictOvarianResponse,
  responseCategoryLabel,
} from "@/lib/engine/ovarian-response";
import { saveResponsePrediction } from "@/lib/engine/response-store";
import { OvarianResponseSection } from "@/components/engine/ovarian-response-panel";
import {
  BolognaCard,
  FutureModulesPanel,
  MissingDataPanel,
  OvarianReserveCard,
  OverallPhenotypeCard,
  PatientSummaryCard,
  PhenotypeEvidencePanel,
  PhenotypeSummaryPanel,
  PhenotypeTimeline,
  PoseidonPhenotypeCard,
} from "@/components/engine/phenotype-dashboard";
import { ClinicalSafetyBanner } from "@/components/engine/clinical-safety-banner";

const title = "Patient Phenotype Engine — IVF Ai Calc";
const description =
  "Unified physician dashboard combining POSEIDON, Bologna criteria and ovarian reserve biomarkers into one reproductive phenotype. Assessment only — no treatment recommendation.";

export const Route = createFileRoute("/_shell/decision-support")({
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
  component: DecisionSupport,
});

function PhenotypeDashboard() {
  const { draft } = useAssessment();
  const { records } = usePatients();
  const [selected, setSelected] = useState<string>("draft");

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
    () => buildPhenotype(source.values, source.cycles),
    [source.values, source.cycles],
  );

  const response = useMemo(
    () => predictOvarianResponse(source.values, source.cycles, result.poseidon, result.bologna),
    [source.values, source.cycles, result.poseidon, result.bologna],
  );

  const { entries } = usePhenotypeHistory(source.id);

  useEffect(() => {
    savePhenotypeAssessment(source.id, source.name, result);
    logAudit({
      user: "Clinician (local session)",
      patient: source.name,
      moduleId: "patient-phenotype",
      moduleName: "Patient Phenotype Engine",
      action: "assessment-completed",
      version: PHENOTYPE_ENGINE_VERSION,
      detail: `Phenotype ${result.phenotype} · POSEIDON ${result.poseidon.status} · Bologna ${result.bologna.status}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, result.phenotype, result.poseidon.status, result.bologna.status]);

  useEffect(() => {
    saveResponsePrediction(source.id, source.name, response);
    logAudit({
      user: "Clinician (local session)",
      patient: source.name,
      moduleId: "poor-response",
      moduleName: "Ovarian Response Prediction Engine",
      action: "assessment-completed",
      version: OVARIAN_RESPONSE_ENGINE_VERSION,
      detail: `Expected response ${responseCategoryLabel[response.category]} · ${response.risks.length} risk(s) identified`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, response.category, response.risks.length, response.validation.quality]);

  return (
    <div className="grid gap-5">
      <ClinicalSafetyBanner />

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
          Phenotype Engine v{PHENOTYPE_ENGINE_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Response Engine v{OVARIAN_RESPONSE_ENGINE_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Assessment only
        </Badge>
      </div>

      <OverallPhenotypeCard result={result} />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <PatientSummaryCard result={result} name={source.name} />
        <OvarianReserveCard result={result} />
        <PoseidonPhenotypeCard result={result} />
        <BolognaCard result={result.bologna} />
      </div>

      <OvarianResponseSection result={response} />

      <MissingDataPanel result={result} />
      <PhenotypeSummaryPanel result={result} response={response} />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <PhenotypeTimeline entries={entries} />
        <PhenotypeEvidencePanel ids={result.evidence} />
      </div>

      <FutureModulesPanel />
    </div>
  );
}

function DecisionSupport() {
  const { draft, hydrated } = useAssessment();
  const dataset = buildClinicalDataset(draft.values, draft.cycles);
  const readiness = moduleReadiness(dataset);
  const readinessById = new Map(readiness.map((r) => [r.moduleId, r]));
  const captured = dataset.filter((d) => d.present).length;

  return (
    <>
      <PageHeader
        eyebrow="Patient Phenotype Engine"
        title="Decision Support — Patient Phenotype"
        description="One unified physician view combining the implemented assessment engines: POSEIDON classification, the Bologna poor-response definition and the recorded ovarian reserve biomarkers. Assessment only — no treatment, protocol, medication or dose is recommended."
      />

      <PhenotypeDashboard />

      <PageHeader
        eyebrow="Architecture"
        title="Clinical Knowledge Model"
        description="Each module below is an independent, evidence-linked unit. None of them performs a calculation, produces a dose or recommends a protocol — they define what future logic will consume and which publication it must cite."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Knowledge modules", value: knowledgeModules.length, icon: Brain },
          { label: "Mapped variables", value: `${captured}/${dataset.length}`, icon: Database },
          {
            label: "Modules with linked evidence",
            value: knowledgeModules.filter((m) => m.evidence.length > 0).length,
            icon: BookOpen,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
          >
            <s.icon className="size-5 text-primary" />
            <p className="mt-3 text-2xl font-bold">{hydrated ? s.value : "—"}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="Module registry"
        description="Status reflects implementation, not clinical availability."
        contentClassName="p-4"
      >
        <ul className="grid gap-3 xl:grid-cols-2">
          {knowledgeModules.map((m) => {
            const r = readinessById.get(m.id);
            return (
              <li
                key={m.id}
                className="animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Lock className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{m.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.scope}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="ml-auto shrink-0 rounded-lg text-[10px] uppercase"
                  >
                    {m.status === "not-implemented" ? "Locked" : "Awaiting evidence"}
                  </Badge>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Input data captured</span>
                    <span>{r ? `${r.available}/${r.required}` : "—"}</span>
                  </div>
                  <Progress value={hydrated ? (r?.percent ?? 0) : 0} className="h-1.5" />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.outputs.map((o) => (
                    <span
                      key={o}
                      className="rounded-lg bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {o}
                    </span>
                  ))}
                </div>

                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Evidence
                  </p>
                  {m.evidence.length === 0 ? (
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CircleDashed className="size-3" /> No indexed reference yet — module stays
                      disabled.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {m.evidence.map((id) => {
                        const e = findEvidence(id);
                        return (
                          <li key={id} className="text-[11px] text-muted-foreground">
                            <Link
                              to="/evidence"
                              className="font-medium text-primary hover:underline"
                            >
                              {e ? `${e.journal} ${e.year}` : id}
                            </Link>{" "}
                            — {e?.title ?? "Reference pending"}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard
        title="Variable mapping"
        description="Assessment fields translated into the canonical variables a future engine will read."
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Clinical variable</th>
                <th className="px-5 py-3 font-semibold">Unit</th>
                <th className="px-5 py-3 font-semibold">Source field(s)</th>
                <th className="px-5 py-3 font-semibold">Origin</th>
                <th className="px-5 py-3 font-semibold">Current value</th>
              </tr>
            </thead>
            <tbody>
              {dataset.map(({ variable, value, present }) => (
                <tr key={variable.id} className="border-b border-border/40 last:border-0">
                  <td className="px-5 py-2.5 font-medium">{variable.label}</td>
                  <td className="px-5 py-2.5 text-muted-foreground">{variable.unit ?? "—"}</td>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    {variable.source.join(", ")}
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">{variable.origin}</td>
                  <td className="px-5 py-2.5">
                    {hydrated && present ? (
                      <span className="font-semibold">
                        {Array.isArray(value) ? value.join(", ") : String(value)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not captured</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
