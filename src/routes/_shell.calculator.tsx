import { createFileRoute } from "@tanstack/react-router";
import { Calculator as CalcIcon, Lock } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard, EmptyPlaceholder } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_shell/calculator")({
  head: () => ({
    meta: [
      { title: "Clinical Calculator — IVF Ai Calc" },
      {
        name: "description",
        content: "Workspace reserved for evidence-based stimulation planning modules.",
      },
      { property: "og:title", content: "Clinical Calculator — IVF Ai Calc" },
      {
        property: "og:description",
        content: "Workspace reserved for evidence-based stimulation planning modules.",
      },
    ],
  }),
  component: CalculatorPage,
});

const modules = ["Ovarian Reserve Inputs", "Stimulation Parameters", "Response Projection", "Risk Panel"];

function CalculatorPage() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Clinical Calculator"
        description="Interface scaffold only — no formulas, algorithms or clinical outputs are implemented."
        actions={
          <Badge variant="secondary" className="rounded-lg py-1.5">
            <Lock className="mr-1.5 size-3.5" /> Logic not enabled
          </Badge>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {modules.map((m) => (
          <SectionCard key={m} title={m} description="Awaiting validated methodology">
            <EmptyPlaceholder label="Module placeholder" className="min-h-40" />
          </SectionCard>
        ))}
      </div>

      <SectionCard title="Output" description="Reserved area">
        <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-border bg-muted/40 text-center">
          <div className="p-6">
            <CalcIcon className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No calculations performed</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Clinical logic will be added in a later, separately validated release.
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
