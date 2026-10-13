import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Keyboard, Mail } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

export const Route = createFileRoute("/_shell/help")({
  head: () => ({
    meta: [
      { title: "Help & Support — IVF Ai Calc" },
      { name: "description", content: "Guidance, shortcuts and support for the workspace." },
      { property: "og:title", content: "Help & Support — IVF Ai Calc" },
      { property: "og:description", content: "Guidance, shortcuts and support for the workspace." },
    ],
  }),
  component: Help,
});

const shortcuts = [
  ["Tab / Shift+Tab", "Move between interactive elements"],
  ["Enter / Space", "Activate the focused control"],
  ["Esc", "Close dialogs and side panels"],
];

function Help() {
  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Help & Support"
        description="How the workspace is structured and how to reach us."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Getting started">
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <LifeBuoy className="mt-0.5 size-4 shrink-0 text-primary" />
              Begin from the landing page with <strong className="text-foreground">Start New Patient</strong>{" "}
              to open the eight-step assessment wizard.
            </li>
            <li className="flex gap-3">
              <LifeBuoy className="mt-0.5 size-4 shrink-0 text-primary" />
              Clinical calculations and recommendations are intentionally not implemented in this
              release.
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="Keyboard navigation" action={<Keyboard className="size-4 text-primary" />}>
          <dl className="space-y-3 text-sm">
            {shortcuts.map(([key, desc]) => (
              <div key={key} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                <dt className="shrink-0 rounded-lg border border-border/70 bg-muted px-2 py-1 text-xs font-medium">
                  {key}
                </dt>
                <dd className="text-muted-foreground">{desc}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard title="Contact" className="lg:col-span-2">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="size-4 text-primary" />
            Reach the clinical product team through your clinic administrator.
          </p>
        </SectionCard>
      </div>
    </>
  );
}
