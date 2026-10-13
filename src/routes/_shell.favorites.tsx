import { createFileRoute, Link } from "@tanstack/react-router";
import { BookMarked, Star } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard, EmptyPlaceholder } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEvidenceManager } from "@/lib/evidence/use-evidence";

export const Route = createFileRoute("/_shell/favorites")({
  head: () => ({
    meta: [
      { title: "Favorites — IVF Ai Calc" },
      { name: "description", content: "Bookmarked literature from the Evidence Library." },
      { property: "og:title", content: "Favorites — IVF Ai Calc" },
      { property: "og:description", content: "Bookmarked literature from the Evidence Library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Favorites,
});

function Favorites() {
  const manager = useEvidenceManager();
  const favorites = manager.library.filter((e) => manager.isFavorite(e.id));

  return (
    <>
      <PageHeader
        eyebrow="Saved"
        title="Favorites"
        description="Every reference you star in the Evidence Library appears here instantly."
        actions={
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/evidence">
              <BookMarked className="size-4" /> Evidence Library
            </Link>
          </Button>
        }
      />

      <SectionCard
        title="Starred literature"
        description={`${favorites.length} reference${favorites.length === 1 ? "" : "s"} saved`}
        contentClassName="p-4"
      >
        {!manager.hydrated ? (
          <EmptyPlaceholder label="Loading your favorites…" className="min-h-40" />
        ) : favorites.length === 0 ? (
          <EmptyPlaceholder
            label="Nothing saved yet"
            hint="Star any paper in the Evidence Library to pin it here."
            className="min-h-40"
          />
        ) : (
          <ul className="space-y-3">
            {favorites.map((e) => (
              <li
                key={e.id}
                className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-lg">{e.type}</Badge>
                  {e.society && (
                    <Badge variant="secondary" className="rounded-lg">
                      {e.society}
                    </Badge>
                  )}
                  <span className="rounded-lg border border-emerald/25 bg-emerald-soft px-2 py-0.5 text-[11px] font-semibold text-emerald">
                    Level {e.level}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{e.year}</span>
                </div>
                <Link
                  to="/evidence/$id"
                  params={{ id: e.id }}
                  className="mt-2 block text-sm font-semibold leading-snug hover:text-primary"
                >
                  {e.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {e.authors.slice(0, 3).join(", ")}
                  {e.authors.length > 3 ? ", et al." : ""} · {e.journal}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className="rounded-xl">
                    <Link to="/evidence/$id" params={{ id: e.id }}>
                      Open reader
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => manager.toggleFavorite(e)}
                  >
                    <Star className="size-3.5 fill-current text-amber-500" /> Remove star
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
