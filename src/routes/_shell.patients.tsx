import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownWideNarrow,
  CircleAlert,
  Pin,
  PinOff,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard, EmptyPlaceholder } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { usePatients } from "@/lib/assessment/patients";

export const Route = createFileRoute("/_shell/patients")({
  head: () => ({
    meta: [
      { title: "Patients — IVF Ai Calc" },
      { name: "description", content: "Browse, search and pin previously assessed IVF patients." },
      { property: "og:title", content: "Patients — IVF Ai Calc" },
      {
        property: "og:description",
        content: "Browse, search and pin previously assessed IVF patients.",
      },
    ],
  }),
  component: Patients,
});

type SortKey = "recent" | "name" | "completion" | "alerts";

const sortLabels: Record<SortKey, string> = {
  recent: "Recently updated",
  name: "Name A–Z",
  completion: "Completion",
  alerts: "Most alerts",
};

function Patients() {
  const { records, hydrated, togglePin, remove } = usePatients();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? records.filter((r) =>
          [r.name, r.fileNumber, r.infertilityType, r.age, ...r.causes]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : records;

    const sorted = [...matched].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "completion") return b.completion - a.completion;
      if (sort === "alerts") return b.alerts - a.alerts;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return sorted;
  }, [records, query, sort]);

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Patients"
        description="All previously assessed patients in this clinic workspace."
        actions={
          <Button asChild className="rounded-xl">
            <Link to="/assessment">
              <UserPlus className="size-4" /> New Patient
            </Link>
          </Button>
        }
      />

      <SectionCard contentClassName="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, file number, diagnosis or age"
              aria-label="Search patients"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ArrowDownWideNarrow className="size-4 text-muted-foreground" />
            {(Object.keys(sortLabels) as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sort === key
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {sortLabels[key]}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Patient list"
        description={`${filtered.length} record${filtered.length === 1 ? "" : "s"}`}
        contentClassName="p-4"
      >
        {!hydrated ? null : filtered.length === 0 ? (
          <EmptyPlaceholder
            label={records.length === 0 ? "No patients recorded yet" : "No matching patients"}
            hint={
              records.length === 0
                ? "Complete an assessment and save it to create the first record."
                : "Try a different name, file number or diagnosis."
            }
            className="min-h-64"
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {filtered.map((r) => (
              <li
                key={r.id}
                className="animate-rise rounded-2xl border border-border/70 bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/patient/$id"
                      params={{ id: r.id }}
                      className="block truncate text-sm font-semibold hover:text-primary hover:underline"
                    >
                      {r.name}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[
                        r.fileNumber && `File ${r.fileNumber}`,
                        r.age && `Age ${r.age}`,
                        r.infertilityType,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No demographics recorded"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={r.pinned ? "Unpin patient" : "Pin patient"}
                      className="size-8 rounded-lg"
                      onClick={() => togglePin(r.id)}
                    >
                      {r.pinned ? (
                        <Pin className="size-4 text-primary" />
                      ) : (
                        <PinOff className="size-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete patient record"
                      className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {r.causes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.causes.slice(0, 4).map((c) => (
                      <Badge key={c} variant="secondary" className="rounded-lg text-[10px]">
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{r.completion}% complete</span>
                    <span className="flex items-center gap-3">
                      <span>
                        {r.cycles} cycle{r.cycles === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1 text-warning">
                        <CircleAlert className="size-3" /> {r.alerts}
                      </span>
                    </span>
                  </div>
                  <Progress value={r.completion} className="h-1.5" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
