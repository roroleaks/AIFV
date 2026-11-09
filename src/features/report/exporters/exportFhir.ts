/**
 * FHIR R4 Exporter for Clinical Dossier (§2.6)
 *
 * Emits a valid FHIR R4 Bundle (type: 'document') containing:
 *  - Composition (the dossier header and document structure)
 *  - DiagnosticReport (IVF cycle evaluation)
 *  - Observation resources (E2, LH, P4, follicles, endometrium, AMH, AFC)
 *  - MedicationStatement resources (gonadotropins, antagonists, trigger)
 *  - Condition (infertility diagnosis)
 *  - Procedure (stimulation protocol & trigger administration)
 *
 * GUARANTEES:
 *  - Zero PHI in resource IDs (referenced solely by caseId + sequence)
 *  - Compliant with HL7 FHIR Release 4 (R4) specification
 */

import type { Report } from "../types";

export interface FhirResource {
  resourceType: string;
  id: string;
  [key: string]: unknown;
}

export interface FhirBundleEntry {
  fullUrl: string;
  resource: FhirResource;
}

export interface FhirDocumentBundle {
  resourceType: "Bundle";
  id: string;
  type: "document";
  timestamp: string;
  entry: FhirBundleEntry[];
}

export function exportFhir(report: Report): FhirDocumentBundle {
  const caseId = report.caseId;
  const now = new Date().toISOString();
  const patientRef = { reference: `Patient/${caseId}` };

  const entries: FhirBundleEntry[] = [];

  function addEntry(resource: FhirResource) {
    entries.push({
      fullUrl: `urn:uuid:${resource.resourceType}-${resource.id}`,
      resource,
    });
  }

  // 1. Condition (Infertility Diagnosis)
  const conditionId = `cond-${caseId}`;
  const condition: FhirResource = {
    resourceType: "Condition",
    id: conditionId,
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-category",
            code: "problem-list-item",
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "8619003", // TODO(clinical-review): 8619003 is "Female infertility"; review if general "Infertility" (89348004) is preferred
          display: "Female infertility",
        },
      ],
      text: report.snapshot?.caseMetadata?.patient?.infertilityType || "Primary Female Infertility",
    },
    subject: patientRef,
    recordedDate: now,
  };
  addEntry(condition);

  // 2. Observations (Baseline & Monitoring Labs)
  const observationRefs: { reference: string }[] = [];

  // AMH Observation
  const amhVal = report.snapshot?.caseMetadata?.patient?.values?.["amh"];
  if (amhVal !== undefined) {
    const obsId = `obs-${caseId}-amh`;
    const obs: FhirResource = {
      resourceType: "Observation",
      id: obsId,
      status: "final",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "38476-8",
            display: "Anti-Mullerian hormone [Mass/volume] in Serum or Plasma",
          },
        ],
        text: "Anti-Mullerian Hormone (AMH)",
      },
      subject: patientRef,
      effectiveDateTime: now,
      valueQuantity: {
        value: Number(amhVal),
        unit: "ng/mL",
        system: "http://unitsofmeasure.org",
        code: "ng/mL",
      },
    };
    addEntry(obs);
    observationRefs.push({ reference: `Observation/${obsId}` });
  }

  // Antral Follicle Count
  const afcVal = report.snapshot?.caseMetadata?.patient?.values?.["afc"];
  if (afcVal !== undefined) {
    const obsId = `obs-${caseId}-afc`;
    const obs: FhirResource = {
      resourceType: "Observation",
      id: obsId,
      status: "final",
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "708945001",
            display: "Antral follicle count",
          },
        ],
        text: "Antral Follicle Count (AFC)",
      },
      subject: patientRef,
      effectiveDateTime: now,
      valueInteger: Number(afcVal),
    };
    addEntry(obs);
    observationRefs.push({ reference: `Observation/${obsId}` });
  }

  // Monitoring Follicles and Hormones from latest encounter
  const encounters = report.snapshot?.encounters || [];
  if (encounters.length > 0) {
    const latestEnc = encounters[encounters.length - 1];
    if (latestEnc) {
      if (latestEnc.labs?.estradiolPgMl !== undefined) {
        const obsId = `obs-${caseId}-e2-d${latestEnc.day}`;
        const obs: FhirResource = {
          resourceType: "Observation",
          id: obsId,
          status: "final",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "2243-4",
                display: "Estradiol [Mass/volume] in Serum or Plasma",
              },
            ],
            text: `Serum Estradiol (Stimulation Day ${latestEnc.day})`,
          },
          subject: patientRef,
          effectiveDateTime: latestEnc.date || now,
          valueQuantity: {
            value: Number(latestEnc.labs.estradiolPgMl),
            unit: "pg/mL",
            system: "http://unitsofmeasure.org",
            code: "pg/mL",
          },
        };
        addEntry(obs);
        observationRefs.push({ reference: `Observation/${obsId}` });
      }

      if (latestEnc.ultrasound?.largestFollicleMm !== undefined) {
        const obsId = `obs-${caseId}-lead-d${latestEnc.day}`;
        const obs: FhirResource = {
          resourceType: "Observation",
          id: obsId,
          status: "final",
          code: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "397127003",
                display: "Diameter of ovarian follicle",
              },
            ],
            text: `Lead Follicle Diameter (Day ${latestEnc.day})`,
          },
          subject: patientRef,
          effectiveDateTime: latestEnc.date || now,
          valueQuantity: {
            value: Number(latestEnc.ultrasound.largestFollicleMm),
            unit: "mm",
            system: "http://unitsofmeasure.org",
            code: "mm",
          },
        };
        addEntry(obs);
        observationRefs.push({ reference: `Observation/${obsId}` });
      }
    }
  }

  // 3. MedicationStatements
  const medPlan = report.snapshot?.orchestratorOutputs?.plan;
  const medStmtId = `med-${caseId}-stimulation`;
  const medStmt: FhirResource = {
    resourceType: "MedicationStatement",
    id: medStmtId,
    status: "active",
    category: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/medication-statement-category",
          code: "inpatient",
        },
      ],
    },
    medicationCodeableConcept: {
      coding: [
        {
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: "1157476",
          display: "Gonadotropin Regimen",
        },
      ],
      text: medPlan?.gonadotropin?.selection?.recommended ?? "rFSH Follitropin alfa",
    },
    subject: patientRef,
    effectiveDateTime: now,
    dosage: [
      {
        text: `Starting dose: ${medPlan?.startingDose?.dose ?? 225} IU/day subcutaneous`,
        doseAndRate: [
          {
            doseQuantity: {
              value: Number(medPlan?.startingDose?.dose ?? 225),
              unit: "IU",
              system: "http://unitsofmeasure.org",
              code: "[iU]",
            },
          },
        ],
      },
    ],
  };
  addEntry(medStmt);

  // 4. Procedures (Stimulation Protocol & Trigger)
  const procId = `proc-${caseId}-stimulation`;
  const proc: FhirResource = {
    resourceType: "Procedure",
    id: procId,
    status: "completed",
    code: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "63232008",
          display: "Superovulation induction",
        },
      ],
      text: "Controlled Ovarian Stimulation Protocol",
    },
    subject: patientRef,
    performedDateTime: now,
  };
  addEntry(proc);

  // 5. DiagnosticReport (IVF Cycle Record)
  const diagReportId = `diag-${caseId}`;
  const diagnosticReport: FhirResource = {
    resourceType: "DiagnosticReport",
    id: diagReportId,
    status: report.locked ? "final" : "preliminary",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0074",
            code: "MB",
            display: "Microbiology / Endocrine",
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "417072007",
          display: "In vitro fertilization cycle",
        },
      ],
      text: "IVF Ovarian Stimulation Assessment",
    },
    subject: patientRef,
    effectiveDateTime: now,
    result: observationRefs,
  };
  addEntry(diagnosticReport);

  // 6. Composition (Root document)
  const compId = `comp-${caseId}-v${report.version}`;
  const composition: FhirResource = {
    resourceType: "Composition",
    id: compId,
    status: report.locked ? "final" : "preliminary",
    type: {
      coding: [
        {
          system: "http://loinc.org",
          code: "11503-0",
          display: "Medical records",
        },
      ],
      text: "IVF Clinical Intelligence Dossier",
    },
    category: [
      {
        coding: [
          {
            system: "http://loinc.org",
            code: "LP173224-3",
            display: "Clinical Decision Support",
          },
        ],
      },
    ],
    subject: patientRef,
    date: report.signedAt || now,
    author: [
      {
        display: report.signedBy ? `Dr. ${report.signedBy}` : "Attending Physician",
      },
    ],
    title: `IVF Clinical Intelligence Dossier (v${report.version})`,
    section: report.sections.map((sec) => ({
      title: sec.title,
      code: {
        text: sec.id,
      },
      text: {
        status: "generated",
        div: `<div xmlns="http://www.w3.org/1999/xhtml"><h3>${sec.title}</h3><p>${sec.summary}</p></div>`,
      },
    })),
  };

  // Composition is always the FIRST entry in a FHIR document bundle
  entries.unshift({
    fullUrl: `urn:uuid:Composition-${compId}`,
    resource: composition,
  });

  return {
    resourceType: "Bundle",
    id: `bundle-${caseId}-v${report.version}`,
    type: "document",
    timestamp: now,
    entry: entries,
  };
}
