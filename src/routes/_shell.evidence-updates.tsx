import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ExternalLink, FileText, History, Layers, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyPlaceholder, SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { historyLabels } from "@/lib/evidence/store";
import { evidencePriorityLevels } from "@/lib/evidence/topics";
import { moduleLinks } from "@/lib/evidence/linkage";
import { useEvidenceManager } from "@/lib/evidence/use-evidence";
import { OnlineUpdatePanel } from "@/components/evidence/online-update-panel";

export const Route = createFileRoute("/_shell/evidence-updates")({
  head: () => ({
    meta: [
      { title: "Evidence Update Center — IVF Ai Calc" },
      {
        name: "description",
        content:
          "Track the latest guidelines, recently added papers, module coverage and the version history of your evidence library.",
      },
      { property: "og:title", content: "Evidence Update Center — IVF Ai Calc" },
      {
        property: "og:description",
        content: "Latest guidelines, recently added papers and library version history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvidenceUpdates,
});

function EvidenceUpdates() {
  const { library, state, importEntry } = useEvidenceManager();

  const guidelines = useMemo(
    () =>
      library
        .filter((e) => e.priority <= 2 || e.type === "Guideline")
        .sort((a, b) => b.year - a.year)
        .slice(0, 6),
    [library],
  );

  const recent = useMemo(
    () => [...library].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 6),
    [library],
  );

  const links = useMemo(() => moduleLinks(library), [library]);
  const uncovered = links.filter((l) => l.entries.length === 0);

  return (
    <>
      <PageHeader
        eyebrow="Evidence Intelligence Engine"
        title="Evidence Update Center"
        description="Monitor guideline currency, newly indexed publications and how library changes propagate to future clinical modules."
        actions={
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/evidence">
              <Layers className="size-4" /> Evidence Library
            </Link>
          </Button>
        }
      />

      <OnlineUpdatePanel library={library} onImport={importEntry} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Latest guidelines"
          description="Priority 1–2 society documents currently indexed."
          contentClassName="p-4"
        >
          <ul className="space-y-2">
            {guidelines.map((e) => (
              <li key={e.id}>
                <Link
                  to="/evidence/$id"
                  params={{ id: e.id }}
                  className="flex items-start gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:bg-accent"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                    <FileText className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-medium">{e.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {e.society ?? e.journal} · {e.year}
                    </span>
                  </span>
                  <Badge variant="secondary" className="ml-auto shrink-0 rounded-lg">
                    P{e.priority}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Recently added papers"
          description="Newest records in your library, including manual imports."
          contentClassName="p-4"
        >
          <ul className="space-y-2">
            {recent.map((e) => (
              <li key={e.id}>
                <Link
                  to="/evidence/$id"
                  params={{ id: e.id }}
                  className="flex items-start gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:bg-accent"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-soft text-emerald">
                    <Clock className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-medium">{e.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      Added {e.addedAt} · {e.type}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Module evidence coverage"
        description="Which future clinical modules already have citable references and which still wait for literature."
        contentClassName="p-4"
      >
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((l) => (
            <li
              key={`${l.kind}-${l.moduleId}`}
              className="rounded-2xl border border-border/70 bg-card p-3 shadow-soft"
            >
              <p className="text-xs font-semibold leading-snug">{l.moduleName}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {l.kind === "engine" ? "Calculation engine" : "Knowledge module"}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {l.entries.length > 0
                  ? `${l.entries.length} linked reference${l.entries.length > 1 ? "s" : ""}`
                  : "Awaiting evidence"}
              </p>
            </li>
          ))}
        </ul>
        {uncovered.length > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {uncovered.length} module{uncovered.length > 1 ? "s" : ""} remain disabled until
            supporting literature is indexed and reviewed.
          </p>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Updated recommendations"
          description="Reserved. Once a module is validated, every change to its recommendation set will be versioned here with the citations that justified it."
          contentClassName="p-4"
        >
          <ul className="grid gap-2">
            {evidencePriorityLevels.slice(0, 3).map((p) => (
              <li key={p.level} className="rounded-xl border border-dashed border-border/70 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <Sparkles className="size-3 text-primary" /> {p.label}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  No recommendation set is derived from this source in this release.
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Version history"
          description="Append-only log of your library changes."
          contentClassName="p-4"
        >
          {state.history.length === 0 ? (
            <EmptyPlaceholder
              label="No changes recorded yet"
              hint="Importing, favoriting, archiving or annotating a reference appears here."
            />
          ) : (
            <ul className="space-y-2">
              {state.history.slice(0, 20).map((h) => (
                <li key={h.id} className="flex items-start gap-3 rounded-xl border border-border/70 p-3">
                  <History className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">{historyLabels[h.action]}</span>
                    <span className="line-clamp-1 text-[11px] text-muted-foreground">
                      {h.entryTitle}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {new Date(h.at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard contentClassName="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <ExternalLink className="size-5" />
          </span>
          <div className="text-sm">
            <p className="font-semibold">Keeping sources current</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Check the ASRM practice-guidance portal and the ESHRE guideline library for revisions,
              then import the updated document. The application does not fetch, parse or interpret
              publications automatically.
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
