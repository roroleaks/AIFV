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
import { STARTING_DOSE_VERSION, buildStartingDoseAssessment } from "@/lib/engine/starting-dose";
import { StartingDoseActions, StartingDoseSection } from "@/components/engine/starting-dose-panel";
import { getProtocolDecision, protocolDecisionLabel } from "@/lib/engine/protocol-decision-store";
import {
  getGonadotropinDecision,
  gonadotropinDecisionLabel,
  isSelectionKind,
} from "@/lib/engine/gonadotropin-decision-store";
import { getConsortDose } from "@/lib/engine/consort-store";

const title = "Starting Gonadotropin Dose Engine — IVF Ai Calc";
const description =
  "Evidence-gated starting-dose framework: patient inputs, validated algorithm applicability, historical doses and physician decisions. No dose is calculated while validated dosing evidence is pending.";

export const Route = createFileRoute("/_shell/starting-dose")({
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
  component: StartingDosePage,
});

function StartingDosePage() {
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
    const protocolDecision = getProtocolDecision(source.id);
    const gonadotropinDecision = getGonadotropinDecision(source.id);

    return buildStartingDoseAssessment(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
      {
        protocolName: protocolDecision?.protocol ?? null,
        protocolEvidenceStatus: "Evidence Pending — protocol selection rules not loaded",
        protocolDecisionStatus: protocolDecision
          ? protocolDecisionLabel[protocolDecision.kind]
          : "No physician protocol decision recorded",
        gonadotropinName: gonadotropinDecision?.gonadotropin ?? null,
        gonadotropinSelected: gonadotropinDecision
          ? isSelectionKind(gonadotropinDecision.kind)
          : false,
        gonadotropinStatus: gonadotropinDecision
          ? gonadotropinDecisionLabel[gonadotropinDecision.kind]
          : "No physician gonadotropin decision recorded",
        consortDoseFromStore: getConsortDose(source.id)?.dose ?? null,
      },
    );
  }, [source]);

  useEffect(() => {
    logAudit({
      user: "Clinician (local session)",
      patient: source.name,
      moduleId: "starting-dose",
      moduleName: "Starting Gonadotropin Dose Engine",
      action: "assessment-completed",
      version: STARTING_DOSE_VERSION,
      detail: `Starting-dose assessment opened · state ${result.stateLabel} · dose ${
        result.dose === null ? "NOT CALCULATED" : result.dose
      } · CONSORT firewall intact`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, result.stateLabel]);

  return (
    <>
      <PageHeader
        eyebrow="Starting Dose"
        title="Starting Gonadotropin Dose Engine"
        description="Determines whether a validated evidence source permits calculation or selection of an individualized starting gonadotropin dose. Distinguishes historical dose, evidence-reported range, evidence-supported rule, validated calculation, physician-selected dose and evidence-pending dose. No dose is invented, and CONSORT remains completely isolated."
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
          Starting Dose Engine v{STARTING_DOSE_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          CONSORT frozen — dose not calculated
        </Badge>
        <StartingDoseActions result={result} />
      </div>

      <StartingDoseSection result={result} />
    </>
  );
}
