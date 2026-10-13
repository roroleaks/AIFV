import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { usePatients } from "@/lib/assessment/patients";
import { buildPhenotype } from "@/lib/engine/phenotype";
import { predictOvarianResponse } from "@/lib/engine/ovarian-response";
import { logAudit } from "@/lib/engine/audit";
import {
  CONSORT_CALCULATOR_VERSION,
  calculateConsortDose,
  consortStatusLabel,
} from "@/lib/engine/consort-dose";
import { saveConsortDose } from "@/lib/engine/consort-store";
import { ConsortActions, ConsortSection } from "@/components/engine/consort-panel";

const title = "CONSORT Starting Dose Calculator — IVF Ai Calc";
const description =
  "Individualized recombinant FSH starting dose calculated with the validated CONSORT methodology from age, BMI, basal FSH and antral follicle count, with full variable validation and evidence traceability.";

export const Route = createFileRoute("/_shell/consort")({
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
  component: ConsortPage,
});

function ConsortPage() {
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

  const result = useMemo(() => {
    const phenotype = buildPhenotype(source.values, source.cycles);
    const response = predictOvarianResponse(
      source.values,
      source.cycles,
      phenotype.poseidon,
      phenotype.bologna,
    );
    return calculateConsortDose(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
    );
  }, [source]);

  useEffect(() => {
    saveConsortDose(result);
    logAudit({
      user: "Clinician (local session)",
      patient: source.name,
      moduleId: "consort-dose",
      moduleName: "CONSORT Starting Dose Calculator",
      action: "assessment-completed",
      version: CONSORT_CALCULATOR_VERSION,
      detail: `${consortStatusLabel[result.status]}${result.dose === null ? "" : ` · ${result.dose} IU/day`}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, result.status, result.dose]);

  return (
    <>
      <PageHeader
        eyebrow="CONSORT Calculator"
        title="Individualized Starting Dose Calculator"
        description="Calculates the individualized recombinant FSH starting dose using only the variables required by the validated CONSORT model — age, body mass index, basal FSH and antral follicle count. No dose is produced when a mandatory variable is missing, invalid or conflicting."
      />

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
          CONSORT Calculator v{CONSORT_CALCULATOR_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Recombinant FSH only
        </Badge>
        <ConsortActions result={result} />
      </div>

      <ConsortSection result={result} />
    </>
  );
}
