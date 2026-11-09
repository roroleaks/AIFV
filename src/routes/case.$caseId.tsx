import { createFileRoute } from "@tanstack/react-router";
import { AppShellCase } from "@/components/case-shell/AppShellCase";

export const Route = createFileRoute("/case/$caseId")({
  head: () => ({
    meta: [
      { title: "Patient Case — AIVF Precision Hospital CDSS v3.1" },
      {
        name: "description",
        content:
          "Individualized IVF stimulation case view: encounters timeline, protocol plan, report dossier, and real-time clinical firewalls.",
      },
    ],
  }),
  component: CaseRoute,
});

function CaseRoute() {
  const { caseId } = Route.useParams();
  return <AppShellCase caseId={caseId} />;
}
