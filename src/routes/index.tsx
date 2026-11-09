import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Microscope, LineChart, BookMarked, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { WORKFLOW_STAGES } from "@/lib/clinical/workflow-stages";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AiFV Precision — Hospital IVF Decision Support System" },
      {
        name: "description",
        content:
          "Encounter-based clinical decision support workspace helping fertility specialists plan individualized ovarian stimulation using evidence-based methodologies.",
      },
      { property: "og:title", content: "AiFV Precision — IVF & ICSI Decision Support" },
      {
        property: "og:description",
        content:
          "Individualized ovarian stimulation planning for reproductive medicine specialists.",
      },
      { property: "og:image", content: "/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-image.png" },
    ],
  }),
  component: Landing,
});

const pillars = [
  {
    icon: Microscope,
    title: "Case-Centric Hospital Workspace",
    body: "Longitudinal encounter tracking, persistent patient header, and automated POSEIDON & CONSORT calculation.",
  },
  {
    icon: LineChart,
    title: "Deterministic Engine Layer",
    body: "Pure headless clinical services strictly enforcing ESHRE 2025 starting dose ceilings and OHSS firewalls.",
  },
  {
    icon: BookMarked,
    title: "Evidence-Gated Reports",
    body: "16-section clinical dossiers with Vancouver-style citations and immutable sign-off workflow.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 glass-panel">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3">
          <BrandMark />
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild className="rounded-xl">
              <Link to="/worklist">Open Hospital Worklist</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden surface-hero">
        <div className="mx-auto max-w-5xl px-5 py-24 text-center sm:py-32">
          <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
            <Sparkles className="size-3.5 text-primary" />
            Hospital Fertility Unit · Daily Case Worklist &amp; Longitudinal Encounters
          </span>

          <h1 className="animate-rise mt-7 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
            AiFV Precision
          </h1>

          <p className="animate-rise mx-auto mt-5 max-w-3xl text-lg font-medium text-foreground/80 sm:text-xl">
            Case-Centric IVF Clinical Decision Support System (CDSS)
          </p>

          <p className="animate-rise mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Encounter-based hospital workflow designed for reproductive medicine specialists. Pure
            headless engines power real-time POSEIDON, CONSORT starting dose, follicular kinetics,
            and safety firewalls.
          </p>

          <div className="animate-rise mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl px-7 text-base shadow-soft font-semibold"
            >
              <Link to="/worklist">
                Open Clinical Worklist
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <p className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald" />
            Hospital-grade CDSS · Deterministic clinical calculation layer preserved byte-for-byte.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((p) => (
            <article
              key={p.title}
              className="card-lift rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <p.icon className="size-5" />
              </span>
              <h2 className="mt-5 text-lg font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24">
        <div className="mb-8 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
            Evidence-Gated Workflow
          </span>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
            8-Stage Clinical Decision Pipeline
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Specialized modular engine audits for reproductive endocrinology.
          </p>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_STAGES.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.stageNumber}
                to={s.to}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {s.stageNumber}
                    </span>
                    <Icon className="size-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    Stage {s.stageNumber}: {s.label}
                  </h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-80 group-hover:opacity-100 pt-3 border-t border-border/50">
                  <span>Open Stage {s.stageNumber}</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-3">
            <img
              src="/dr-raouf-roshdy.jpg"
              alt="Dr Raouf Roshdy"
              className="size-10 rounded-full object-cover ring-2 ring-primary/20 shadow-xs"
            />
            <div>
              <p className="font-semibold text-foreground tracking-tight">
                Created by Dr Raouf Roshdy
              </p>
              <p className="text-[11px] text-muted-foreground">All copyrights reserved 2026</p>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground sm:text-right">
            © 2026 AiFV Precision Decision Support · Intended for qualified fertility specialists
            only.
          </p>
        </div>
      </footer>
    </div>
  );
}
