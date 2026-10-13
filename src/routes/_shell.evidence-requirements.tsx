import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCopy, Check, FileWarning, Lock, ShieldCheck, Upload } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EVIDENCE_SOURCE_OF_TRUTH,
  blockedModules,
  requirementsRequestText,
  totalRequirementCount,
  type RequirementKind,
} from "@/lib/evidence/requirements";

const title = "Evidence Requirements — IVF Ai Calc";
const description =
  "Exact pages, tables, figures and recommendation statements still required from the master evidence library before each blocked clinical module can be activated.";

export const Route = createFileRoute("/_shell/evidence-requirements")({
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
  component: EvidenceRequirements,
});

const kindLabel: Record<RequirementKind, string> = {
  table: "Table",
  figure: "Figure",
  recommendation: "Recommendation",
  text: "Text section",
  appendix: "Appendix",
};

function EvidenceRequirements() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(requirementsRequestText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Evidence Intelligence Engine"
        title="Evidence Requirements for Blocked Modules"
        description="No clinical algorithm is implemented until its original source table is available. Each module below lists the exact material required to activate it. Nothing is inferred, approximated or recalled from memory."
        actions={
          <Button onClick={copy} variant="outline" className="rounded-xl">
            {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            {copied ? "Copied" : "Copy request list"}
          </Button>
        }
      />

      <SectionCard contentClassName="p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="outline" className="rounded-full">
            <ShieldCheck className="size-3.5" /> Source of truth: {EVIDENCE_SOURCE_OF_TRUTH}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            <Lock className="size-3.5" /> {blockedModules.length} modules blocked
          </Badge>
          <Badge variant="outline" className="rounded-full">
            <FileWarning className="size-3.5" /> {totalRequirementCount} source items outstanding
          </Badge>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Upload the listed pages or tables to the{" "}
          <Link
            to="/evidence"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Evidence Library
          </Link>
          . Each module is wired end-to-end already — transcribing the published values at the
          stated activation point switches the module on without any change to the application
          architecture.
        </p>
      </SectionCard>

      <div className="grid gap-4">
        {blockedModules.map((m) => (
          <SectionCard
            key={m.engineId}
            title={m.name}
            description={m.implemented}
            contentClassName="p-0"
            action={
              m.route ? (
                <Button asChild size="sm" variant="ghost" className="rounded-xl">
                  <Link to={m.route}>Open module</Link>
                </Button>
              ) : (
                <Badge variant="outline" className="rounded-full">
                  Planned
                </Badge>
              )
            }
          >
            {m.note && (
              <p className="border-b border-border/60 bg-amber-500/5 px-5 py-3 text-xs text-amber-700 dark:text-amber-400">
                {m.note}
              </p>
            )}
            <ul className="divide-y divide-border/60">
              {m.requirements.map((r) => (
                <li key={r.item} className="grid gap-1.5 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full" variant="secondary">
                      {kindLabel[r.kind]}
                    </Badge>
                    <span className="text-sm font-semibold">Required: {r.item}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Source: {r.source}
                    {r.locator ? ` — ${r.locator}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Blocked because: {r.blocks}</p>
                </li>
              ))}
            </ul>
            <div className="flex items-start gap-2 border-t border-border/60 bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
              <Upload className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground/80">Activation point:</span>{" "}
                {m.activation}
              </span>
            </div>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
