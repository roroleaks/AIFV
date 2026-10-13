import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, BookMarked, Copy, Layers, Lock, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import {
  CONSORT_POPULATION_RESTRICTION,
  MASTER_PACK_FILE,
  MASTER_PACK_INGESTED_AT,
  algorithmSourceMap,
  artefactSeparation,
  buildCoverageReport,
  consortAudit,
  consortReadiness,
  doiFindings,
  duplicateFindings,
  evidenceConflicts,
  findMasterRecord,
  masterEvidenceRecords,
  missingImplementationMaterial,
  type AuditVerdict,
} from "@/lib/evidence/master-pack";

const title = "Evidence Master Library — IVF Ai Calc";
const description =
  "Ingestion, indexing, provenance and readiness audit of the 20-source AI IVF CDSS evidence pack. Indexing only — no clinical algorithm is activated.";

export const Route = createFileRoute("/_shell/evidence-master")({
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
  component: EvidenceMaster,
});

const verdictTone: Record<AuditVerdict, string> = {
  VERIFIED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "PARTIALLY VERIFIED": "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "NOT VERIFIED": "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "NOT PRESENT": "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function EvidenceMaster() {
  const report = buildCoverageReport();

  return (
    <>
      <PageHeader
        eyebrow="Evidence Intelligence Engine"
        title="20-Source Evidence Master Library"
        description={`Ingested from ${MASTER_PACK_FILE} on ${MASTER_PACK_INGESTED_AT}. This is an indexing and provenance layer only: no clinical algorithm was activated, implemented or modified. Paper ingested ≠ algorithm activated.`}
      />

      <SectionCard contentClassName="p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="outline" className="rounded-full">
            <Lock className="size-3.5" /> All treatment algorithms remain Evidence Pending
          </Badge>
          <Badge variant="outline" className="rounded-full">
            <BookMarked className="size-3.5" /> {report.sourcesIndexed} sources indexed
          </Badge>
          <Badge variant="outline" className="rounded-full">
            <ShieldAlert className="size-3.5" /> CONSORT: {consortReadiness.status}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Sources ingested" value={report.sourcesIngested} />
          <Stat label="Incomplete metadata" value={report.incompleteMetadata} />
          <Stat label="Duplicates" value={report.duplicates} />
          <Stat label="DOI / URL issues" value={report.doiProblems} />
          <Stat label="Evidence domains" value={report.domains.length} />
          <Stat label="Evidence conflicts" value={report.conflicts} />
          <Stat
            label="CONSORT verified / total"
            value={`${report.consortVerified}/${consortAudit.length}`}
          />
          <Stat
            label="CONSORT missing items"
            value={report.consortNotPresent + report.consortNotVerified}
          />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Outstanding source material is tracked on the{" "}
          <Link
            to="/evidence-requirements"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Evidence Requirements
          </Link>{" "}
          page.
        </p>
      </SectionCard>

      <SectionCard
        title="CONSORT population restriction"
        description={CONSORT_POPULATION_RESTRICTION.source}
        contentClassName="p-5"
      >
        <p className="text-sm font-medium">{CONSORT_POPULATION_RESTRICTION.statement}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Must NOT be generalized to: {CONSORT_POPULATION_RESTRICTION.mustNotGeneralizeTo.join(" · ")}.
          Outside the validated population the recorded status is{" "}
          <span className="font-mono">{CONSORT_POPULATION_RESTRICTION.outsidePopulationStatus}</span>.
        </p>
      </SectionCard>

      <SectionCard title="Indexed sources" description="Full provenance retained for every record." contentClassName="p-0">
        <ul className="divide-y divide-border/60">
          {masterEvidenceRecords.map((r) => (
            <li key={r.evidenceId} className="grid gap-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {String(r.packNumber).padStart(2, "0")}
                </Badge>
                <span className="text-sm font-semibold">{r.title}</span>
                <Badge variant="outline" className="rounded-full">
                  {r.artefactKind}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{r.relevance}</p>
              <div className="flex flex-wrap gap-1.5">
                {r.domains.map((d) => (
                  <Badge key={d} variant="outline" className="rounded-full text-[11px]">
                    {d}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                DOI: {r.doi} · PMID: {r.pubmedId} · Year: {String(r.year)} · Journal: {r.journal}
              </p>
              <p className="text-xs text-muted-foreground">
                Population: {r.population} · Limitations: {r.limitations}
              </p>
              <div className="flex flex-wrap gap-3">
                {r.urls.map((u) => (
                  <a
                    key={u}
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    {new URL(u).hostname.replace("www.", "")}
                  </a>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Evidence ID: <span className="font-mono">{r.evidenceId}</span> · Source: {r.provenance}
                {r.linkedLibraryId ? ` · Library entry: ${r.linkedLibraryId}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Algorithm → source mapping"
        description="Roles are declarative. Sufficiency statements never activate a module."
        contentClassName="p-0"
      >
        <ul className="divide-y divide-border/60">
          {algorithmSourceMap.map((a) => (
            <li key={a.algorithm} className="grid gap-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{a.algorithm}</span>
                <Badge
                  variant="outline"
                  className={
                    a.sufficiency === "IMPLEMENTED — CLASSIFICATION ONLY"
                      ? "rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "rounded-full border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }
                >
                  {a.sufficiency}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{a.note}</p>
              <ul className="grid gap-1">
                {a.sources.map((s) => (
                  <li key={s.evidenceId} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{s.role}:</span>{" "}
                    {findMasterRecord(s.evidenceId)?.title ?? s.evidenceId}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="CONSORT evidence audit"
        description="Component-level verification against the supplied pack. Nothing is inferred."
        contentClassName="p-0"
      >
        <ul className="divide-y divide-border/60">
          {consortAudit.map((i) => (
            <li key={i.item} className="flex flex-wrap items-start gap-3 px-5 py-3">
              <Badge variant="outline" className={`rounded-full ${verdictTone[i.verdict]}`}>
                {i.verdict}
              </Badge>
              <div className="min-w-[12rem] flex-1">
                <p className="text-sm font-medium">{i.item}</p>
                <p className="text-xs text-muted-foreground">{i.evidence}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-border/60 bg-muted/40 px-5 py-4">
          <p className="text-sm font-semibold">CONSORT implementation readiness: {consortReadiness.status}</p>
          <ul className="mt-2 grid gap-1">
            {consortReadiness.checklist.map((c) => (
              <li key={c.item} className="text-xs text-muted-foreground">
                {c.item} — <span className="font-medium text-foreground/80">{c.available}</span>
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Evidence conflicts" description="Recorded, never auto-resolved." contentClassName="p-0">
          <ul className="divide-y divide-border/60">
            {evidenceConflicts.map((c) => (
              <li key={c.label} className="grid gap-1.5 px-5 py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  <span className="text-sm font-semibold">{c.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.dimension} — {c.detail}
                </p>
                <Badge variant="outline" className="w-fit rounded-full text-[11px]">
                  {c.status}
                </Badge>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Duplicates & citation status" contentClassName="p-0">
          <ul className="divide-y divide-border/60">
            {duplicateFindings.map((d) => (
              <li key={d.label} className="grid gap-1.5 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Copy className="size-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold">{d.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{d.reason}</p>
                <Badge variant="outline" className="w-fit rounded-full text-[11px]">
                  {d.action}
                </Badge>
              </li>
            ))}
            {doiFindings.map((d) => (
              <li key={d.evidenceId} className="grid gap-1 px-5 py-3">
                <p className="text-xs font-medium">
                  {findMasterRecord(d.evidenceId)?.title ?? d.evidenceId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.status} — {d.note}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Algorithm vs guideline separation"
        description={artefactSeparation.rule}
        contentClassName="p-5"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Numerical algorithms", items: artefactSeparation.numericalAlgorithms },
            { label: "Clinical guidelines", items: artefactSeparation.guidelines },
            { label: "Classification frameworks", items: artefactSeparation.classifications },
          ].map((group) => (
            <div key={group.label}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="size-3.5" /> {group.label}
              </p>
              <ul className="mt-2 grid gap-1">
                {group.items.map((i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Missing material required before any future implementation"
        contentClassName="p-0"
      >
        <ul className="divide-y divide-border/60">
          {missingImplementationMaterial.map((m) => (
            <li key={m.algorithm} className="grid gap-1.5 px-5 py-4">
              <span className="text-sm font-semibold">{m.algorithm}</span>
              <ul className="grid gap-1">
                {m.required.map((r) => (
                  <li key={r} className="text-xs text-muted-foreground">
                    • {r}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </SectionCard>
    </>
  );
}
