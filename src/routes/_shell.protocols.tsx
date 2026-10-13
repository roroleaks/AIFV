import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { GuidelineRecommendationsPanel } from "@/components/engine/guideline-panel";
import { derivePopulationTags } from "@/lib/engine/guideline-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAssessment } from "@/lib/assessment/use-assessment";
import { usePatients } from "@/lib/assessment/patients";
import { buildPhenotype } from "@/lib/engine/phenotype";
import { predictOvarianResponse } from "@/lib/engine/ovarian-response";
import { logAudit } from "@/lib/engine/audit";
import {
  PROTOCOL_ENGINE_VERSION,
  buildProtocolRecommendation,
} from "@/lib/engine/protocol-recommendation";
import {
  ProtocolActions,
  ProtocolRecommendationSection,
} from "@/components/engine/protocol-recommendation-panel";
import { buildPatientContext } from "@/lib/clinical/data-mapping";
import { getConsortDose } from "@/lib/engine/consort-store";
import {
  PROTOCOL_SELECTION_VERSION,
  buildProtocolSelection,
} from "@/lib/engine/protocol-selection";
import { ProtocolSelectionSection } from "@/components/engine/protocol-selection-panel";

const title = "Protocol Selection Engine — IVF Ai Calc";
const description =
  "Explainable ovarian stimulation protocol framework combining phenotype, POSEIDON, Bologna and ovarian response outputs. Recommendation rules activate only after validated ESHRE and ASRM algorithms are imported.";

export const Route = createFileRoute("/_shell/protocols")({
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
  component: ProtocolsPage,
});

function ProtocolsPage() {
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

  const { result, selection } = useMemo(() => {
    const phenotype = buildPhenotype(source.values, source.cycles);
    const response = predictOvarianResponse(
      source.values,
      source.cycles,
      phenotype.poseidon,
      phenotype.bologna,
    );
    const ctx = buildPatientContext(source.values, source.cycles, response);
    return {
      result: buildProtocolRecommendation(
        source.id,
        source.name,
        source.values,
        source.cycles,
        phenotype,
        response,
      ),
      selection: buildProtocolSelection(
        source.id,
        source.name,
        source.values,
        source.cycles,
        phenotype,
        response,
        ctx,
        getConsortDose(source.id)?.dose ?? null,
      ),
    };
  }, [source]);

  useEffect(() => {
    logAudit({
      user: "Clinician (local session)",
      patient: source.name,
      moduleId: "protocol-selection",
      moduleName: "Protocol Selection Engine",
      action: "assessment-completed",
      version: PROTOCOL_SELECTION_VERSION,
      detail: `Evidence review opened · ${selection.options.length} protocol option(s) reviewed · no recommendation, gonadotropin or dose produced · CONSORT ${selection.consortFirewall.status}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, selection.options.length]);


  const guidelinePopulations = useMemo(() => {
    const ph = buildPhenotype(source.values, source.cycles);
    const resp = predictOvarianResponse(source.values, source.cycles, ph.poseidon, ph.bologna);
    return derivePopulationTags(ph, resp, source.values);
  }, [source]);

  return (
    <>
      <PageHeader
        eyebrow="Protocol Selection"
        title="Protocol Selection Engine"
        description="Evidence review of the ovarian stimulation protocol options documented in the Evidence Library, matched descriptively against this patient's phenotype, POSEIDON and Bologna status and previous cycle response. No protocol, gonadotropin, dose or trigger is recommended, and no CONSORT dose enters this engine."
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
          Protocol Selection v{PROTOCOL_SELECTION_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Protocol Engine v{PROTOCOL_ENGINE_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Evidence review only
        </Badge>
        <ProtocolActions result={result} />
      </div>

      <ProtocolSelectionSection result={selection} />

      <GuidelineRecommendationsPanel module="protocol-recommendation" populations={guidelinePopulations} />

      <ProtocolRecommendationSection result={result} />
    </>
  );
}
