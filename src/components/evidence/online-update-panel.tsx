/**
 * Online Evidence Update panel.
 *
 * Retrieves bibliographic metadata only (Crossref lookup + assisted candidate
 * search). It never parses clinical content and never derives rules, doses or
 * recommendations. Everything imported here lands as `pending-review`.
 */

import { useState } from "react";
import { CloudDownload, ExternalLink, Link2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { draftToEntry, emptyImportDraft } from "@/lib/evidence/store";
import type { EvidenceEntry } from "@/lib/evidence/library";
import {
  fetchSourceMetadata,
  searchEvidenceCandidates,
  type SearchCandidate,
} from "@/lib/evidence/ingest.functions";

interface Props {
  library: EvidenceEntry[];
  onImport: (entry: EvidenceEntry) => void;
}

const suggestedTopics = [
  "ESHRE ovarian stimulation guideline update",
  "POSEIDON low prognosis criteria",
  "GnRH antagonist protocol randomised trials",
  "OHSS prevention and freeze-all",
];

export function OnlineUpdatePanel({ library, onImport }: Props) {
  const lookup = useServerFn(fetchSourceMetadata);
  const search = useServerFn(searchEvidenceCandidates);

  const [reference, setReference] = useState("");
  const [topic, setTopic] = useState(suggestedTopics[0]!);
  const [busy, setBusy] = useState<"lookup" | "search" | null>(null);
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const isDuplicate = (title: string, doi?: string) =>
    library.some(
      (e) =>
        (doi && e.doi && e.doi.toLowerCase() === doi.toLowerCase()) ||
        e.title.trim().toLowerCase() === title.trim().toLowerCase(),
    );

  const importEntry = (input: {
    title: string;
    society?: string | undefined;
    year?: number | undefined;
    url: string;
    doi?: string | undefined;
    sourceKind: "DOI" | "Journal URL";
  }) => {
    if (isDuplicate(input.title, input.doi)) {
      toast.warning("Already in the library", { description: input.title });
      return;
    }
    const entry = draftToEntry({
      ...emptyImportDraft,
      sourceKind: input.sourceKind,
      title: input.title,
      journal: input.society ?? "",
      publisher: input.society ?? "",
      year: input.year ? String(input.year) : "",
      doi: input.doi ?? "",
      url: input.url,
      type: "Guideline",
      level: "Not graded",
      quality: "Not rated",
    });
    onImport(entry);
    toast.success("Reference imported", {
      description: "Stored as pending review — verify the metadata against the publisher.",
    });
  };

  const onLookup = async () => {
    const raw = reference.trim();
    if (raw.length < 4) return;
    setBusy("lookup");
    try {
      const meta = await lookup({ data: { reference: raw } });
      setMessage(meta.message);
      if (!meta.ok) {
        toast.error("Lookup failed", { description: meta.message });
        return;
      }
      importEntry({
        title: meta.title ?? raw,
        society: meta.society,
        year: meta.year,
        url: meta.url,
        doi: meta.doi,
        sourceKind: meta.doi ? "DOI" : "Journal URL",
      });
      setReference("");
    } catch {
      toast.error("Lookup failed", { description: "The source could not be reached." });
    } finally {
      setBusy(null);
    }
  };

  const onSearch = async () => {
    const t = topic.trim();
    if (t.length < 3) return;
    setBusy("search");
    try {
      const result = await search({ data: { topic: t } });
      setCandidates(result.candidates);
      setMessage(result.message);
      if (result.available && result.candidates.length === 0) {
        toast.info("No candidate references returned", { description: "Try a narrower topic." });
      }
    } catch {
      setCandidates([]);
      setMessage("Online search is not available in the current environment.");
      toast.error("Online search unavailable");
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionCard
      title="Online update"
      description="Fetch bibliographic metadata from Crossref or list candidate publications. Metadata only — no clinical content is parsed or interpreted."
      contentClassName="p-4 space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="online-ref">Import by DOI or publisher URL</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="online-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="10.1093/hropen/… or https://…"
            className="min-w-[16rem] flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") void onLookup();
            }}
          />
          <Button
            className="rounded-xl"
            disabled={busy !== null || reference.trim().length < 4}
            onClick={() => void onLookup()}
          >
            {busy === "lookup" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            Retrieve &amp; import
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="online-topic">Check for newer publications</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="online-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. ESHRE ovarian stimulation guideline update"
            className="min-w-[16rem] flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSearch();
            }}
          />
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={busy !== null || topic.trim().length < 3}
            onClick={() => void onSearch()}
          >
            {busy === "search" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Check online
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestedTopics.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              className="rounded-lg border border-border/70 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {message ? <p className="text-[11px] text-muted-foreground">{message}</p> : null}

      {candidates.length > 0 && (
        <ul className="grid gap-2">
          {candidates.map((c) => (
            <li
              key={`${c.title}-${c.sourceUrl}`}
              className="rounded-xl border border-border/70 p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 font-medium">{c.title}</p>
                <Badge variant="outline" className="rounded-lg text-[10px] uppercase">
                  Unverified
                </Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {c.society}
                {c.year ? ` · ${c.year}` : ""}
                {c.reason ? ` · ${c.reason}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="rounded-lg" asChild>
                  <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" /> Open source
                  </a>
                </Button>
                <Button
                  size="sm"
                  className="rounded-lg"
                  onClick={() =>
                    importEntry({
                      title: c.title,
                      society: c.society,
                      year: c.year ?? undefined,
                      url: c.sourceUrl,
                      sourceKind: "Journal URL",
                    })
                  }
                >
                  <CloudDownload className="size-3.5" /> Import to library
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
