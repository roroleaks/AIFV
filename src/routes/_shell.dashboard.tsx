import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardList,
  FlaskConical,
  Egg,
  AlertTriangle,
  ArrowUpRight,
  Star,
  BookOpen,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard, EmptyPlaceholder } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — IVF Ai Calc" },
      {
        name: "description",
        content: "Overview of assessments, protocol activity and clinical alerts.",
      },
      { property: "og:title", content: "Dashboard — IVF Ai Calc" },
      {
        property: "og:description",
        content: "Overview of assessments, protocol activity and clinical alerts.",
      },
    ],
  }),
  component: Dashboard,
});

const kpis = [
  { label: "Total Assessments", icon: ClipboardList, tone: "primary" },
  { label: "Protocols Suggested", icon: FlaskConical, tone: "emerald" },
  { label: "Average Predicted Oocytes", icon: Egg, tone: "purple" },
  { label: "OHSS Risk Alerts", icon: AlertTriangle, tone: "warning" },
] as const;

const toneClass: Record<string, string> = {
  primary: "bg-primary-soft text-primary",
  emerald: "bg-emerald-soft text-emerald",
  purple: "bg-purple-soft text-purple",
  warning: "bg-warning-soft text-warning",
};

function Dashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Clinical Dashboard"
        description="Workspace summary. Metrics are placeholders until clinical modules are enabled."
        actions={
          <Button asChild className="rounded-xl">
            <Link to="/assessment">New Assessment</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="card-lift animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <p className="min-w-0 text-sm font-medium text-muted-foreground">{kpi.label}</p>
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneClass[kpi.tone]}`}
              >
                <kpi.icon className="size-4.5" />
              </span>
            </div>
            <p className="mt-4 font-display text-3xl font-extrabold tracking-tight text-foreground/25">
              ——
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Awaiting data source</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Recent Cases"
          description="Latest patient assessments"
          action={
            <Button variant="ghost" size="sm" asChild className="text-primary">
              <Link to="/patients">
                View all <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          <EmptyPlaceholder
            label="No recent cases yet"
            hint="Cases will appear here once assessments are created."
            className="min-h-52"
          />
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Favorite Protocols" action={<Star className="size-4 text-warning" />}>
            <EmptyPlaceholder label="No saved protocols" hint="Bookmark protocols to pin them." />
          </SectionCard>

          <SectionCard
            title="Latest Evidence"
            action={<BookOpen className="size-4 text-primary" />}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-lg">
                  Guideline
                </Badge>
                <Badge variant="secondary" className="rounded-lg">
                  RCT
                </Badge>
                <Badge variant="secondary" className="rounded-lg">
                  Meta-analysis
                </Badge>
              </div>
              <EmptyPlaceholder
                label="Library is empty"
                hint="Add references in the Evidence Library."
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
