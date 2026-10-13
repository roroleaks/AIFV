import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCopy,
  Database,
  ExternalLink,
  FileDown,
  FlaskConical,
  Info,
  LineChart as LineChartIcon,
  Lock,
  Pencil,
  Plus,
  Printer,
  Ruler,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { findEvidence } from "@/lib/evidence/library";
import {
  DESCRIPTIVE_BAND_DISCLAIMER,
  MONITORING_REQUIRED_EVIDENCE,
  monitoringConsumerInterfaces,
  monitoringReportText,
  monitoringStatusLabel,
  type MonitoringAlert,
  type MonitoringResult,
  type MonitoringVisit,
  type TrackedFollicle,
} from "@/lib/engine/monitoring";

function Card({
  icon: Icon,
  title,
  badge,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "animate-rise rounded-2xl border border-border/70 bg-card p-5 shadow-soft",
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-4.5" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {badge && <div className="ml-auto shrink-0">{badge}</div>}
      </div>
      {children}
    </section>
  );
}

/* ----------------------------------------------------------- cycle context */

export function MonitoringContextCard({ result }: { result: MonitoringResult }) {
  return (
    <Card icon={UserRound} title="Imported cycle context">
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {result.context.items.map((i) => (
          <li key={i.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {i.label}
            </p>
            <p
              className={cn(
                "mt-1 text-sm font-medium",
                !i.available && "text-amber-600 dark:text-amber-400",
              )}
            >
              {i.value}
            </p>
            {i.detail && <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------- timeline */

export function StimulationTimeline({
  result,
  maxDay,
  activeDay,
  onSelectDay,
}: {
  result: MonitoringResult;
  maxDay: number;
  activeDay: number | null;
  onSelectDay: (day: number) => void;
}) {
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const byDay = new Map(result.visits.map((v) => [v.day, v]));

  return (
    <Card
      icon={Activity}
      title="Stimulation timeline"
      badge={
        <Badge variant="outline" className="rounded-full">
          {result.visits.length} visit(s) recorded
        </Badge>
      }
    >
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-stretch gap-2">
          {days.map((day) => {
            const visit = byDay.get(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  "w-24 shrink-0 rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft",
                  visit
                    ? "border-primary/40 bg-primary-soft/60"
                    : "border-dashed border-border bg-muted/30",
                  activeDay === day && "ring-2 ring-primary/60",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {visit?.triggerDay ? "Trigger" : `Day ${day}`}
                </p>
                <p className="mt-1 truncate text-sm font-semibold">
                  {visit?.largestFollicle !== undefined && visit?.largestFollicle !== null
                    ? `${visit.largestFollicle} mm`
                    : visit
                      ? "Recorded"
                      : "—"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {visit?.dailyDose !== undefined && visit?.dailyDose !== null
                    ? `${visit.dailyDose} IU`
                    : "No entry"}
                </p>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Select any day to record or edit a follow-up visit. The timeline extends automatically
        beyond day 14 as later visits are entered.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------- visit form */

const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * Parse physician-supplied follicle identifiers, format "ID:side:size"
 * (e.g. "R1:R:12"). Identity is never inferred — a record without an explicit
 * ID from the physician is discarded rather than invented.
 */
function parseFollicleRecords(raw: string): TrackedFollicle[] {
  return raw
    .split(/[,;\n]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [id, sideRaw, sizeRaw] = chunk.split(":").map((x) => x.trim());
      const size = Number(sizeRaw);
      if (!id || !Number.isFinite(size) || size <= 0) return null;
      const side: TrackedFollicle["side"] =
        sideRaw?.toLowerCase().startsWith("r")
          ? "right"
          : sideRaw?.toLowerCase().startsWith("l")
            ? "left"
            : "unspecified";
      return { followId: id, side, size };
    })
    .filter((x): x is TrackedFollicle => x !== null);
}

export function VisitForm({
  day,
  existing,
  onSave,
  onCancel,
}: {
  day: number;
  existing: MonitoringVisit | undefined;
  onSave: (visit: Omit<MonitoringVisit, "id" | "recordedAt">) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() => ({
    day,
    date: existing?.date ?? "",
    dailyDose: existing?.dailyDose?.toString() ?? "",
    medication: existing?.medication ?? "",
    medicationChange: existing?.medicationChange ?? "",
    follicleCount: existing?.follicleCount?.toString() ?? "",
    follicleSizes: existing?.follicleSizes.join(", ") ?? "",
    largestFollicle: existing?.largestFollicle?.toString() ?? "",
    follicles10: existing?.follicles10?.toString() ?? "",
    follicles14: existing?.follicles14?.toString() ?? "",
    follicles17: existing?.follicles17?.toString() ?? "",
    endometrium: existing?.endometrium?.toString() ?? "",
    estradiol: existing?.estradiol?.toString() ?? "",
    progesterone: existing?.progesterone?.toString() ?? "",
    lh: existing?.lh?.toString() ?? "",
    notes: existing?.notes ?? "",
    triggerDay: existing?.triggerDay ?? false,
    medicationType: existing?.medicationType ?? "",
    route: existing?.route ?? "",
    doseChangeReason: existing?.doseChangeReason ?? "",
    doseChangedAt: existing?.doseChangedAt ?? "",
    gnrhAnalogue: existing?.gnrhAnalogue ?? "",
    gnrhDose: existing?.gnrhDose ?? "",
    gnrhStartDate: existing?.gnrhStartDate ?? "",
    gnrhChangeDate: existing?.gnrhChangeDate ?? "",
    otherMedication: existing?.otherMedication ?? "",
    triggerMedication: existing?.triggerMedication ?? "",
    rightFollicles: existing?.rightFollicles?.toString() ?? "",
    leftFollicles: existing?.leftFollicles?.toString() ?? "",
    endometrialPattern: existing?.endometrialPattern ?? "",
    ultrasoundOther: existing?.ultrasoundOther ?? "",
    follicleRecords: (existing?.follicleRecords ?? [])
      .map((f) => `${f.followId}:${f.side === "unspecified" ? "?" : f.side[0]!.toUpperCase()}:${f.size}`)
      .join(", "),
    symptoms: existing?.symptoms ?? "",
    adverseEvents: existing?.adverseEvents ?? "",
    protocol: existing?.protocol ?? "",
    protocolChange: existing?.protocolChange ?? "",
    carriedForward: existing?.carriedForward ?? "",
  }));

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const field = (key: keyof typeof form, label: string, unit?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`visit-${key}`} className="text-xs">
        {label}
        {unit ? ` (${unit})` : ""}
      </Label>
      <Input
        id={`visit-${key}`}
        inputMode="decimal"
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value)}
        className="rounded-xl"
      />
    </div>
  );

  const submit = () => {
    onSave({
      day: form.day,
      date: form.date,
      dailyDose: numOrNull(form.dailyDose),
      medication: form.medication.trim(),
      medicationChange: form.medicationChange.trim(),
      follicleCount: numOrNull(form.follicleCount),
      follicleSizes: form.follicleSizes
        .split(/[,\s]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0),
      largestFollicle: numOrNull(form.largestFollicle),
      follicles10: numOrNull(form.follicles10),
      follicles14: numOrNull(form.follicles14),
      follicles17: numOrNull(form.follicles17),
      endometrium: numOrNull(form.endometrium),
      estradiol: numOrNull(form.estradiol),
      progesterone: numOrNull(form.progesterone),
      lh: numOrNull(form.lh),
      notes: form.notes.trim(),
      triggerDay: form.triggerDay,
      medicationType: form.medicationType.trim(),
      route: form.route.trim(),
      doseChangeReason: form.doseChangeReason.trim(),
      doseChangedAt: form.doseChangedAt.trim(),
      gnrhAnalogue: form.gnrhAnalogue.trim(),
      gnrhDose: form.gnrhDose.trim(),
      gnrhStartDate: form.gnrhStartDate.trim(),
      gnrhChangeDate: form.gnrhChangeDate.trim(),
      otherMedication: form.otherMedication.trim(),
      triggerMedication: form.triggerMedication.trim(),
      rightFollicles: numOrNull(form.rightFollicles),
      leftFollicles: numOrNull(form.leftFollicles),
      endometrialPattern: form.endometrialPattern.trim(),
      ultrasoundOther: form.ultrasoundOther.trim(),
      follicleRecords: parseFollicleRecords(form.follicleRecords),
      symptoms: form.symptoms.trim(),
      adverseEvents: form.adverseEvents.trim(),
      protocol: form.protocol.trim(),
      protocolChange: form.protocolChange.trim(),
      carriedForward: form.carriedForward.trim(),
    });
  };

  return (
    <Card
      icon={Pencil}
      title={`${existing ? "Edit" : "New"} follow-up visit — stimulation day ${day}`}
      className="print:hidden"
    >
      <div className="grid gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Dose
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor="visit-date" className="text-xs">
                Visit date
              </Label>
              <Input
                id="visit-date"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="rounded-xl"
              />
            </div>
            {field("dailyDose", "Current daily dose", "IU")}
            {field("medication", "Medication")}
            {field("medicationType", "Medication type")}
            {field("route", "Route")}
            {field("medicationChange", "Medication changes")}
            {field("doseChangeReason", "Reason for dose change")}
            {field("doseChangedAt", "Date/time of change")}
            {field("protocol", "Current protocol")}
            {field("protocolChange", "Protocol change event")}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Other medications
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {field("gnrhAnalogue", "GnRH analogue")}
            {field("gnrhDose", "GnRH analogue dose")}
            {field("gnrhStartDate", "GnRH start date")}
            {field("gnrhChangeDate", "GnRH change date")}
            {field("otherMedication", "Other stimulation medication")}
            {field("triggerMedication", "Trigger medication (physician-entered event)")}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Ultrasound
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {field("follicleCount", "Follicle count")}
            {field("follicleSizes", "Follicle sizes", "mm, comma separated")}
            {field("largestFollicle", "Largest follicle", "mm")}
            {field("follicles10", "Follicles ≥ 10 mm")}
            {field("follicles14", "Follicles ≥ 14 mm")}
            {field("follicles17", "Follicles ≥ 17 mm")}
            {field("endometrium", "Endometrial thickness", "mm")}
            {field("endometrialPattern", "Endometrial pattern")}
            {field("rightFollicles", "Right ovary follicles")}
            {field("leftFollicles", "Left ovary follicles")}
            {field("follicleRecords", "Identified follicles", "ID:side:mm — e.g. R1:R:12")}
            {field("ultrasoundOther", "Other ultrasound findings")}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Individual follicles are tracked longitudinally only when you supply the identifier.
            Without IDs the engine uses aggregate measurements and does not infer follicle identity.
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Laboratory
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {field("estradiol", "Estradiol (E2)", "pg/mL")}
            {field("progesterone", "Progesterone", "ng/mL")}
            {field("lh", "LH", "IU/L")}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Clinical
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {field("symptoms", "Symptoms (pain, bleeding, distension)")}
            {field("adverseEvents", "Adverse events")}
            {field("carriedForward", "Carried forward historical value")}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="visit-notes" className="text-xs">
            Clinical notes
          </Label>
          <Textarea
            id="visit-notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            maxLength={2000}
            className="rounded-xl"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.triggerDay}
            onChange={(e) => set("triggerDay", e.target.checked)}
            className="size-4 rounded border-border"
          />
          Mark this visit as the trigger day
        </label>

        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} className="rounded-xl">
            <Check className="size-4" /> Save visit
          </Button>
          <Button variant="outline" onClick={onCancel} className="rounded-xl">
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- charts */

const chartConfigs = [
  {
    id: "follicles",
    title: "Follicle growth",
    unit: "mm / count",
    lines: [
      { key: "largestFollicle", label: "Largest follicle (mm)", color: "var(--color-chart-1, #2563eb)" },
      { key: "follicles10", label: "≥ 10 mm", color: "var(--color-chart-2, #10b981)" },
      { key: "follicles14", label: "≥ 14 mm", color: "var(--color-chart-3, #8b5cf6)" },
      { key: "follicles17", label: "≥ 17 mm", color: "var(--color-chart-4, #f59e0b)" },
    ],
  },
  {
    id: "e2",
    title: "Estradiol trend",
    unit: "pg/mL",
    lines: [{ key: "estradiol", label: "Estradiol", color: "var(--color-chart-2, #10b981)" }],
  },
  {
    id: "dose",
    title: "Dose timeline",
    unit: "IU/day",
    lines: [{ key: "dailyDose", label: "Daily dose", color: "var(--color-chart-1, #2563eb)" }],
  },
  {
    id: "lh",
    title: "LH trend",
    unit: "IU/L",
    lines: [{ key: "lh", label: "LH", color: "var(--color-chart-4, #f59e0b)" }],
  },
  {
    id: "p4",
    title: "Progesterone trend",
    unit: "ng/mL",
    lines: [{ key: "progesterone", label: "Progesterone", color: "var(--color-chart-5, #ec4899)" }],
  },
  {
    id: "cohort",
    title: "Follicular cohort",
    unit: "count",
    lines: [{ key: "follicleCount", label: "Total follicles", color: "var(--color-chart-2, #10b981)" }],
  },
  {
    id: "endometrium",
    title: "Endometrial thickness",
    unit: "mm",
    lines: [{ key: "endometrium", label: "Endometrium", color: "var(--color-chart-3, #8b5cf6)" }],
  },
] as const;

export function MonitoringCharts({ result }: { result: MonitoringResult }) {
  if (result.series.length === 0) {
    return (
      <Card icon={LineChartIcon} title="Visualisation">
        <p className="text-sm text-muted-foreground">
          Charts appear once at least one monitoring visit is recorded.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {chartConfigs.map((c) => (
        <Card key={c.id} icon={LineChartIcon} title={c.title}>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.series} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d: number) => `D${d}`}
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--color-popover-foreground)",
                  }}
                  labelFormatter={(d) => `Stimulation day ${d}`}
                />
                {c.lines.map((l) => (
                  <Line
                    key={l.key}
                    type="monotone"
                    dataKey={l.key}
                    name={l.label}
                    stroke={l.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {c.unit} · previous measurements shown for comparison
          </p>
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- visit cards */

export function VisitCards({
  result,
  onEdit,
  onDelete,
}: {
  result: MonitoringResult;
  onEdit: (visit: MonitoringVisit) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (!result.visits.length) {
    return (
      <Card icon={Ruler} title="Follow-up visits">
        <p className="text-sm text-muted-foreground">
          No monitoring visit recorded yet. Select a day on the timeline to add the first entry.
        </p>
      </Card>
    );
  }

  return (
    <Card icon={Ruler} title="Follow-up visits">
      <ul className="grid gap-2">
        {result.visits.map((v) => {
          const expanded = open === v.id;
          return (
            <li key={v.id} className="rounded-xl border border-border/60 bg-muted/30">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : v.id)}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
              >
                <Badge variant="outline" className="rounded-full">
                  {v.triggerDay ? "Trigger day" : `Day ${v.day}`}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {v.largestFollicle !== null ? `Largest ${v.largestFollicle} mm` : "No lead follicle"}
                  {v.estradiol !== null ? ` · E2 ${v.estradiol} pg/mL` : ""}
                  {v.dailyDose !== null ? ` · ${v.dailyDose} IU/day` : ""}
                </span>
                <ChevronDown
                  className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")}
                />
              </button>
              {expanded && (
                <div className="animate-rise border-t border-border/60 px-3.5 py-3">
                  <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      ["Visit date", v.date || "Not recorded"],
                      ["Daily dose", v.dailyDose === null ? "Not recorded" : `${v.dailyDose} IU`],
                      ["Medication", v.medication || "Not recorded"],
                      ["Medication change", v.medicationChange || "None recorded"],
                      ["Follicle count", v.follicleCount ?? "Not recorded"],
                      ["Follicle sizes", v.follicleSizes.length ? `${v.follicleSizes.join(", ")} mm` : "Not recorded"],
                      ["Largest follicle", v.largestFollicle === null ? "Not recorded" : `${v.largestFollicle} mm`],
                      ["Follicles ≥ 10 mm", v.follicles10 ?? "Not recorded"],
                      ["Follicles ≥ 14 mm", v.follicles14 ?? "Not recorded"],
                      ["Follicles ≥ 17 mm", v.follicles17 ?? "Not recorded"],
                      ["Endometrium", v.endometrium === null ? "Not recorded" : `${v.endometrium} mm`],
                      ["Estradiol", v.estradiol === null ? "Not recorded" : `${v.estradiol} pg/mL`],
                      ["Progesterone", v.progesterone === null ? "Not recorded" : `${v.progesterone} ng/mL`],
                      ["LH", v.lh === null ? "Not recorded" : `${v.lh} IU/L`],
                      ["Medication type", v.medicationType || "Not recorded"],
                      ["Route", v.route || "Not recorded"],
                      ["Reason for dose change", v.doseChangeReason || "None recorded"],
                      ["Protocol", v.protocol || "Not recorded"],
                      ["Protocol change", v.protocolChange || "None recorded"],
                      ["GnRH analogue", v.gnrhAnalogue || "Not recorded"],
                      ["GnRH dose", v.gnrhDose || "Not recorded"],
                      ["Other medication", v.otherMedication || "Not recorded"],
                      [
                        "Trigger medication",
                        v.triggerMedication
                          ? `${v.triggerMedication} — PHYSICIAN-ENTERED EVENT`
                          : "Not recorded",
                      ],
                      ["Right ovary follicles", v.rightFollicles ?? "Not recorded"],
                      ["Left ovary follicles", v.leftFollicles ?? "Not recorded"],
                      ["Endometrial pattern", v.endometrialPattern || "Not recorded"],
                      [
                        "Identified follicles",
                        v.follicleRecords?.length
                          ? v.follicleRecords
                              .map((f) => `${f.followId} (${f.side}) ${f.size} mm`)
                              .join(", ")
                          : "None supplied",
                      ],
                      ["Other ultrasound findings", v.ultrasoundOther || "Not recorded"],
                      ["Symptoms", v.symptoms || "None recorded"],
                      ["Adverse events", v.adverseEvents || "None recorded"],
                      [
                        "Carried forward value",
                        v.carriedForward
                          ? `${v.carriedForward} — carried forward historical value`
                          : "None",
                      ],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  {v.notes && (
                    <p className="mt-2 rounded-lg bg-background/60 p-2.5 text-xs">{v.notes}</p>
                  )}
                  <div className="mt-3 flex gap-2 print:hidden">
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onEdit(v)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => onDelete(v.id)}>
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------------------------------------------------------------- status */

export function MonitoringStatusCard({ result }: { result: MonitoringResult }) {
  return (
    <Card
      icon={Activity}
      title="Monitoring status"
      badge={
        <Badge variant="outline" className="rounded-full">
          {result.completeness.percent}% complete
        </Badge>
      }
    >
      <p className="text-lg font-semibold">{monitoringStatusLabel[result.status]}</p>
      <p className="mt-1 text-sm text-muted-foreground">{result.statusDetail}</p>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            Evidence-based adjustment algorithm not yet activated
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{result.pendingMessage}</p>
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- trends */

export function MonitoringTrendsCard({ result }: { result: MonitoringResult }) {
  return (
    <Card icon={LineChartIcon} title="Response trends">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Parameter</th>
              <th className="py-2 pr-3 font-semibold">Latest</th>
              <th className="py-2 pr-3 font-semibold">Previous</th>
              <th className="py-2 pr-3 font-semibold">Change</th>
              <th className="py-2 font-semibold">Per day</th>
            </tr>
          </thead>
          <tbody>
            {result.trends.map((t) => (
              <tr key={t.id} className="border-b border-border/40 last:border-0">
                <td className="py-2 pr-3 font-medium">{t.label}</td>
                <td className="py-2 pr-3">{t.latest}</td>
                <td className="py-2 pr-3 text-muted-foreground">{t.previous}</td>
                <td className="py-2 pr-3">{t.change}</td>
                <td className="py-2">{t.perDay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Values are arithmetic differences between the entered measurements. No clinical
        interpretation is applied.
      </p>
    </Card>
  );
}

/* ---------------------------------------------------------------- alerts */

const alertTone: Record<MonitoringAlert["kind"], string> = {
  "rapid-growth": "border-amber-500/40 bg-amber-500/10",
  "slow-growth": "border-amber-500/40 bg-amber-500/10",
  "incomplete-monitoring": "border-border/60 bg-muted/40",
  "missing-laboratory": "border-border/60 bg-muted/40",
  "possible-excessive-response": "border-amber-500/40 bg-amber-500/10",
  "possible-inadequate-response": "border-amber-500/40 bg-amber-500/10",
};

export function MonitoringAlertsCard({ result }: { result: MonitoringResult }) {
  return (
    <Card
      icon={AlertTriangle}
      title="Informational alerts"
      badge={
        <Badge variant="outline" className="rounded-full">
          Informational only
        </Badge>
      }
    >
      {result.alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No informational observation generated from the entered data.
        </p>
      ) : (
        <ul className="grid gap-2">
          {result.alerts.map((a) => (
            <li key={a.id} className={cn("rounded-xl border px-3.5 py-2.5", alertTone[a.kind])}>
              <p className="text-sm font-semibold">{a.label}</p>
              <p className="mt-0.5 text-xs">{a.observation}</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.basis}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {DESCRIPTIVE_BAND_DISCLAIMER}
      </p>
    </Card>
  );
}

/* --------------------------------------------------------------- summary */

export function MonitoringSummaryCard({ result }: { result: MonitoringResult }) {
  const s = result.summary;
  const rows: [string, string][] = [
    ["Current stimulation day", s.currentDay === null ? "No visit recorded" : `Day ${s.currentDay}`],
    ["Current dose", s.currentDose],
    ["Follicular development", s.follicularDevelopment],
    ["Hormone results", s.hormoneResults],
    ["Response trend", s.responseTrend],
    ["Monitoring completeness", s.completeness],
    ["Pending evidence-based recommendations", s.pendingRecommendations],
  ];
  return (
    <Card icon={FlaskConical} title="Physician summary">
      <dl className="grid gap-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-0.5 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
          >
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {label}
            </dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/* -------------------------------------------------------------- evidence */

export function MonitoringEvidenceCard({ ids }: { ids: string[] }) {
  const entries = useMemo(
    () => ids.map((id) => findEvidence(id)).filter((e): e is NonNullable<typeof e> => Boolean(e)),
    [ids],
  );

  return (
    <Card icon={BookOpen} title="Evidence panel">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No linked reference indexed yet.</p>
      ) : (
        <ul className="grid gap-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <Link
                to="/evidence/$id"
                params={{ id: e.id }}
                className="text-sm font-medium text-primary hover:underline"
              >
                {e.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{e.journal}</span>
                <span>{e.year}</span>
                <span>Evidence level {e.level}</span>
                {e.doi && <span>DOI {e.doi}</span>}
                <a
                  href={e.url ?? (e.doi ? `https://doi.org/${e.doi}` : "#")}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open <ExternalLink className="size-3" />
                </a>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Relevant monitoring guidance: indexed record only — the monitoring and adjustment
                tables of this document have not been transcribed into the application.
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-xl border border-dashed border-border px-3.5 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Required to activate dose adjustment
        </p>
        <ul className="mt-1.5 grid gap-1 text-xs text-muted-foreground">
          {MONITORING_REQUIRED_EVIDENCE.map((x) => (
            <li key={x}>• {x}</li>
          ))}
        </ul>
        <Button asChild size="sm" variant="ghost" className="mt-2 rounded-xl">
          <Link to="/evidence-requirements">View full requirements list</Link>
        </Button>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------- integration */

export function MonitoringIntegrationCard() {
  return (
    <Card icon={Database} title="Prepared interfaces">
      <ul className="grid gap-2 sm:grid-cols-2">
        {monitoringConsumerInterfaces.map((c) => (
          <li key={c.id} className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
            <p className="text-sm font-medium">{c.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Receives: {c.receives.join(" · ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.status}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------------------------------------------------------- actions */

export function MonitoringActions({ result }: { result: MonitoringResult }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(monitoringReportText(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" /> Print
      </Button>
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <FileDown className="size-4" /> Export PDF
      </Button>
      <Button size="sm" onClick={copy}>
        {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
        {copied ? "Copied" : "Copy monitoring report"}
      </Button>
    </div>
  );
}

export const MonitoringAddIcon = Plus;
