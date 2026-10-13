/**
 * Server-side helpers for the Update Evidence Center.
 *
 * These functions only RETRIEVE bibliographic metadata or candidate
 * references. They never interpret clinical content, never extract rules and
 * never activate anything. Every returned item enters the governance queue as
 * an unverified candidate that a physician must review.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface SourceMetadata {
  ok: boolean;
  title?: string;
  society?: string;
  year?: number;
  doi?: string;
  url: string;
  message: string;
}

export const fetchSourceMetadata = createServerFn({ method: "POST" })
  .inputValidator((data: { reference: string }) =>
    z.object({ reference: z.string().min(4).max(500) }).parse(data),
  )
  .handler(async ({ data }): Promise<SourceMetadata> => {
    const raw = data.reference.trim();
    const doiMatch = raw.match(/10\.\d{4,9}\/[^\s"<>]+/i);

    try {
      if (doiMatch) {
        const doi = doiMatch[0].replace(/[.,;)]+$/, "");
        const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          return {
            ok: false,
            url: raw,
            message: `Crossref returned ${res.status}. Enter the metadata manually.`,
          };
        }
        const body = (await res.json()) as {
          message?: {
            title?: string[];
            publisher?: string;
            "container-title"?: string[];
            issued?: { "date-parts"?: number[][] };
          };
        };
        const m = body.message ?? {};
        const year = m.issued?.["date-parts"]?.[0]?.[0];
        const result: SourceMetadata = {
          ok: true,
          url: `https://doi.org/${doi}`,
          doi,
          message:
            "Metadata retrieved from Crossref. Verify it against the publisher before accepting.",
        };
        if (m.title?.[0]) result.title = m.title[0];
        if (m["container-title"]?.[0] ?? m.publisher)
          result.society = m["container-title"]?.[0] ?? m.publisher!;
        if (typeof year === "number") result.year = year;
        return result;
      }

      const res = await fetch(raw, { redirect: "follow" });
      if (!res.ok) {
        return { ok: false, url: raw, message: `The source responded with ${res.status}.` };
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("pdf")) {
        return {
          ok: true,
          url: raw,
          message: "PDF reachable. Title and society must be entered manually — no text is parsed.",
        };
      }
      const html = (await res.text()).slice(0, 200_000);
      const title = html.match(/<title[^>]*>([^<]{3,300})<\/title>/i)?.[1]?.trim();
      const year = Number(html.match(/(?:19|20)\d{2}/)?.[0]);
      const result: SourceMetadata = {
        ok: true,
        url: raw,
        message: "Page reachable. Verify the retrieved title and add the missing fields manually.",
      };
      if (title) result.title = title;
      if (Number.isFinite(year)) result.year = year;
      return result;
    } catch (error) {
      return {
        ok: false,
        url: raw,
        message: `Could not reach the source: ${error instanceof Error ? error.message : "network error"}.`,
      };
    }
  });

export interface SearchCandidate {
  title: string;
  society: string;
  year: number | null;
  sourceUrl: string;
  reason: string;
}

export interface SearchResponse {
  available: boolean;
  candidates: SearchCandidate[];
  message: string;
}

/**
 * Assisted literature search. Returns CANDIDATE references only, always
 * unverified, never any clinical rule, threshold or dose.
 */
export const searchEvidenceCandidates = createServerFn({ method: "POST" })
  .inputValidator((data: { topic: string }) =>
    z.object({ topic: z.string().min(3).max(200) }).parse(data),
  )
  .handler(async ({ data }): Promise<SearchResponse> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      return {
        available: false,
        candidates: [],
        message: "Assisted search is NOT AVAILABLE in the current environment.",
      };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash",
        messages: [
          {
            role: "system",
            content:
              'You list candidate published guidelines and trials for reproductive medicine specialists. Return bibliographic references only: no clinical rules, thresholds, doses or recommendations. If you are not certain a reference exists, omit it. Respond as JSON: {"candidates":[{"title":"","society":"","year":0,"sourceUrl":"","reason":""}]}.',
          },
          { role: "user", content: `Topic: ${data.topic}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      return {
        available: false,
        candidates: [],
        message: `Assisted search unavailable (${res.status}). Use PDF upload or URL import instead.`,
      };
    }

    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let candidates: SearchCandidate[] = [];
    try {
      const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as {
        candidates?: SearchCandidate[];
      };
      candidates = (parsed.candidates ?? []).filter((c) => c.title && c.sourceUrl).slice(0, 10);
    } catch {
      candidates = [];
    }

    return {
      available: true,
      candidates,
      message:
        "Candidate references only — unverified. Each must be opened, verified against the publisher and reviewed by a physician before it enters the library.",
    };
  });
