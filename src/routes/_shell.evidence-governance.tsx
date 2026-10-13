import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Link2, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { EmptyPlaceholder, SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClinicalSafetyBanner } from "@/components/engine/clinical-safety-banner";
import {
  analyseImpact,
  evidenceLifecycle,
  ingestionChannelLabel,
  lifecycleIndex,
  lifecycleLabel,
  sha256Hex,
  useEvidenceGovernance,
  type LifecycleStage,
} from "@/lib/evidence/governance";
import {
  fetchSourceMetadata,
  searchEvidenceCandidates,
  type SearchCandidate,
} from "@/lib/evidence/ingest.functions";

export const Route = createFileRoute("/_shell/evidence-governance")({
  component: EvidenceGovernancePage,
  head: () => ({
    meta: [
      { title: "Update Evidence Center & Governance | IVF Ai Calc" },
      {
        name: "description",
        content:
          "Ingest guidelines by PDF, URL or DOI, fingerprint and de-duplicate them, and move each document through the E0–E10 evidence governance lifecycle.",
      },
      { property: "og:title", content: "Update Evidence Center & Governance | IVF Ai Calc" },
      {
        property: "og:description",
        content:
          "Continuous evidence update, versioning, impact analysis and physician-approved activation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function EvidenceGovernancePage() {
  const { state, hydrated, add, advance, decide, remove } = useEvidenceGovernance();
  const fileInput = useRef<HTMLInputElement>(null);

  const [manual, setManual] = useState({ title: "", society: "", year: "", notes: "" });
  const [reference, setReference] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const lookup = useServerFn(fetchSourceMetadata);
  const search = useServerFn(searchEvidenceCandidates);

  const pending = useMemo(
    () => state.records.filter((r) => r.decision === "pending"),
    [state.records],
  );

  const capture = async (input: Parameters<typeof add>[0]) => {
    const result = add(input);
    if (result.duplicate) {
      toast.warning("Duplicate detected", {
        description: `Matches “${result.duplicate.title}”. The record was queued and flagged.`,
      });
    } else {
      toast.success("Document captured", {
        description: "Queued at stage E2 for physician review.",
      });
    }
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const hash = await sha256Hex(await file.arrayBuffer());
      await capture({
        title: file.name.replace(/\.pdf$/i, ""),
        channel: "PDF_UPLOAD",
        sourceRef: file.name,
        contentHash: hash,
        fileName: file.name,
        fileSize: file.size,
        notes: "Uploaded PDF. No text was parsed and no clinical rule was extracted.",
      });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onImportUrl = async () => {
    if (reference.trim().length < 4) return;
    setBusy(true);
    try {
      const meta = await lookup({ data: { reference: reference.trim() } });
      const hash = await sha256Hex(meta.url);
      await capture({
        title: meta.title ?? reference.trim(),
        society: meta.society,
        year: meta.year,
        channel: "URL_IMPORT",
        sourceRef: meta.url,
        contentHash: hash,
        notes: meta.message,
      });
      setReference("");
    } catch {
      toast.error("Import failed", { description: "The source could not be reached." });
    } finally {
      setBusy(false);
    }
  };

  const onSearch = async () => {
    if (topic.trim().length < 3) return;
    setBusy(true);
    try {
      const result = await search({ data: { topic: topic.trim() } });
      setCandidates(result.candidates);
      setSearchMessage(result.message);
    } catch {
      setCandidates([]);
      setSearchMessage("Assisted search is NOT AVAILABLE in the current environment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Evidence governance"
        title="Update Evidence Center"
        description="Capture, fingerprint, version and review published evidence. No clinical rule is ever extracted automatically — every stage that touches clinical meaning requires an explicit physician action."
      />

      <ClinicalSafetyBanner />

      <SectionCard
        title="Capture a document"
        description="PDF upload, URL / DOI import, manual entry or assisted search."
      >
        <Tabs defaultValue="pdf">
          <TabsList>
            <TabsTrigger value="pdf">PDF upload</TabsTrigger>
            <TabsTrigger value="url">URL / DOI</TabsTrigger>
            <TabsTrigger value="manual">Manual entry</TabsTrigger>
            <TabsTrigger value="search">Assisted search</TabsTrigger>
          </TabsList>

          <TabsContent value="pdf" className="pt-4">
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={busy} className="gap-2">
              <FileUp className="size-4" /> Select PDF
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              The file is fingerprinted with SHA-256 for duplicate detection. Its text is not parsed
              and no rule, threshold or dose is extracted.
            </p>
          </TabsContent>

          <TabsContent value="url" className="space-y-3 pt-4">
            <Label htmlFor="ref">Publisher URL or DOI</Label>
            <Input
              id="ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="10.1093/hropen/… or https://…"
            />
            <Button onClick={() => void onImportUrl()} disabled={busy} className="gap-2">
              <Link2 className="size-4" /> Retrieve metadata
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Label htmlFor="t">Title</Label>
                <Input
                  id="t"
                  value={manual.title}
                  onChange={(e) => setManual({ ...manual, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="s">Society / journal</Label>
                <Input
                  id="s"
                  value={manual.society}
                  onChange={(e) => setManual({ ...manual, society: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="y">Year</Label>
                <Input
                  id="y"
                  value={manual.year}
                  onChange={(e) => setManual({ ...manual, year: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="n">Scope notes</Label>
              <Textarea
                id="n"
                value={manual.notes}
                onChange={(e) => setManual({ ...manual, notes: e.target.value })}
              />
            </div>
            <Button
              disabled={busy || manual.title.trim().length < 3}
              onClick={async () => {
                const hash = await sha256Hex(`${manual.title}|${manual.society}|${manual.year}`);
                await capture({
                  title: manual.title.trim(),
                  society: manual.society.trim() || undefined,
                  year: Number(manual.year) || undefined,
                  channel: "MANUAL_ENTRY",
                  sourceRef: "Manual entry",
                  contentHash: hash,
                  notes: manual.notes,
                });
                setManual({ title: "", society: "", year: "", notes: "" });
              }}
            >
              Add to review queue
            </Button>
          </TabsContent>

          <TabsContent value="search" className="space-y-3 pt-4">
            <Label htmlFor="topic">Clinical topic</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. GnRH antagonist protocol selection"
            />
            <Button onClick={() => void onSearch()} disabled={busy} className="gap-2">
              <Search className="size-4" /> Find candidate references
            </Button>
            {searchMessage ? (
              <p className="text-xs text-muted-foreground">{searchMessage}</p>
            ) : null}
            <ul className="grid gap-2">
              {candidates.map((c) => (
                <li
                  key={`${c.title}-${c.sourceUrl}`}
                  className="rounded-xl border border-border/70 p-3 text-sm"
                >
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.society} {c.year ? `· ${c.year}` : ""} · {c.reason}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline underline-offset-2"
                    >
                      Open source
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const hash = await sha256Hex(c.sourceUrl);
                        await capture({
                          title: c.title,
                          society: c.society,
                          year: c.year ?? undefined,
                          channel: "ASSISTED_SEARCH",
                          sourceRef: c.sourceUrl,
                          contentHash: hash,
                          notes:
                            "Unverified candidate — verify against the publisher before review.",
                        });
                      }}
                    >
                      Queue as candidate
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </SectionCard>

      <SectionCard
        title="Evidence lifecycle"
        description="E0–E10. Steps E3 onwards can only be completed by a physician."
      >
        <ol className="grid gap-2 sm:grid-cols-2">
          {evidenceLifecycle.map((step) => (
            <li key={step.id} className="rounded-xl border border-border/70 px-3 py-2 text-xs">
              <span className="font-semibold">
                {step.id} · {step.label}
              </span>
              <span className="ml-1 text-muted-foreground">{step.description}</span>
              <Badge variant="outline" className="ml-2 rounded-lg text-[10px]">
                {step.automatic ? "Automatic" : "Physician action"}
              </Badge>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard
        title="Review queue"
        description={
          hydrated ? `${pending.length} document(s) awaiting physician review.` : "Loading…"
        }
      >
        {state.records.length === 0 ? (
          <EmptyPlaceholder
            label="No document captured yet"
            hint="Upload a PDF or import a DOI to start the governance workflow."
          />
        ) : (
          <ul className="grid gap-3">
            {state.records.map((record) => {
              const impact = analyseImpact(record, []);
              const nextIndex = Math.min(
                lifecycleIndex(record.stage) + 1,
                evidenceLifecycle.length - 1,
              );
              const nextStage = evidenceLifecycle[nextIndex]!.id as LifecycleStage;
              return (
                <li key={record.id} className="rounded-xl border border-border/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{record.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ingestionChannelLabel[record.channel]} · {record.sourceRef} · hash{" "}
                        {record.contentHash.slice(0, 12)}… · {record.version}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-lg text-[10px] uppercase">
                        {record.stage} · {lifecycleLabel(record.stage)}
                      </Badge>
                      <Badge variant="outline" className="rounded-lg text-[10px] uppercase">
                        {record.decision}
                      </Badge>
                      {record.duplicateOf ? (
                        <Badge
                          variant="outline"
                          className="rounded-lg border-amber-500/50 text-[10px] uppercase"
                        >
                          Duplicate
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">{impact.summary}</p>
                  {impact.engines.length ? (
                    <ul className="mt-1 grid gap-1 text-[11px] text-muted-foreground">
                      {impact.engines.map((e) => (
                        <li key={e.id}>
                          • {e.name} — {e.reason}
                          {e.revalidationRequired ? " (re-validation required)" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {record.supersedes.length ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Proposed to supersede {record.supersedes.length} earlier record(s).
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        advance(record.id, nextStage, "Advanced by physician in the review queue.")
                      }
                      disabled={record.stage === "E10"}
                    >
                      Advance to {nextStage}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        decide(record.id, "accepted", "Accepted for transcription and validation.")
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        decide(record.id, "rejected", "Rejected by the reviewing physician.")
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        decide(record.id, "superseded", "Marked as superseded by a newer version.")
                      }
                    >
                      Mark superseded
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => remove(record.id)}
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Governance log"
        description="Append-only record of every governance action."
      >
        {state.log.length === 0 ? (
          <EmptyPlaceholder label="No governance action recorded yet" />
        ) : (
          <ul className="grid gap-1 text-xs">
            {state.log.slice(0, 60).map((item) => (
              <li key={item.id} className="flex flex-wrap gap-2 border-b border-border/50 py-1.5">
                <ShieldCheck className="size-3.5 text-primary" />
                <span className="text-muted-foreground">{new Date(item.at).toLocaleString()}</span>
                <span className="font-medium">{item.action}</span>
                <span className="text-muted-foreground">{item.detail}</span>
                <span className="text-muted-foreground">— {item.actor}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
