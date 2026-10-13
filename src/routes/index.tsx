import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  Microscope,
  LineChart,
  BookMarked,
  Users,
  Sparkles,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IVF Precision — Evidence-Based IVF & ICSI Decision Support" },
      {
        name: "description",
        content:
          "A clinical decision support workspace helping fertility specialists plan individualized ovarian stimulation using evidence-based methodologies.",
      },
      { property: "og:title", content: "IVF Precision — IVF & ICSI Decision Support" },
      {
        property: "og:description",
        content:
          "Individualized ovarian stimulation planning for reproductive medicine specialists.",
      },
    ],
  }),
  component: Landing,
});

const pillars = [
  {
    icon: Microscope,
    title: "Structured Assessment",
    body: "An eight-step clinical intake covering history, laboratory, ultrasound and male factor data.",
  },
  {
    icon: LineChart,
    title: "Decision Workspace",
    body: "A dedicated surface for protocol planning, prepared for evidence-based methodology modules.",
  },
  {
    icon: BookMarked,
    title: "Evidence Library",
    body: "Guidelines, RCTs, meta-analyses and reviews organised for bedside reference.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 glass-panel">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3">
          <BrandMark />
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/evidence">Evidence Library</Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/dashboard">Open Workspace</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden surface-hero">
        <div className="mx-auto max-w-5xl px-5 py-24 text-center sm:py-32">
          <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
            <Sparkles className="size-3.5 text-primary" />
            For reproductive medicine specialists & IVF consultants
          </span>

          <h1 className="animate-rise mt-7 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
            IVF Precision
          </h1>

          <p className="animate-rise mx-auto mt-5 max-w-3xl text-lg font-medium text-foreground/80 sm:text-xl">
            Evidence-Based IVF &amp; ICSI Clinical Decision Support System
          </p>

          <p className="animate-rise mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Designed for fertility specialists to assist with individualized ovarian stimulation
            planning using internationally recognized evidence-based methodologies.
          </p>

          <div className="animate-rise mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-xl px-7 text-base shadow-soft">
              <Link to="/assessment">
                Start New Patient
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-xl bg-card px-7 text-base"
            >
              <Link to="/patients">
                <Users className="size-4" />
                Previous Patients
              </Link>
            </Button>
          </div>

          <p className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald" />
            Clinician-facing tool — no diagnostic output is generated in this release.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24">
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

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-7xl space-y-1 px-5 text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} IVF Ai Calc · Intended for use by qualified fertility
            specialists only.
          </p>
          <p className="text-[11px] tracking-wide">Created by Dr Raouf Roshdy</p>
        </div>
      </footer>
    </div>
  );
}
