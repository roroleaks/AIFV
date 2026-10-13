import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, FlaskConical, PlayCircle, ShieldCheck, XCircle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ClinicalSafetyBanner } from "@/components/engine/clinical-safety-banner";
import { TestModeBanner } from "@/components/engine/test-mode-banner";
import {
  TEST_MODE_DISCLAIMER,
  engineEvidenceStatusLabel,
  executionModeLabel,
  useEngineActivation,
} from "@/lib/engine/activation-registry";
import {
  goldenPatients,
  runFullSystemTest,
  type SystemTestReport,
} from "@/lib/engine/test-battery";

export const Route = createFileRoute("/_shell/system-test")({
  component: SystemTestPage,
  head: () => ({
    meta: [
      { title: "Full Engine Test & Activation Registry | IVF Ai Calc" },
      {
        name: "description",
        content:
          "Switch execution mode, review every engine's activation state and run the full synthetic system test with treatment-firewall verification.",
      },
      { property: "og:title", content: "Full Engine Test & Activation Registry | IVF Ai Calc" },
      {
        property: "og:description",
        content:
          "Engine activation registry, execution-mode control and the full synthetic system test battery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function SystemTestPage() {
  const { mode, testMode, registry, setMode, toggleEngine, isEnabled } = useEngineActivation();
  const [report, setReport] = useState<SystemTestReport | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      setReport(runFullSystemTest());
      setRunning(false);
    }, 60);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System governance"
        title="Full Engine Test & Activation Registry"
        description="Declares which engines are backed by transcribed published evidence, which carry non-validated internal test logic, and which remain blocked in every mode."
      />

      <TestModeBanner />
      <ClinicalSafetyBanner />

      <SectionCard
        title="Execution mode"
        description="Production is restored automatically in every new browser session."
      >
        <div className="flex flex-wrap items-center gap-4">
          <Badge
            variant="outline"
            className={cn(
              "rounded-lg text-[11px] uppercase tracking-wide",
              testMode
                ? "border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {executionModeLabel[mode]}
          </Badge>
          <div className="flex items-center gap-2">
            <Switch
              id="mode"
              checked={testMode}
              onCheckedChange={(checked) => setMode(checked ? "FULL_TEST" : "PRODUCTION")}
            />
            <Label htmlFor="mode" className="text-sm">
              Enable full engine test mode
            </Label>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{TEST_MODE_DISCLAIMER}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Test mode does not create missing evidence. An engine with no transcribed algorithm stays
          blocked in both modes — see the registry below.
        </p>
      </SectionCard>

      <SectionCard
        title="Engine activation registry"
        description="One row per engine: logic source, evidence status and what is still missing before production activation."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Engine</th>
                <th className="py-2 pr-3">Evidence status</th>
                <th className="py-2 pr-3">Executable in test mode</th>
                <th className="py-2 pr-3">Logic source</th>
                <th className="py-2 pr-3">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {registry.map((engine) => (
                <tr key={engine.id} className="align-top">
                  <td className="py-3 pr-3">
                    <Link to={engine.route} className="font-medium hover:underline">
                      {engine.name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">v{engine.version}</p>
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    {engineEvidenceStatusLabel[engine.evidenceStatus]}
                    {engine.missingForProduction.length ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Missing: {engine.missingForProduction.join("; ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    {engine.testImplementation
                      ? "Yes — labelled test output"
                      : "No — nothing to run"}
                  </td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">{engine.logicSource}</td>
                  <td className="py-3 pr-3">
                    <Switch
                      checked={isEnabled(engine.id)}
                      onCheckedChange={(checked) => toggleEngine(engine.id, checked)}
                      aria-label={`Enable ${engine.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Full system test"
        description={`Runs every executable engine against ${goldenPatients.length} synthetic test patients and verifies that all treatment firewalls hold.`}
        action={
          <Button onClick={run} disabled={running} className="gap-2">
            <PlayCircle className="size-4" /> {running ? "Running…" : "Run full engine test"}
          </Button>
        }
      >
        {!report ? (
          <p className="text-sm text-muted-foreground">
            No test has been run in this session. Synthetic patients are fixtures only and produce
            no clinical conclusion.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline" className="rounded-lg">
                <FlaskConical className="mr-1 size-3" /> Mode: {executionModeLabel[report.mode]}
              </Badge>
              <Badge variant="outline" className="rounded-lg">
                {report.totals.passed}/{report.totals.checks} checks passed
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(report.ranAt).toLocaleString()}
              </span>
            </div>

            <div className="space-y-4">
              {report.patients.map((patient) => (
                <div key={patient.patientId} className="rounded-xl border border-border/70 p-3">
                  <p className="text-sm font-medium">{patient.patientName}</p>
                  <p className="text-xs text-muted-foreground">{patient.scenario}</p>
                  <ul className="mt-2 grid gap-1 text-xs">
                    {patient.engines.map((engine) => (
                      <li key={engine.engineId} className="flex items-start gap-2">
                        {engine.outcome === "pass" ? (
                          <CheckCircle2 className="mt-0.5 size-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="mt-0.5 size-3.5 text-rose-500" />
                        )}
                        <span>
                          <span className="font-medium">{engine.engineName}</span> — {engine.status}
                          {engine.detail ? `: ${engine.detail}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/70 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4 text-primary" /> Treatment firewall verification
              </p>
              <ul className="mt-2 grid gap-1 text-xs">
                {report.firewall.map((check) => (
                  <li key={check.gate} className="flex items-start gap-2">
                    {check.outcome === "pass" ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 size-3.5 text-rose-500" />
                    )}
                    <span>
                      <span className="font-medium">{check.name}</span> — {check.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
