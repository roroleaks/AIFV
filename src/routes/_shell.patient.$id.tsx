import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  Database,
  FileText,
  ShieldAlert,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyPlaceholder, SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { usePatients } from "@/lib/assessment/patients";
import { steps, visibleFields, visibleGroups } from "@/lib/assessment/schema";
import {
  buildAlerts,
  buildTimeline,
  computeTotals,
  formatDuration,
} from "@/lib/assessment/derived";
import { severityLabels, severityTone, validateAssessment } from "@/lib/assessment/validation";
import { buildClinicalDataset, moduleReadiness } from "@/lib/clinical/data-mapping";
import { knowledgeModules } from "@/lib/clinical/knowledge-model";

export const Route = createFileRoute("/_shell/patient/$id")({
  head: () => ({
    meta: [
      { title: "Patient Summary — IVF Ai Calc" },
      {
        name: "description",
        content:
          "Complete clinical overview of one assessed patient: demographics, reserve, cycles, flags and data quality.",
      },
      { property: "og:title", content: "Patient Summary — IVF Ai Calc" },
      {
        property: "og:description",
        content:
          "Complete clinical overview of one assessed patient: demographics, reserve, cycles, flags and data quality.",
      },
    ],
  }),
  component: PatientSummary,
});

function PatientSummary() {
  const { id } = useParams({ from: "/_shell/patient/$id" });
  const { records, hydrated } = usePatients();
  const record = records.find((r) => r.id === decodeURIComponent(id));

  if (!hydrated) return null;

  if (!record) {
    return (
      <>
        <PageHeader
          eyebrow="Records"
          title="Patient not found"
          description="This record is no longer stored in this workspace."
          actions={
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/patients">
                <ArrowLeft className="size-4" /> Back to patients
              </Link>
            </Button>
          }
        />
        <EmptyPlaceholder label="No record" className="min-h-48" />
      </>
    );
  }

  const values = record.values;
  const cycles = record.cycleRecords;
  const totals = computeTotals(values, cycles);
  const alerts = buildAlerts(values, cycles);
  const issues = validateAssessment(values, cycles);
  const timeline = buildTimeline(values, cycles);
  const dataset = buildClinicalDataset(values, cycles);
  const readiness = moduleReadiness(dataset);
  const moduleName = new Map(knowledgeModules.map((m) => [m.id, m.name]));

  const show = (v: unknown) =>
    Array.isArray(v) ? v.join(", ") : v === undefined || v === "" ? "—" : String(v);

  return (
    <>
      <PageHeader
        eyebrow="Patient summary"
        title={record.name}
        description={[
          record.fileNumber && `File ${record.fileNumber}`,
          record.age && `Age ${record.age}`,
          record.infertilityType,
          `Infertility ${formatDuration(totals.infertilityMonths)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/patients">
                <ArrowLeft className="size-4" /> Patients
              </Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/reports">
                <FileText className="size-4" /> Reports
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Completion", value: `${record.completion}%` },
          { label: "Previous cycles", value: totals.totalCycles },
          { label: "Transfers", value: totals.transfers },
          { label: "Live births", value: totals.liveBirths },
        ].map((s) => (
          <div
            key={s.label}
            className="animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Data quality"
          description={`${issues.length} issue${issues.length === 1 ? "" : "s"} detected`}
          contentClassName="p-4"
        >
          {issues.length === 0 ? (
            <EmptyPlaceholder label="No data-quality issues detected" className="min-h-32" />
          ) : (
            <ul className="space-y-2">
              {issues.map((i) => (
                <li
                  key={i.id}
                  className={cn("rounded-xl border px-3 py-2", severityTone[i.severity])}
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-3.5 shrink-0" />
                    <p className="text-xs font-semibold">{i.title}</p>
                    <Badge variant="secondary" className="ml-auto rounded-lg text-[10px]">
                      {severityLabels[i.severity]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] opacity-80">{i.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Clinical flags"
          description={`${alerts.length} recorded`}
          contentClassName="p-4"
        >
          {alerts.length === 0 ? (
            <EmptyPlaceholder label="No flags" className="min-h-32" />
          ) : (
            <ul className="space-y-1.5">
              {alerts.slice(0, 12).map((a) => (
                <li
                  key={a.id}
                  className={cn(
                    "rounded-xl border px-3 py-2",
                    a.severity === "missing"
                      ? "border-border bg-muted/50"
                      : "border-primary/25 bg-primary-soft/50",
                  )}
                >
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <CircleAlert className="size-3.5" /> {a.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{a.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {steps
          .filter((s) => !s.custom)
          .map((step) => {
            const groups = visibleGroups(step, values);
            return (
              <SectionCard key={step.id} title={step.title} description={step.description}>
                <div className="space-y-4">
                  {groups.map((g) => (
                    <div key={g.title}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.title}
                      </p>
                      <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                        {visibleFields(g, values).map((f) => (
                          <div
                            key={f.key}
                            className="flex items-baseline justify-between gap-3 text-xs"
                          >
                            <dt className="truncate text-muted-foreground">{f.label}</dt>
                            <dd className="shrink-0 font-semibold">
                              {f.type === "derived" && f.compute
                                ? f.compute(values) || "—"
                                : show(values[f.key])}
                              {f.unit && values[f.key] !== undefined ? ` ${f.unit}` : ""}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </SectionCard>
            );
          })}
      </div>

      <SectionCard
        title="Previous cycles"
        description={`${cycles.length} recorded`}
        contentClassName="p-0"
      >
        {cycles.length === 0 ? (
          <div className="p-5">
            <EmptyPlaceholder label="No previous IVF / ICSI cycles recorded" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  {[
                    "#",
                    "Date",
                    "Type",
                    "Protocol",
                    "Retrieved",
                    "MII",
                    "Blastocysts",
                    "Transferred",
                    "Pregnancy",
                    "Live birth",
                    "OHSS",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cycles.map((c, i) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{show(c["cycleNumber"] ?? i + 1)}</td>
                    <td className="px-4 py-2.5">{show(c["cycleDate"] ?? c["cycleYear"])}</td>
                    <td className="px-4 py-2.5">{show(c["cycleType"])}</td>
                    <td className="px-4 py-2.5">{show(c["protocol"])}</td>
                    <td className="px-4 py-2.5">{show(c["retrieved"])}</td>
                    <td className="px-4 py-2.5">{show(c["mii"])}</td>
                    <td className="px-4 py-2.5">{show(c["blastocysts"])}</td>
                    <td className="px-4 py-2.5">{show(c["transferred"])}</td>
                    <td className="px-4 py-2.5">{show(c["clinicalPregnancy"])}</td>
                    <td className="px-4 py-2.5">{show(c["liveBirth"])}</td>
                    <td className="px-4 py-2.5">{show(c["ohss"])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Reproductive timeline"
          description={`${timeline.length} documented event${timeline.length === 1 ? "" : "s"}`}
          contentClassName="p-4"
        >
          {timeline.length === 0 ? (
            <EmptyPlaceholder label="No events recorded" className="min-h-32" />
          ) : (
            <ol className="space-y-2">
              {timeline.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-3 rounded-xl border border-border/60 px-3 py-2"
                >
                  <e.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{e.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {e.category}
                      {e.date ? ` · ${e.date}` : ""}
                    </p>
                  </div>
                  <CalendarClock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        <SectionCard
          title="Clinical module data readiness"
          description="How much of each future module's input set this record already contains."
          contentClassName="p-4"
        >
          <ul className="space-y-3">
            {readiness.map((r) => (
              <li key={r.moduleId}>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium">{moduleName.get(r.moduleId)}</span>
                  <span className="text-muted-foreground">
                    {r.available}/{r.required}
                  </span>
                </div>
                <Progress value={r.percent} className="mt-1 h-1.5" />
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <Database className="mt-0.5 size-3 shrink-0" />
            Readiness reflects captured data only. No module performs a calculation.
          </p>
        </SectionCard>
      </div>
    </>
  );
}
