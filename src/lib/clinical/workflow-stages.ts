import {
  ClipboardPlus,
  Compass,
  Stethoscope,
  Syringe,
  Activity,
  Zap,
  ShieldCheck,
  FileText,
} from "lucide-react";

export interface WorkflowStage {
  stageNumber: number;
  label: string;
  shortLabel: string;
  to: string;
  description: string;
  icon: typeof ClipboardPlus;
}

export const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    stageNumber: 1,
    label: "Patient Assessment",
    shortLabel: "Assessment",
    to: "/assessment",
    description: "Demographics, history, ovarian reserve, ultrasound & cycles",
    icon: ClipboardPlus,
  },
  {
    stageNumber: 2,
    label: "POSEIDON & Phenotyping",
    shortLabel: "POSEIDON",
    to: "/poseidon",
    description: "POSEIDON Groups 1–4, Bologna criteria & reserve categorization",
    icon: Compass,
  },
  {
    stageNumber: 3,
    label: "Protocol Recommendation",
    shortLabel: "Protocol",
    to: "/protocols",
    description: "GnRH antagonist vs agonist selection per ESHRE 2025",
    icon: Stethoscope,
  },
  {
    stageNumber: 4,
    label: "Starting Dose & CONSORT",
    shortLabel: "Starting Dose",
    to: "/starting-dose",
    description: "CONSORT multivariable nomogram & ESHRE 300 IU ceiling",
    icon: Syringe,
  },
  {
    stageNumber: 5,
    label: "Monitoring & Dose Adjustment",
    shortLabel: "Monitoring",
    to: "/monitoring",
    description: "Folliculometry kinetics & Day 5/6 mid-cycle titration",
    icon: Activity,
  },
  {
    stageNumber: 6,
    label: "Trigger Decision & Safety",
    shortLabel: "Trigger",
    to: "/trigger",
    description: "Pre-ovulatory criteria & rhCG vs agonist vs dual trigger",
    icon: Zap,
  },
  {
    stageNumber: 7,
    label: "Cycle Completion & Safety",
    shortLabel: "Completion",
    to: "/cycle-completion",
    description: "OHSS risk stratification & fresh ET vs elective freeze-all",
    icon: ShieldCheck,
  },
  {
    stageNumber: 8,
    label: "Clinical Intelligence Report",
    shortLabel: "Report",
    to: "/reports",
    description: "16-section unified clinical intelligence synthesis & audit",
    icon: FileText,
  },
];
