import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardCopy,
  Check,
  CheckCircle2,
  FileWarning,
  Lock,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EVIDENCE_SOURCE_OF_TRUTH,
  activeModuleCount,
  blockedModules,
  outstandingRequirementCount,
  pendingModuleCount,
  requirementsRequestText,
  satisfiedRequirementCount,
  type RequirementKind,
} from "@/lib/evidence/requirements";

const title = "Evidence Requirements & Activation Register — IVF Ai Calc";
const description =
  "Exact pages, tables, figures, guideline recommendations, and score crosswalks transcribed to activate clinical modules in IVF Ai Calc.";

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

type FilterCategory = "all" | "active" | "pending";

function EvidenceRequirements() {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<FilterCategory>("all");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(requirementsRequestText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const displayedModules = blockedModules.filter((m) => {
    if (filter === "active") return m.status === "ACTIVE";
    if (filter === "pending") return m.status !== "ACTIVE";
    return true;
  });

  return (
    <>
      <PageHeader
        eyebrow="Evidence Intelligence Engine"
        title="Evidence Requirements & Activation Register"
        description="Comprehensive audit of published clinical evidence transcription, validated algorithm activation, and outstanding source tables. No clinical algorithm produces a recommendation until its validated source tables are transcribed."
        actions={
          <Button onClick={copy} variant="outline" className="rounded-xl">
            {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            {copied ? "Copied" : "Copy audit report"}
          </Button>
        }
      />

      <SectionCard contentClassName="p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="outline" className="rounded-full">
            <ShieldCheck className="size-3.5" /> Source of truth: {EVIDENCE_SOURCE_OF_TRUTH}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 className="size-3.5" /> {activeModuleCount} modules active &amp; validated
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
          >
            <Check className="size-3.5" /> {satisfiedRequirementCount} items transcribed &amp;
            verified
          </Badge>
          {pendingModuleCount > 0 && (
            <Badge
              variant="outline"
              className="rounded-full border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
              <Lock className="size-3.5" /> {pendingModuleCount} module pending source table
            </Badge>
          )}
          {outstandingRequirementCount > 0 && (
            <Badge
              variant="outline"
              className="rounded-full border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
              <FileWarning className="size-3.5" /> {outstandingRequirementCount} source item
              outstanding
            </Badge>
          )}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Clinical decision support algorithms require explicit citation grounding. Modules below
          verify the exact published nomograms, randomized controlled trials, and ESHRE 2025
          guideline recommendations currently active in production, alongside outstanding
          specifications for planned expansion modules.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-2">
            Filter View:
          </span>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className="h-7 text-xs rounded-lg"
          >
            All Modules ({blockedModules.length})
          </Button>
          <Button
            size="sm"
            variant={filter === "active" ? "default" : "outline"}
            onClick={() => setFilter("active")}
            className="h-7 text-xs rounded-lg"
          >
            Activated &amp; Transcribed ({activeModuleCount})
          </Button>
          <Button
            size="sm"
            variant={filter === "pending" ? "default" : "outline"}
            onClick={() => setFilter("pending")}
            className="h-7 text-xs rounded-lg"
          >
            Pending Source Table ({pendingModuleCount})
          </Button>
        </div>
      </SectionCard>

      <div className="grid gap-4">
        {displayedModules.map((m) => {
          const isActive = m.status === "ACTIVE";
          return (
            <SectionCard
              key={m.engineId}
              title={m.name}
              description={m.implemented}
              contentClassName="p-0"
              action={
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`rounded-full text-xs font-semibold ${
                      isActive
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {isActive ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Active in Production
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Lock className="size-3" /> Evidence Pending
                      </span>
                    )}
                  </Badge>
                  {m.route ? (
                    <Button asChild size="sm" variant="ghost" className="rounded-xl">
                      <Link to={m.route}>Open module</Link>
                    </Button>
                  ) : (
                    <Badge variant="outline" className="rounded-full">
                      Planned
                    </Badge>
                  )}
                </div>
              }
            >
              {m.note && (
                <p
                  className={`border-b border-border/60 px-5 py-3 text-xs ${
                    isActive
                      ? "bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                      : "bg-amber-500/5 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  <span className="font-semibold uppercase tracking-wide mr-1.5">
                    {isActive ? "Evidence Foundation:" : "Status Note:"}
                  </span>
                  {m.note}
                </p>
              )}
              <ul className="divide-y divide-border/60">
                {m.requirements.map((r) => {
                  const isSatisfied = r.status === "satisfied";
                  return (
                    <li key={r.item} className="grid gap-2 px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full" variant="secondary">
                          {kindLabel[r.kind]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`rounded-full text-[11px] ${
                            isSatisfied
                              ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                              : "border-amber-500/30 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {isSatisfied ? "✓ Transcribed & Verified" : "Outstanding Requirement"}
                        </Badge>
                        <span className="text-sm font-semibold">
                          {isSatisfied ? `Satisfied: ${r.item}` : `Required: ${r.item}`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">Source:</span> {r.source}
                        {r.locator ? ` — ${r.locator}` : ""}
                      </p>
                      {isSatisfied && r.satisfiedBy && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                          <span className="font-semibold">Implementation:</span> {r.satisfiedBy}
                        </div>
                      )}
                      {!isSatisfied && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                          <span className="font-semibold">Blocked because:</span> {r.blocks}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-start gap-2 border-t border-border/60 bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
                <Upload className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground/80">Activation point:</span>{" "}
                  {m.activation}
                </span>
              </div>
            </SectionCard>
          );
        })}
      </div>
    </>
  );
}
