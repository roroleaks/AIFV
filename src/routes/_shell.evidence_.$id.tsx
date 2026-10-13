import { useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  BookMarked,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Quote,
  Sparkles,
  Star,
  TriangleAlert,
} from "lucide-react";

import { documentUrlFor } from "@/lib/evidence/documents";
import { PageHeader } from "@/components/page-header";
import { EmptyPlaceholder, SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCitation } from "@/lib/evidence/library";
import { priorityLabel, topicGroupFor } from "@/lib/evidence/topics";
import { relatedEntries } from "@/lib/evidence/linkage";
import { explainabilityFields } from "@/lib/evidence/explainability";
import {
  copyText,
  doiUrl,
  downloadText,
  formatApa,
  formatBibtex,
  formatRis,
  journalUrl,
  modulesUsingEvidence,
  pubmedUrl,
} from "@/lib/evidence/citations";
import { useEvidenceManager } from "@/lib/evidence/use-evidence";

export const Route = createFileRoute("/_shell/evidence_/$id")({
  head: () => ({
    meta: [
      { title: "Evidence Reader — IVF Ai Calc" },
      {
        name: "description",
        content:
          "Read a publication record: citation, abstract, evidence quality, related topics and the clinical modules that cite it.",
      },
      { property: "og:title", content: "Evidence Reader — IVF Ai Calc" },
      {
        property: "og:description",
        content: "Full bibliographic record with linked clinical modules and physician notes.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvidenceViewer,
});

const statusTone: Record<string, string> = {
  Validated: "border-emerald/25 bg-emerald-soft text-emerald",
  Active: "border-emerald/25 bg-emerald-soft text-emerald",
  Framework: "border-border bg-muted text-muted-foreground",
  "Waiting for Evidence": "border-amber-500/30 bg-amber-500/10 text-amber-600",
  Blocked: "border-destructive/30 bg-destructive/10 text-destructive",
};

function CopyButton({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      className="rounded-xl"
      onClick={async () => {
        const ok = await copyText(text);
        setDone(ok);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      <Copy className="size-3.5" /> {done ? "Copied" : label}
    </Button>
  );
}

function OpenLink({
  href,
  label,
  fallback,
}: {
  href?: string | undefined;
  label: string;
  fallback: string;
}) {
  if (!href) {
    return (
      <span
        title={fallback}
        className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-xl border border-dashed border-border px-2.5 text-xs text-muted-foreground"
      >
        <Link2 className="size-3.5" /> {fallback}
      </span>
    );
  }
  return (
    <Button asChild size="sm" variant="ghost" className="rounded-xl">
      <a href={href} target="_blank" rel="noreferrer noopener">
        <ExternalLink className="size-3.5" /> {label}
      </a>
    </Button>
  );
}

function EvidenceViewer() {
  const { id } = useParams({ from: "/_shell/evidence_/$id" });
  const manager = useEvidenceManager();
  const { library, state } = manager;
  const [showAbstract, setShowAbstract] = useState(true);

  const entry = useMemo(() => library.find((e) => e.id === id), [library, id]);
  const related = useMemo(() => (entry ? relatedEntries(entry, library) : []), [entry, library]);
  const modules = useMemo(
    () => (entry ? modulesUsingEvidence(entry.id, entry.modules) : []),
    [entry],
  );
  const missing = useMemo(
    () => modules.flatMap((m) => m.missing.map((r) => ({ ...r, module: m.name }))),
    [modules],
  );

  if (!entry) {
    return (
      <>
        <PageHeader eyebrow="Evidence" title="Reference not found" />
        <SectionCard contentClassName="p-4">
          <EmptyPlaceholder
            label="This reference is not in the library"
            hint="It may have been removed, or the link is outdated."
            className="min-h-48"
          />
          <div className="mt-4">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/evidence">
                <ArrowLeft className="size-4" /> Back to library
              </Link>
            </Button>
          </div>
        </SectionCard>
      </>
    );
  }

  const citation = formatCitation(entry);
  const note = state.notes[entry.id] ?? "";
  const localFile =
    documentUrlFor(entry.fileName);

  return (
    <>
      <PageHeader
        eyebrow={`Priority ${entry.priority} · ${priorityLabel(entry.priority)}`}
        title={entry.title}
        description={`${entry.journal} · ${entry.year}${entry.publisher ? ` · ${entry.publisher}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/evidence">
                <ArrowLeft className="size-4" /> Library
              </Link>
            </Button>
            <Button
              variant={manager.isFavorite(entry.id) ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => manager.toggleFavorite(entry)}
            >
              <Star className={cn("size-4", manager.isFavorite(entry.id) && "fill-current")} />
              {manager.isFavorite(entry.id) ? "Favorited" : "Favorite"}
            </Button>
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => manager.toggleArchived(entry)}
            >
              {manager.isArchived(entry.id) ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
              {manager.isArchived(entry.id) ? "Restore" : "Archive"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SectionCard contentClassName="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-lg">{entry.type}</Badge>
              {entry.society && (
                <Badge variant="secondary" className="rounded-lg">
                  {entry.society}
                </Badge>
              )}
              <span className="rounded-lg border border-emerald/25 bg-emerald-soft px-2 py-0.5 text-[11px] font-semibold text-emerald">
                Level {entry.level}
              </span>
              <span className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                GRADE quality: {entry.quality}
              </span>
              <Badge variant="outline" className="rounded-lg">
                {entry.status === "indexed" ? "Validated record" : "Pending review"}
              </Badge>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {entry.authors.join(", ")}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <OpenLink href={localFile} label="Open PDF" fallback="Document not uploaded." />
              <OpenLink href={doiUrl(entry.doi)} label="Open DOI" fallback="DOI not recorded" />
              <OpenLink
                href={journalUrl(entry)}
                label="Open journal page"
                fallback="Journal page not recorded"
              />
              <OpenLink
                href={pubmedUrl(entry.pmid)}
                label={`PubMed ${entry.pmid ?? ""}`.trim()}
                fallback="PMID not recorded"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Quote className="size-3" /> Citation
              </p>
              <p className="mt-2 text-sm leading-relaxed">{citation}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {entry.doi && <CopyButton label="Copy DOI" text={entry.doi} />}
                <CopyButton label="Copy APA" text={formatApa(entry)} />
                <CopyButton label="Copy Vancouver" text={citation} />
                <CopyButton label="Copy BibTeX" text={formatBibtex(entry)} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => downloadText(`${entry.id}.ris`, formatRis(entry))}
                >
                  <Download className="size-3.5" /> RIS
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => downloadText(`${entry.id}.bib`, formatBibtex(entry))}
                >
                  <Download className="size-3.5" /> BibTeX
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Abstract"
            contentClassName="p-6"
            action={
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl"
                onClick={() => setShowAbstract((s) => !s)}
                aria-expanded={showAbstract}
              >
                <ChevronDown className={cn("size-3.5 transition-transform", showAbstract && "rotate-180")} />
                {showAbstract ? "Collapse" : "Expand"}
              </Button>
            }
          >
            {!showAbstract ? null : entry.abstract ? (
              <p className="text-[15px] leading-8 text-foreground/90">{entry.abstract}</p>
            ) : (
              <EmptyPlaceholder
                label="Abstract not stored"
                hint="Paste the published abstract when reviewing this record. The application never generates one."
              />
            )}
          </SectionCard>

          <SectionCard
            title="Clinical summary"
            description="Physician-authored. Reserved space — no automatic interpretation of this publication is produced."
            contentClassName="p-6"
          >
            {entry.summary ? (
              <p className="text-sm leading-relaxed text-foreground/85">{entry.summary}</p>
            ) : (
              <EmptyPlaceholder label="Summary placeholder" hint="Awaiting specialist review." />
            )}
          </SectionCard>

          <SectionCard
            title="Key clinical recommendations"
            description="Transcribed verbatim by a specialist. The application never derives recommendations from a paper."
            contentClassName="p-4"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <PendingBlock
                title="Key clinical recommendations"
                body="No recommendation statements have been transcribed from this publication."
              />
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Evidence grade
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Level {entry.level} · {entry.quality} quality · Source priority {entry.priority} ·{" "}
                  {entry.type} · {entry.status === "indexed" ? "Validated record" : "Pending review"}
                </p>
              </div>
              <PendingBlock
                title="Clinical pearls"
                body="Add your own pearls in the clinical notes below; none are generated."
              />
              <PendingBlock
                title="Implementation notes"
                body={
                  modules.length
                    ? `Cited by ${modules.length} module(s). ${
                        modules.filter((m) => m.status === "Validated").length
                      } already run a transcribed algorithm.`
                    : "No module consumes this reference yet."
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Explainable AI framework"
            description="Fields a future module will fill when it cites this reference. Nothing here is computed today."
            contentClassName="p-4"
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {explainabilityFields.map((f) => (
                <li key={String(f.id)} className="rounded-xl border border-dashed border-border/70 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <Sparkles className="size-3 text-primary" /> {f.label}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-muted-foreground">Reserved</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Clinical notes"
            description="Stored locally with your library. Not shared and not used to derive any recommendation."
            contentClassName="p-4"
          >
            <Textarea
              value={note}
              rows={4}
              placeholder="Add your reading notes for this reference…"
              className="rounded-xl"
              onChange={(e) => manager.setNote(entry, e.target.value)}
              onBlur={() => note.trim() && manager.commitNote(entry)}
            />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Record" contentClassName="p-4">
            <dl className="space-y-2 text-xs">
              <Row label="Journal" value={entry.journal} />
              <Row label="Year" value={String(entry.year)} />
              <Row label="Volume" value={entry.volume} />
              <Row label="Issue" value={entry.issue} />
              <Row label="Pages" value={entry.pages} />
              <Row label="DOI" value={entry.doi} />
              <Row label="PubMed ID" value={entry.pmid} />
              <Row label="Publisher" value={entry.publisher} />
              <Row label="Source" value={entry.sourceKind} />
              <Row label="File" value={entry.fileName ?? "Document not uploaded."} />
              <Row label="Added" value={entry.addedAt} />
            </dl>
          </SectionCard>

          <SectionCard title="Version history" contentClassName="p-4">
            <dl className="space-y-2 text-xs">
              <Row
                label="Version"
                value={entry.status === "indexed" ? "1.0 (indexed)" : "0.1 (pending review)"}
              />
              <Row label="Upload date" value={entry.addedAt} />
              <Row label="Last modified" value={entry.addedAt} />
              <Row
                label="Algorithms"
                value={modules.length ? modules.map((m) => m.name).join(", ") : "None"}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Topics" contentClassName="p-4">
            <div className="flex flex-wrap gap-1.5">
              {entry.topics.map((t) => (
                <span
                  key={t}
                  className="rounded-lg bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                  title={topicGroupFor(t)?.label}
                >
                  {t}
                </span>
              ))}
            </div>
            {entry.keywords && entry.keywords.length > 0 && (
              <>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Keywords
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{entry.keywords.join(" · ")}</p>
              </>
            )}
          </SectionCard>

          <SectionCard
            title="Used by"
            description="Click a module to open it."
            contentClassName="p-4"
          >
            {modules.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No clinical module cites this reference yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {modules.map((m) => (
                  <li key={`${m.kind}-${m.id}`}>
                    <Link
                      to={m.route}
                      title={m.statusDetail}
                      className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary-soft px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                    >
                      {m.name}
                      <span
                        className={cn(
                          "ml-auto rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                          statusTone[m.status],
                        )}
                      >
                        {m.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Clinical impact" contentClassName="p-4">
            {modules.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Removing this record affects no algorithm.
              </p>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-400">
                <p className="flex items-center gap-1.5 font-semibold">
                  <TriangleAlert className="size-3.5" /> This paper is required by the following
                  algorithms.
                </p>
                <p className="mt-1">{modules.map((m) => m.name).join(" · ")}</p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Missing evidence" contentClassName="p-4">
            {missing.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nothing outstanding for the modules citing this paper.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {missing.map((r, i) => (
                  <li key={i}>
                    <Link
                      to="/evidence-requirements"
                      className="flex items-start gap-1.5 text-[11px] text-muted-foreground hover:text-primary"
                    >
                      <TriangleAlert className="mt-0.5 size-3 shrink-0 text-amber-500" />
                      <span>
                        Missing {r.kind}: {r.item}
                        {r.locator ? ` (${r.locator})` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Related references" contentClassName="p-4">
            {related.length === 0 ? (
              <p className="text-xs text-muted-foreground">No topic overlap found.</p>
            ) : (
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/evidence/$id"
                      params={{ id: r.id }}
                      className="flex gap-2 rounded-xl border border-border/70 p-2.5 text-xs transition-colors hover:bg-accent"
                    >
                      <BookMarked className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="line-clamp-2 font-medium">{r.title}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {r.journal} · {r.year}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function PendingBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <span className="mr-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Evidence algorithm pending
        </span>
        {body}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}
