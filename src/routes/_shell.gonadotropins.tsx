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
import { buildProtocolRecommendation } from "@/lib/engine/protocol-recommendation";
import { logAudit } from "@/lib/engine/audit";
import {
  GONADOTROPIN_ENGINE_VERSION,
  buildGonadotropinSelection,
} from "@/lib/engine/gonadotropin-selection";
import {
  GonadotropinActions,
  GonadotropinSelectionSection,
} from "@/components/engine/gonadotropin-panel";
import {
  GONADOTROPIN_EVIDENCE_VERSION,
  buildGonadotropinEvidenceReview,
} from "@/lib/engine/gonadotropin-evidence";
import { GonadotropinEvidenceSection } from "@/components/engine/gonadotropin-evidence-panel";
import {
  getProtocolDecision,
  protocolDecisionLabel,
} from "@/lib/engine/protocol-decision-store";
import { getConsortDose } from "@/lib/engine/consort-store";

const title = "Gonadotropin Selection Engine — IVF Ai Calc";
const description =
  "Medication selection framework organising recombinant FSH, urinary FSH, highly purified hMG, recombinant LH and combination preparations. Selection rules activate only after validated ESHRE and ASRM evidence is imported.";

export const Route = createFileRoute("/_shell/gonadotropins")({
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
  component: GonadotropinsPage,
});

function GonadotropinsPage() {
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
    const protocol = buildProtocolRecommendation(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
    );
    const legacy = buildGonadotropinSelection(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
      protocol,
    );
    const storedProtocolDecision = getProtocolDecision(source.id);
    const evidence = buildGonadotropinEvidenceReview(
      source.id,
      source.name,
      source.values,
      source.cycles,
      phenotype,
      response,
      {
        protocolName: storedProtocolDecision?.protocol ?? null,
        protocolEvidenceStatus: "Evidence Pending — protocol selection rules not loaded",
        protocolDecisionStatus: storedProtocolDecision
          ? protocolDecisionLabel[storedProtocolDecision.kind]
          : "No physician protocol decision recorded",
        consortDoseFromStore: getConsortDose(source.id)?.dose ?? null,
      },
    );
    return { legacy, evidence };
  }, [source]);

  useEffect(() => {
    logAudit({
      user: "Clinician (local session)",
      patient: source.name,
      moduleId: "gonadotropin-selection",
      moduleName: "Gonadotropin Selection Engine",
      action: "assessment-completed",
      version: GONADOTROPIN_EVIDENCE_VERSION,
      detail: `Evidence review opened · ${result.legacy.cycleReview.length} previous cycle(s) reviewed · selection rules not implemented · physician decision required`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id, result.legacy.cycleReview.length]);


  const guidelinePopulations = useMemo(() => {
    const ph = buildPhenotype(source.values, source.cycles);
    const resp = predictOvarianResponse(source.values, source.cycles, ph.poseidon, ph.bologna);
    return derivePopulationTags(ph, resp, source.values);
  }, [source]);

  return (
    <>
      <PageHeader
        eyebrow="Gonadotropin Selection"
        title="Gonadotropin Selection Engine"
        description="Evidence review of the gonadotropin preparations that have an indexed evidence record, with patient applicability, previous gonadotropin experience and a physician decision log. No medication is recommended and no dose, dose range or dose adjustment is produced. Organises every gonadotropin preparation and the patient information that future evidence-based selection rules will consume: phenotype, POSEIDON, Bologna, ovarian reserve, ovarian response, protocol framework and previous stimulation outcomes. No medication, LH supplementation or dose is recommended in this release."
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
          Gonadotropin Engine v{GONADOTROPIN_ENGINE_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Evidence Review v{GONADOTROPIN_EVIDENCE_VERSION}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Evidence review only — no dose
        </Badge>
        <GonadotropinActions result={result.legacy} />
      </div>

      <GonadotropinEvidenceSection result={result.evidence} />

      <GuidelineRecommendationsPanel module="gonadotropin-selection" populations={guidelinePopulations} />

      <GonadotropinSelectionSection result={result.legacy} />
    </>
  );
}
