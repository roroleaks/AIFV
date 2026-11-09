import { createFileRoute } from "@tanstack/react-router";
import { AppShellCase } from "@/components/case-shell/AppShellCase";

export const Route = createFileRoute("/case/$caseId")({
  head: () => ({
    meta: [
      { title: "Patient Case — AiFV Precision Hospital CDSS" },
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
