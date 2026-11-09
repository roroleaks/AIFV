import { createFileRoute } from "@tanstack/react-router";
import { PatientMasterRecordView } from "./_shell.patients.$id";

export const Route = createFileRoute("/_shell/patient/$id")({
  head: () => ({
    meta: [
      { title: "Patient Master Record — AiFV Precision Hospital CDSS" },
      {
        name: "description",
        content:
          "Dedicated hospital master record: demographics, medical conditions, prior IVF cycles, signed consent documents, and immutable audit trail.",
      },
    ],
  }),
  component: PatientMasterRecordView,
});
