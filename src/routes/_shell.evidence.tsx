import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  Layers,
  Link2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";

import { documentUrlFor } from "@/lib/evidence/documents";
import { PageHeader } from "@/components/page-header";
import { EmptyPlaceholder, SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  defaultFilters,
  evidenceLevels,
  evidenceQualities,
  evidenceSortLabels,
  evidenceSourceFilters,
  evidenceSourceKinds,
  evidenceTypes,
  filterAndSortEvidence,
  formatCitation,
  type EvidenceEntry,
  type EvidenceFilters,
  type EvidenceSort,
} from "@/lib/evidence/library";
import {
  allClinicalTopics,
  clinicalTopicGroups,
  evidencePriorityLevels,
} from "@/lib/evidence/topics";
import {
  copyText,
  doiUrl,
  downloadText,
  evidenceToBibtex,
  evidenceToCsv,
  evidenceToJson,
  evidenceToRis,
  formatApa,
  formatBibtex,
  journalUrl,
  libraryStats,
  modulesUsingEvidence,
  pubmedUrl,
  type ModuleRef,
} from "@/lib/evidence/citations";
import { draftToEntry, emptyImportDraft, type ImportDraft } from "@/lib/evidence/store";
import { useEvidenceManager } from "@/lib/evidence/use-evidence";
import { OnlineUpdatePanel } from "@/components/evidence/online-update-panel";

export const Route = createFileRoute("/_shell/evidence")({
  head: () => ({
    meta: [
      { title: "Evidence Intelligence — IVF Ai Calc" },
      {
        name: "description",
        content:
          "Search, filter and import ASRM, ESHRE and landmark IVF publications. Every future clinical module cites this library — no interpretation, no recommendations.",
      },
      { property: "og:title", content: "Evidence Intelligence — IVF Ai Calc" },
      {
        property: "og:description",
        content:
          "Premium evidence search across guidelines, RCTs, meta-analyses and observational studies for reproductive medicine specialists.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvidenceSearch,
});

function EvidenceSearch() {
  const manager = useEvidenceManager();
  const { library, state } = manager;

  const [filters, setFilters] = useState<EvidenceFilters>(defaultFilters);
  const [sort, setSort] = useState<EvidenceSort>("relevance");
  const [showFilters, setShowFilters] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const journals = useMemo(
    () => Array.from(new Set(library.map((e) => e.journal))).sort(),
    [library],
  );
  const years = useMemo(
    () => Array.from(new Set(library.map((e) => String(e.year)))).sort((a, b) => Number(b) - Number(a)),
    [library],
  );

  const results = useMemo(
    () => filterAndSortEvidence(library, filters, sort, state),
    [library, filters, sort, state],
  );

  const stats = useMemo(() => libraryStats(library), [library]);

  const set = <K extends keyof EvidenceFilters>(key: K, value: EvidenceFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const toggleIn = (key: "types" | "sources" | "topics", value: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));

  const activeFilterCount =
    filters.types.length +
    filters.sources.length +
    filters.topics.length +
    [
      filters.level !== "All",
      filters.year !== "All",
      filters.journal !== "All",
      filters.priority !== "All",
      filters.author.trim() !== "",
      filters.favoritesOnly,
      filters.includeArchived,
    ].filter(Boolean).length;

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        eyebrow="Evidence Intelligence Engine"
        title="Evidence Library"
        description="The scientific backbone of every future clinical module. References are stored, organised and cited — never interpreted, summarised automatically or converted into recommendations."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/evidence-requirements">
                <TriangleAlert className="size-4" /> Missing evidence
              </Link>
            </Button>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/evidence-updates">
                <Layers className="size-4" /> Update Center
              </Link>
            </Button>
            <Button className="rounded-xl" onClick={() => setImportOpen((o) => !o)}>
              <FileUp className="size-4" /> Import reference
            </Button>
          </div>
        }
      />

      <SectionCard
        title="Evidence Library status"
        description="Live counts across the indexed library and the calculation engines that cite it."
        contentClassName="p-4"
      >
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Total papers" value={stats.total} />
          <Stat label="Guidelines" value={stats.guidelines} />
          <Stat label="RCTs" value={stats.rcts} />
          <Stat label="Meta-analyses" value={stats.metaAnalyses} />
          <Stat label="Algorithms activated" value={`${stats.algorithmsActivated}/${stats.algorithmsTotal}`} />
          <Stat label="Algorithms waiting" value={stats.algorithmsWaiting} />
        </div>
        <div className="mt-3 rounded-2xl border border-border/70 bg-muted/30 p-3">
          <div className="flex items-center justify-between text-xs font-medium">
            <span>Evidence completeness</span>
            <span>{stats.completeness}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${stats.completeness}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {stats.indexed} indexed · {stats.pending} pending review · completeness is the share of
            engines whose published algorithm has been transcribed.{" "}
            <Link to="/evidence-requirements" className="font-medium text-primary hover:underline">
              Review what is still missing
            </Link>
            .
          </p>
        </div>
      </SectionCard>

      <PriorityLadder library={library} />

      <OnlineUpdatePanel library={library} onImport={manager.importEntry} />

      {importOpen && (
        <ImportPanel
          onClose={() => setImportOpen(false)}
          onImport={(entry) => {
            manager.importEntry(entry);
            setImportOpen(false);
          }}
        />
      )}

      <SectionCard contentClassName="p-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search title, authors, journal, year, DOI, guideline, keywords or module"
              aria-label="Search evidence"
              className="h-11 rounded-xl pl-9"
            />
            {filters.query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => set("query", "")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="size-3.5" /> Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-md bg-primary-soft px-1.5 text-[11px] font-semibold text-primary">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button
              variant={filters.favoritesOnly ? "default" : "outline"}
              size="sm"
              className="rounded-xl"
              onClick={() => set("favoritesOnly", !filters.favoritesOnly)}
              aria-pressed={filters.favoritesOnly}
            >
              <Star className="size-3.5" /> Favorites
            </Button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as EvidenceSort)}
              aria-label="Sort references"
              className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium"
            >
              {Object.entries(evidenceSortLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={() => setFilters({ ...defaultFilters, query: filters.query })}
              >
                Reset filters
              </Button>
            )}
          </div>

          <ChipRow
            label="Publication type"
            options={[...evidenceTypes, "Other"]}
            selected={filters.types}
            onToggle={(v) => toggleIn("types", v)}
            tone="primary"
          />
          <ChipRow
            label="Society / journal"
            options={evidenceSourceFilters}
            selected={filters.sources}
            onToggle={(v) => toggleIn("sources", v)}
            tone="primary"
          />

          {showFilters && (
            <div className="animate-rise grid gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <FilterSelect
                label="Evidence level"
                value={filters.level}
                onChange={(v) => set("level", v)}
                options={evidenceLevels}
              />
              <FilterSelect
                label="Source priority"
                value={filters.priority}
                onChange={(v) => set("priority", v)}
                options={evidencePriorityLevels.map((p) => String(p.level))}
                renderOption={(v) =>
                  v === "All"
                    ? "All"
                    : `${v} · ${evidencePriorityLevels.find((p) => String(p.level) === v)?.label}`
                }
              />
              <FilterSelect
                label="Journal"
                value={filters.journal}
                onChange={(v) => set("journal", v)}
                options={journals}
              />
              <FilterSelect
                label="Year"
                value={filters.year}
                onChange={(v) => set("year", v)}
                options={years}
              />
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Author
                </Label>
                <Input
                  value={filters.author}
                  onChange={(e) => set("author", e.target.value)}
                  placeholder="e.g. Humaidan"
                  className="h-9 rounded-xl"
                />
              </div>
              <label className="flex items-center gap-2 self-end text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={filters.includeArchived}
                  onChange={(e) => set("includeArchived", e.target.checked)}
                  className="size-4 rounded border-border"
                />
                Include archived references
              </label>
            </div>
          )}

          <div className="space-y-2">
            {clinicalTopicGroups.map((group) => (
              <div key={group.id} className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-full text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-auto">
                  {group.label}
                </span>
                {group.topics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleIn("topics", t)}
                    aria-pressed={filters.topics.includes(t)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                      filters.topics.includes(t)
                        ? "bg-emerald-soft text-emerald"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Indexed references"
        description={`${results.length} of ${library.length} publications${
          state.imported.length ? ` · ${state.imported.length} imported` : ""
        }`}
        contentClassName="p-4"
        action={
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => downloadText(`evidence-${stamp}.csv`, evidenceToCsv(results), "text/csv")}
            >
              <Download className="size-3.5" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                downloadText(`evidence-${stamp}.json`, evidenceToJson(results), "application/json")
              }
            >
              <Download className="size-3.5" /> JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => downloadText(`evidence-${stamp}.bib`, evidenceToBibtex(results))}
            >
              <Download className="size-3.5" /> BibTeX
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => downloadText(`evidence-${stamp}.ris`, evidenceToRis(results))}
            >
              <Download className="size-3.5" /> RIS
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => typeof window !== "undefined" && window.print()}
            >
              <FileText className="size-3.5" /> PDF
            </Button>
          </div>
        }
      >
        {results.length === 0 ? (
          <EmptyPlaceholder
            label="No matching references"
            hint="Try another keyword, topic, journal or evidence level."
            className="min-h-48"
          />
        ) : (
          <ul className="space-y-3">
            {results.map((e) => (
              <EvidenceCard
                key={e.id}
                entry={e}
                favorite={manager.isFavorite(e.id)}
                archived={manager.isArchived(e.id)}
                activeTopics={filters.topics}
                onTagClick={(t) => toggleIn("topics", t)}
                onToggleFavorite={() => manager.toggleFavorite(e)}
                onToggleArchive={() => manager.toggleArchived(e)}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard contentClassName="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div className="text-sm">
            <p className="font-semibold">Citation policy</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Any future clinical logic must reference an indexed publication in this library.
              Imported documents are stored as bibliographic records only — the application never
              parses, interprets or generates conclusions from a paper. Modules without linked
              evidence remain disabled until the supporting literature is added and reviewed by a
              specialist.
            </p>
          </div>
          <BookOpen className="ml-auto hidden size-5 shrink-0 text-muted-foreground sm:block" />
        </div>
      </SectionCard>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-soft">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onToggle,
  tone = "primary",
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  tone?: "primary" | "emerald";
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-full text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-auto">
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onToggle(o)}
          aria-pressed={selected.includes(o)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
            selected.includes(o)
              ? tone === "primary"
                ? "bg-primary-soft text-primary"
                : "bg-emerald-soft text-emerald"
              : "bg-muted text-muted-foreground hover:bg-accent",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  renderOption,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  renderOption?: (v: string) => string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
      >
        {["All", ...options].map((o) => (
          <option key={o} value={o}>
            {renderOption ? renderOption(o) : o}
          </option>
        ))}
      </select>
    </div>
  );
}

function PriorityLadder({ library }: { library: EvidenceEntry[] }) {
  return (
    <SectionCard
      title="Source hierarchy"
      description="Evidence is organised by the authority of its source. Higher levels take precedence when a future module cites conflicting references."
      contentClassName="p-4"
    >
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {evidencePriorityLevels.map((p) => {
          const count = library.filter((e) => e.priority === p.level).length;
          return (
            <li
              key={p.level}
              className="rounded-2xl border border-border/70 bg-card p-3 shadow-soft transition-shadow hover:shadow-elevated"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">
                  {p.level}
                </span>
                <span className="text-xs font-semibold leading-tight">{p.label}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{count}</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {p.description}
              </p>
              {p.source && (
                <a
                  href={p.source}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3" /> Source
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}

const statusTone: Record<string, string> = {
  Validated: "border-emerald/25 bg-emerald-soft text-emerald",
  Active: "border-emerald/25 bg-emerald-soft text-emerald",
  Framework: "border-border bg-muted text-muted-foreground",
  "Waiting for Evidence": "border-amber-500/30 bg-amber-500/10 text-amber-600",
  Blocked: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function ModuleLinkList({ modules }: { modules: ModuleRef[] }) {
  if (modules.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No clinical module cites this reference yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {modules.map((m) => (
        <li key={`${m.kind}-${m.id}`}>
          <Link
            to={m.route}
            title={`${m.statusDetail} — open module`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary-soft px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
          >
            <Layers className="size-3" /> {m.name}
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                statusTone[m.status],
              )}
            >
              {m.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
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

function EvidenceCard({
  entry,
  favorite,
  archived,
  activeTopics,
  onTagClick,
  onToggleFavorite,
  onToggleArchive,
}: {
  entry: EvidenceEntry;
  favorite: boolean;
  archived: boolean;
  activeTopics: string[];
  onTagClick: (topic: string) => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
}) {
  const [showAbstract, setShowAbstract] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const modules = useMemo(
    () => modulesUsingEvidence(entry.id, entry.modules),
    [entry.id, entry.modules],
  );
  const missing = useMemo(
    () => modules.flatMap((m) => m.missing.map((r) => ({ ...r, module: m.name }))),
    [modules],
  );
  const localFile =
    documentUrlFor(entry.fileName);
  const doi = doiUrl(entry.doi);
  const journal = journalUrl(entry);
  const pubmed = pubmedUrl(entry.pmid);

  return (
    <li
      className={cn(
        "animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-shadow hover:shadow-elevated",
        archived && "opacity-70",
      )}
    >
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
          Priority {entry.priority}
        </span>
        <span className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          GRADE quality: {entry.quality}
        </span>
        <span className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {entry.status === "indexed" ? "Validated record" : "Pending review"}
        </span>
        {archived && (
          <Badge variant="outline" className="rounded-lg">
            Archived
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{entry.year}</span>
      </div>

      <Link
        to="/evidence/$id"
        params={{ id: entry.id }}
        className="mt-3 block text-base font-semibold leading-snug hover:text-primary"
      >
        {entry.title}
      </Link>
      <p className="mt-1 text-xs text-muted-foreground">
        {entry.authors.slice(0, 4).join(", ")}
        {entry.authors.length > 4 ? ", et al." : ""} · {entry.journal}
        {entry.volume ? ` ${entry.volume}` : ""}
        {entry.issue ? `(${entry.issue})` : ""}
        {entry.pages ? `:${entry.pages}` : ""}
      </p>

      {entry.summary && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/85">
          {entry.summary}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {entry.topics.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTagClick(t)}
            aria-pressed={activeTopics.includes(t)}
            className={cn(
              "rounded-lg px-2 py-1 text-[11px] transition-colors",
              activeTopics.includes(t)
                ? "bg-emerald-soft text-emerald"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Open document */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline" className="rounded-xl">
          <Link to="/evidence/$id" params={{ id: entry.id }}>
            Open reader <ChevronRight className="size-3.5" />
          </Link>
        </Button>
        <OpenLink href={localFile} label="Open PDF" fallback="PDF not uploaded" />
        <OpenLink href={doi} label="Open DOI" fallback="DOI not recorded" />
        <OpenLink href={journal} label="Open journal page" fallback="Journal page not recorded" />
        <OpenLink href={pubmed} label="PubMed" fallback="PMID not recorded" />
        {!localFile && (
          <span className="text-[11px] text-muted-foreground">Document not uploaded.</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
        >
          <Star className={cn("size-3.5", favorite && "fill-current text-amber-500")} />
          {favorite ? "Favorited" : "Favorite"}
        </Button>
        <Button size="sm" variant="ghost" className="rounded-xl" onClick={onToggleArchive}>
          {archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
          {archived ? "Restore" : "Archive"}
        </Button>
      </div>

      {/* Citation copying */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {entry.doi && <CopyButton label="Copy DOI" text={entry.doi} />}
        <CopyButton label="Copy APA" text={formatApa(entry)} />
        <CopyButton label="Copy Vancouver" text={formatCitation(entry)} />
        <CopyButton label="Copy BibTeX" text={formatBibtex(entry)} />
      </div>

      {/* Abstract */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowAbstract((s) => !s)}
          aria-expanded={showAbstract}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", showAbstract && "rotate-180")} />
          {showAbstract ? "Hide abstract" : "View abstract"}
        </button>
        {showAbstract && (
          <p className="animate-rise mt-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs leading-relaxed text-foreground/85">
            {entry.abstract ??
              "Abstract not stored for this record. Paste the published abstract from the reader — the application never generates one."}
          </p>
        )}
      </div>

      {/* Clinical detail */}
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          aria-expanded={showDetails}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", showDetails && "rotate-180")} />
          {showDetails ? "Hide clinical detail" : "Clinical detail, modules & impact"}
        </button>
        {showDetails && (
          <div className="animate-rise mt-2 grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 lg:grid-cols-2">
            <DetailBlock title="Key clinical recommendations">
              <Pending>
                Recommendation statements are transcribed by a specialist from the published text.
                None are stored for this record — the application never generates them.
              </Pending>
            </DetailBlock>
            <DetailBlock title="Evidence grade">
              <p className="text-[11px] text-muted-foreground">
                Level {entry.level} · {entry.quality} quality · Source priority {entry.priority} ·
                Type {entry.type}
              </p>
            </DetailBlock>
            <DetailBlock title="Clinical pearls">
              <Pending>Physician-authored. Add them in the reader’s clinical notes.</Pending>
            </DetailBlock>
            <DetailBlock title="Implementation notes">
              {modules.length ? (
                <p className="text-[11px] text-muted-foreground">
                  Cited by {modules.length} module{modules.length > 1 ? "s" : ""};{" "}
                  {modules.filter((m) => m.status === "Validated").length} already run a transcribed
                  algorithm.
                </p>
              ) : (
                <Pending>No module consumes this reference yet.</Pending>
              )}
            </DetailBlock>

            <DetailBlock title="Used by (click to open the module)" className="lg:col-span-2">
              <ModuleLinkList modules={modules} />
            </DetailBlock>

            <DetailBlock title="Missing evidence">
              {missing.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nothing outstanding for the modules citing this paper.
                </p>
              ) : (
                <ul className="space-y-1">
                  {missing.slice(0, 4).map((r, i) => (
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
                  {missing.length > 4 && (
                    <li>
                      <Link
                        to="/evidence-requirements"
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        + {missing.length - 4} more in Evidence Requirements
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </DetailBlock>

            <DetailBlock title="Version history">
              <dl className="space-y-1 text-[11px] text-muted-foreground">
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0">Record version</dt>
                  <dd className="font-medium text-foreground">
                    {entry.status === "indexed" ? "1.0 (indexed)" : "0.1 (pending review)"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0">Added</dt>
                  <dd className="font-medium text-foreground">{entry.addedAt}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0">Source file</dt>
                  <dd className="font-medium text-foreground">
                    {entry.fileName ?? "Document not uploaded."}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0">Algorithms</dt>
                  <dd className="font-medium text-foreground">
                    {modules.length ? modules.map((m) => m.name).join(", ") : "None"}
                  </dd>
                </div>
              </dl>
            </DetailBlock>

            <DetailBlock title="Clinical impact" className="lg:col-span-2">
              {modules.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Removing this record affects no algorithm.
                </p>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-400">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <TriangleAlert className="size-3.5" /> This paper is required by the following
                    algorithms.
                  </p>
                  <p className="mt-1">{modules.map((m) => m.name).join(" · ")}</p>
                </div>
              )}
            </DetailBlock>
          </div>
        )}
      </div>

      <p className="sr-only">{formatCitation(entry)}</p>
    </li>
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

function DetailBlock({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-card p-3", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Pending({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      <span className="mr-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
        Evidence algorithm pending
      </span>
      {children}
    </p>
  );
}

function ImportPanel({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (entry: EvidenceEntry) => void;
}) {
  const [draft, setDraft] = useState<ImportDraft>(emptyImportDraft);
  const set = <K extends keyof ImportDraft>(key: K, value: ImportDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSave = draft.title.trim().length > 2 && draft.journal.trim().length > 1;

  return (
    <SectionCard
      title="Import reference"
      description="Bibliographic capture only. The document is recorded as metadata — no text extraction, no automatic summary, no AI-generated conclusions."
      contentClassName="p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Source</Label>
          <select
            value={draft.sourceKind}
            onChange={(e) => set("sourceKind", e.target.value as ImportDraft["sourceKind"])}
            className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
          >
            {evidenceSourceKinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <Field label="Title *" value={draft.title} onChange={(v) => set("title", v)} className="lg:col-span-2" />
        <Field label="Authors (comma separated)" value={draft.authors} onChange={(v) => set("authors", v)} />
        <Field label="Journal / Society *" value={draft.journal} onChange={(v) => set("journal", v)} />
        <Field label="Publisher" value={draft.publisher} onChange={(v) => set("publisher", v)} />
        <Field label="Year" value={draft.year} onChange={(v) => set("year", v)} />
        <Field label="Volume" value={draft.volume} onChange={(v) => set("volume", v)} />
        <Field label="Issue" value={draft.issue} onChange={(v) => set("issue", v)} />
        <Field label="Pages" value={draft.pages} onChange={(v) => set("pages", v)} />
        <Field label="DOI" value={draft.doi} onChange={(v) => set("doi", v)} />
        <Field label="PubMed ID" value={draft.pmid} onChange={(v) => set("pmid", v)} />
        <Field label="External URL" value={draft.url} onChange={(v) => set("url", v)} />
        <Field label="Keywords (comma separated)" value={draft.keywords} onChange={(v) => set("keywords", v)} />
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Type</Label>
          <select
            value={draft.type}
            onChange={(e) => set("type", e.target.value as ImportDraft["type"])}
            className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
          >
            {evidenceTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Evidence level
          </Label>
          <select
            value={draft.level}
            onChange={(e) => set("level", e.target.value as ImportDraft["level"])}
            className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
          >
            {evidenceLevels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Source priority
          </Label>
          <select
            value={draft.priority}
            onChange={(e) => set("priority", e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
          >
            {evidencePriorityLevels.map((p) => (
              <option key={p.level} value={String(p.level)}>
                {p.level} · {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Quality rating
          </Label>
          <select
            value={draft.quality}
            onChange={(e) => set("quality", e.target.value as ImportDraft["quality"])}
            className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
          >
            {evidenceQualities.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Abstract (paste as published — never generated)
          </Label>
          <Textarea
            value={draft.abstract}
            onChange={(e) => set("abstract", e.target.value)}
            rows={4}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Clinical topics
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {allClinicalTopics.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  set(
                    "topics",
                    draft.topics.includes(t)
                      ? draft.topics.filter((x) => x !== t)
                      : [...draft.topics, t],
                  )
                }
                aria-pressed={draft.topics.includes(t)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                  draft.topics.includes(t)
                    ? "bg-primary-soft text-primary"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Attach PDF (stored as file name reference only)
          </Label>
          <Input
            type="file"
            accept="application/pdf"
            className="rounded-xl"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setDraft((d) => ({
                  ...d,
                  fileName: file.name,
                  sourceKind: "PDF",
                  title: d.title || file.name.replace(/\.pdf$/i, ""),
                }));
              }
            }}
          />
          {draft.fileName && (
            <p className="text-[11px] text-muted-foreground">Attached: {draft.fileName}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          className="rounded-xl"
          disabled={!canSave}
          onClick={() => onImport(draftToEntry(draft))}
        >
          <FileUp className="size-4" /> Add to library
        </Button>
        <Button variant="ghost" className="rounded-xl" onClick={onClose}>
          Cancel
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Imported references start as “pending review” until a specialist verifies them.
        </span>
      </div>
    </SectionCard>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-xl" />
    </div>
  );
}
