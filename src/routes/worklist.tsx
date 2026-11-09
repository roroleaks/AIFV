import { createFileRoute } from "@tanstack/react-router";
import { AppShellCase } from "@/components/case-shell/AppShellCase";

export const Route = createFileRoute("/worklist")({
  head: () => ({
    meta: [
      { title: "Clinical Worklist — AIVF Precision Hospital CDSS v3.1" },
      {
        name: "description",
        content:
          "Daily hospital fertility unit worklist for controlled ovarian stimulation cases, encounters, and evidence-based decision support.",
      },
    ],
  }),
  component: WorklistRoute,
});

function WorklistRoute() {
  return <AppShellCase />;
}
