import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Baby,
  CalendarClock,
  FolderOpen,

  ClipboardList,
  Dna,

  FlaskConical,
  HeartPulse,
  History,
  Mars,
  ScanLine,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi"
  | "bool"
  | "textarea"
  | "derived";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  /** derived fields are computed and read-only */
  compute?: (values: Record<string, unknown>) => string;
  /** excluded from completion percentage */
  optional?: boolean;
  colSpan?: 1 | 2 | 3;
  /** conditional visibility based on other answers */
  showIf?: (values: Record<string, unknown>) => boolean;
}

export interface GroupDef {
  title: string;
  description?: string;
  fields: FieldDef[];
  /** conditional visibility based on other answers */
  showIf?: (values: Record<string, unknown>) => boolean;
  /** rendered as a highlighted expandable clinical sub-section */
  conditional?: boolean;
}

export interface StepDef {
  id: string;
  title: string;
  short: string;
  description: string;
  icon: LucideIcon;
  groups: GroupDef[];
  /** custom step rendered by a dedicated component */
  custom?: "cycles" | "review" | "documents" | "timeline";
}

const hasCause = (name: string) => (v: Record<string, unknown>) =>
  Array.isArray(v["causes"]) && (v["causes"] as string[]).includes(name);


const YES_NO = ["Yes", "No", "Unknown"];

function num(values: Record<string, unknown>, key: string): number | null {
  const raw = values[key];
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export const ageFromDob = (dob: unknown): string => {
  if (typeof dob !== "string" || !dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  if (age < 0 || age > 120) return "";
  return `${age} years`;
};

export const steps: StepDef[] = [
  {
    id: "patient",
    title: "Patient Information",
    short: "Patient",
    description: "Demographics, anthropometrics and lifestyle baseline.",
    icon: UserRound,
    groups: [
      {
        title: "Identification",
        fields: [
          { key: "patientId", label: "Patient ID", type: "text", placeholder: "IVF-000123" },
          { key: "fullName", label: "Full Name", type: "text", placeholder: "Patient full name" },
          { key: "dob", label: "Date of Birth", type: "date" },
          {
            key: "age",
            label: "Age",
            type: "derived",
            hint: "Auto-calculated",
            compute: (v) => ageFromDob(v["dob"]),
          },
          { key: "nationality", label: "Nationality", type: "text", placeholder: "Nationality" },
          {
            key: "ethnicity",
            label: "Ethnicity",
            type: "select",
            options: [
              "Caucasian",
              "Middle Eastern / North African",
              "South Asian",
              "East Asian",
              "African / Black",
              "Hispanic / Latino",
              "Mixed",
              "Other",
            ],
          },
          { key: "occupation", label: "Occupation", type: "text", placeholder: "Occupation" },
          { key: "bloodGroup", label: "Blood Group", type: "select", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
        ],
      },
      {
        title: "Anthropometrics",
        fields: [
          { key: "height", label: "Height", type: "number", unit: "cm", min: 100, max: 220, step: 0.5 },
          { key: "weight", label: "Weight", type: "number", unit: "kg", min: 25, max: 250, step: 0.1 },
          {
            key: "bmi",
            label: "BMI",
            type: "derived",
            hint: "Auto-calculated",
            compute: (v) => {
              const h = num(v, "height");
              const w = num(v, "weight");
              if (!h || !w) return "";
              const bmi = w / (h / 100) ** 2;
              if (!Number.isFinite(bmi) || bmi <= 0) return "";
              return `${bmi.toFixed(1)} kg/m²`;
            },
          },
        ],
      },
      {
        title: "Lifestyle",
        fields: [
          { key: "smoking", label: "Smoking", type: "select", options: ["Never", "Former", "Current — light", "Current — heavy"] },
          { key: "alcohol", label: "Alcohol", type: "select", options: ["None", "Occasional", "Weekly", "Daily"] },
          { key: "exercise", label: "Exercise", type: "select", options: ["Sedentary", "Light", "Moderate", "Intense"] },
        ],
      },
      {
        title: "Relationship & Infertility",
        fields: [
          { key: "maritalStatus", label: "Marital Status", type: "select", options: ["Married", "Partnered", "Single", "Other"] },
          { key: "partnerAge", label: "Partner Age", type: "number", unit: "years", min: 16, max: 90 },
          { key: "infertilityDuration", label: "Duration of Infertility", type: "number", unit: "months", min: 0, max: 500 },
          { key: "infertilityType", label: "Infertility Type", type: "select", options: ["Primary", "Secondary"] },
        ],
      },
    ],
  },
  {
    id: "reproductive",
    title: "Reproductive History",
    short: "Reproductive",
    description: "Obstetric background and prior assisted reproduction pregnancies.",
    icon: Baby,
    groups: [
      {
        title: "Obstetric Counts",
        fields: [
          { key: "gravidity", label: "Gravidity", type: "number", min: 0, max: 30 },
          { key: "parity", label: "Parity", type: "number", min: 0, max: 30 },
          { key: "abortions", label: "Abortions", type: "number", min: 0, max: 30 },
          { key: "ectopic", label: "Ectopic Pregnancy", type: "number", min: 0, max: 20 },
          { key: "liveBirth", label: "Live Birth", type: "number", min: 0, max: 20 },
          { key: "miscarriages", label: "Previous Miscarriages", type: "number", min: 0, max: 20 },
          { key: "stillbirth", label: "Previous Stillbirth", type: "number", min: 0, max: 20 },
        ],
      },
      {
        title: "Delivery History",
        fields: [
          { key: "cesarean", label: "Previous Cesarean", type: "number", min: 0, max: 10 },
          { key: "vaginalDelivery", label: "Previous Vaginal Delivery", type: "number", min: 0, max: 15 },
        ],
      },
      {
        title: "ART & Events",
        fields: [
          { key: "prevIvfPregnancy", label: "Previous IVF Pregnancy", type: "select", options: YES_NO },
          { key: "prevIcsiPregnancy", label: "Previous ICSI Pregnancy", type: "select", options: YES_NO },
          { key: "twins", label: "History of Twins", type: "select", options: YES_NO },
          { key: "ohssHistory", label: "History of OHSS", type: "select", options: ["No", "Mild", "Moderate", "Severe", "Unknown"] },
        ],
      },
    ],
  },
  {
    id: "cause",
    title: "Cause of Infertility",
    short: "Cause",
    description: "Select every documented contributing factor.",
    icon: ClipboardList,
    groups: [
      {
        title: "Documented Factors",
        description: "Multiple selections allowed",
        fields: [
          {
            key: "causes",
            label: "Cause of Infertility",
            type: "multi",
            colSpan: 3,
            options: [
              "Tubal",
              "Male Factor",
              "PCOS",
              "Endometriosis",
              "Diminished Ovarian Reserve",
              "Unexplained",
              "Ovulatory Disorder",
              "Advanced Maternal Age",
              "Uterine Factor",
              "Fibroids",
              "Adenomyosis",
              "Hydrosalpinx",
              "Genetic",
              "Immunological",
              "Recurrent Implantation Failure",
              "Recurrent Pregnancy Loss",
              "Other",
            ],
          },
          {
            key: "causeNotes",
            label: "Additional notes",
            type: "textarea",
            colSpan: 3,
            optional: true,
            placeholder: "Free-text clinical context (optional)",
          },
        ],
      },
      {
        title: "PCOS — Rotterdam Criteria",
        description: "Expanded because PCOS is selected as a contributing factor",
        conditional: true,
        showIf: hasCause("PCOS"),
        fields: [
          { key: "pcosHyperandrogenism", label: "Hyperandrogenism", type: "select", options: ["Clinical", "Biochemical", "Both", "Absent", "Unknown"] },
          { key: "pcosMorphology", label: "Polycystic Ovaries", type: "select", options: ["Unilateral", "Bilateral", "Absent", "Unknown"] },
          { key: "pcosOvulatory", label: "Ovulatory Dysfunction", type: "select", options: ["Oligo-ovulation", "Anovulation", "Absent", "Unknown"] },
          { key: "pcosPreviousOhss", label: "Previous OHSS", type: "select", options: ["No", "Mild", "Moderate", "Severe", "Unknown"] },
          { key: "pcosMetformin", label: "Metformin Use", type: "select", options: YES_NO },
          { key: "pcosPhenotype", label: "Documented Phenotype", type: "select", optional: true, options: ["A", "B", "C", "D", "Not documented"] },
        ],
      },
      {
        title: "Endometriosis Detail",
        description: "Expanded because endometriosis is selected as a contributing factor",
        conditional: true,
        showIf: hasCause("Endometriosis"),
        fields: [
          { key: "endoStage", label: "rASRM Stage", type: "select", options: ["Stage I", "Stage II", "Stage III", "Stage IV", "Unknown"] },
          { key: "endoEndometrioma", label: "Endometrioma", type: "select", options: ["None", "Right", "Left", "Bilateral"] },
          { key: "endoSurgery", label: "Previous Surgery", type: "select", options: ["None", "Once", "Twice", "More than twice"] },
          { key: "endoPainScore", label: "Pain Score", type: "number", unit: "/10", min: 0, max: 10 },
          { key: "endoDeep", label: "Deep Infiltrating Disease", type: "select", options: YES_NO },
          { key: "endoPreviousIvf", label: "Previous IVF for Endometriosis", type: "select", options: YES_NO },
        ],
      },
      {
        title: "Recurrent Pregnancy Loss Workup",
        description: "Expanded because recurrent pregnancy loss is selected",
        conditional: true,
        showIf: hasCause("Recurrent Pregnancy Loss"),
        fields: [
          { key: "rplAps", label: "Antiphospholipid Syndrome", type: "select", options: ["Not tested", "Negative", "Positive"] },
          { key: "rplThrombophilia", label: "Thrombophilia Screen", type: "select", options: ["Not tested", "Negative", "Positive"] },
          { key: "rplGenetics", label: "Parental Genetics", type: "select", options: ["Not tested", "Normal", "Abnormal"] },
          { key: "rplImmune", label: "Immune Testing", type: "select", options: ["Not tested", "Normal", "Abnormal"] },
          { key: "rplLossCount", label: "Documented Losses", type: "number", min: 0, max: 20 },
        ],
      },
    ],

  },
  {
    id: "medical",
    title: "Medical History",
    short: "Medical",
    description: "Comorbidities, oncologic history, surgeries and medications.",
    icon: Stethoscope,
    groups: [
      {
        title: "Comorbidities",
        fields: [
          { key: "hypertension", label: "Hypertension", type: "select", options: YES_NO },
          { key: "diabetes", label: "Diabetes", type: "select", options: ["No", "Type 1", "Type 2", "Gestational", "Unknown"] },
          { key: "thyroid", label: "Thyroid Disease", type: "select", options: ["No", "Hypothyroid", "Hyperthyroid", "Autoimmune", "Unknown"] },
          { key: "hyperprolactinemia", label: "Hyperprolactinemia", type: "select", options: YES_NO },
          { key: "autoimmune", label: "Autoimmune Disease", type: "select", options: YES_NO },
          { key: "thrombophilia", label: "Thrombophilia", type: "select", options: YES_NO },
          { key: "thromboembolic", label: "Thromboembolic History", type: "select", options: ["No", "Deep vein thrombosis", "Pulmonary embolism", "Both", "Unknown"] },
          { key: "cardiovascular", label: "Cardiovascular Disease", type: "select", options: YES_NO },
          { key: "renalDisease", label: "Renal Disease", type: "select", options: YES_NO },
          { key: "liverDisease", label: "Liver Disease", type: "select", options: YES_NO },
          { key: "neurologicalDisease", label: "Neurological Disease", type: "select", options: YES_NO },
          { key: "geneticDiseaseHistory", label: "Relevant Genetic Disease", type: "select", options: YES_NO },
          { key: "otherMedicalConditions", label: "Other Major Medical Conditions", type: "textarea", colSpan: 3, optional: true, placeholder: "Any other major medical condition" },
        ],
      },
      {
        title: "Oncologic History",
        fields: [
          { key: "cancer", label: "Previous Malignancy", type: "select", options: YES_NO },
          { key: "cancerDetail", label: "Malignancy Detail", type: "text", optional: true, placeholder: "Site, year, treatment" },
          { key: "chemotherapy", label: "Previous Chemotherapy", type: "select", options: YES_NO },
          { key: "radiotherapy", label: "Previous Radiotherapy", type: "select", options: YES_NO },
        ],
      },
      {
        title: "Surgical History",
        fields: [
          { key: "ovarianSurgery", label: "Previous Ovarian Surgery", type: "select", options: YES_NO },
          { key: "tubalSurgery", label: "Previous Tubal Surgery", type: "select", options: YES_NO },
          { key: "endometriosisSurgery", label: "Endometriosis Surgery", type: "select", options: YES_NO },
          { key: "myomectomy", label: "Myomectomy", type: "select", options: YES_NO },
          { key: "uterineSurgery", label: "Other Uterine Surgery", type: "select", options: YES_NO },
          { key: "cesareanSection", label: "Previous Cesarean Section", type: "select", options: YES_NO },
          { key: "otherPelvicSurgery", label: "Other Pelvic Surgery", type: "textarea", colSpan: 3, optional: true, placeholder: "Describe any other pelvic surgery" },
          { key: "bariatric", label: "Bariatric Surgery", type: "select", options: YES_NO },
        ],
      },
      {
        title: "Medications & Allergy",
        fields: [
          { key: "drugAllergy", label: "Drug Allergy", type: "textarea", colSpan: 3, placeholder: "List known drug allergies" },
          { key: "currentMedications", label: "Current Medications", type: "textarea", colSpan: 3, placeholder: "List current medications with dose" },
        ],
      },
      {
        title: "Fertility Medication History",
        description: "Recorded exactly as documented — no dose is generated by the application.",
        fields: [
          { key: "previousFertilityMedication", label: "Previous Fertility Medication", type: "textarea", colSpan: 3, placeholder: "Medication(s) used outside IVF cycles" },
          { key: "ivfCycleMedication", label: "Medication Used in Previous IVF Cycles", type: "textarea", colSpan: 3, placeholder: "As documented in previous cycle records" },
          { key: "fertilityMedicationDose", label: "Dose", type: "text", placeholder: "e.g. 225 IU/day" },
          { key: "fertilityMedicationRoute", label: "Route", type: "select", options: ["Subcutaneous", "Intramuscular", "Oral", "Vaginal", "Transdermal", "Other"] },
          { key: "fertilityMedicationDuration", label: "Duration", type: "text", placeholder: "e.g. 10 days" },
          { key: "fertilityMedicationReason", label: "Reason for Use", type: "text", placeholder: "Documented indication" },
        ],
      },
    ],
  },
  {
    id: "gynecological",
    title: "Gynecological History",
    short: "Gynecology",
    description: "Menstrual pattern, pelvic pathology and prior procedures.",
    icon: HeartPulse,
    groups: [
      {
        title: "Menstrual Pattern",
        fields: [
          { key: "menarche", label: "Age at Menarche", type: "number", unit: "years", min: 8, max: 22 },
          { key: "cycleLength", label: "Cycle Length", type: "number", unit: "days", min: 15, max: 90 },
          { key: "ovulationHistory", label: "Ovulation History", type: "select", options: ["Ovulatory", "Oligo-ovulation", "Anovulation", "Not assessed", "Unknown"] },
          { key: "cycleRegularity", label: "Cycle Regularity", type: "select", options: ["Regular", "Irregular"] },
          { key: "lmp", label: "LMP", type: "date" },
          { key: "menstrualPain", label: "Menstrual Pain", type: "select", options: ["None", "Mild", "Moderate", "Severe"] },
          { key: "heavyBleeding", label: "Heavy Bleeding", type: "select", options: YES_NO },
        ],
      },
      {
        title: "Previous Procedures",
        fields: [
          { key: "hysteroscopy", label: "Previous Hysteroscopy", type: "select", options: YES_NO },
          { key: "laparoscopy", label: "Previous Laparoscopy", type: "select", options: YES_NO },
          { key: "cervicalSurgery", label: "Cervical Surgery", type: "select", options: YES_NO },
        ],
      },
      {
        title: "Pelvic Pathology",
        fields: [
          { key: "gynFibroids", label: "Fibroids", type: "select", options: ["None", "Subserosal", "Intramural", "Submucosal", "Multiple"] },
          { key: "gynPolyps", label: "Polyps", type: "select", options: YES_NO },
          { key: "gynAdenomyosis", label: "Adenomyosis", type: "select", options: YES_NO },
          { key: "endometriosisStage", label: "Endometriosis Stage", type: "select", options: ["None", "Stage I", "Stage II", "Stage III", "Stage IV", "Unknown"] },
          { key: "gynHydrosalpinx", label: "Hydrosalpinx", type: "select", options: ["None", "Unilateral", "Bilateral", "Unknown"] },
        ],
      },
    ],
  },
  {
    id: "reserve",
    title: "Ovarian Reserve",
    short: "Reserve",
    description: "Hormonal and metabolic laboratory values.",
    icon: FlaskConical,
    groups: [
      {
        title: "Reserve Markers",
        fields: [
          { key: "amh", label: "AMH", type: "number", unit: "ng/mL", min: 0, max: 50, step: 0.01 },
          { key: "afcLeft", label: "AFC Left", type: "number", unit: "follicles", min: 0, max: 60 },
          { key: "afcRight", label: "AFC Right", type: "number", unit: "follicles", min: 0, max: 60 },
          {
            key: "afcTotal",
            label: "Total AFC",
            type: "derived",
            hint: "Auto-summed",
            compute: (v) => {
              const l = num(v, "afcLeft");
              const r = num(v, "afcRight");
              if (l === null && r === null) return "";
              return `${(l ?? 0) + (r ?? 0)} follicles`;
            },
          },
        ],
      },
      {
        title: "Hormonal Profile",
        fields: [
          { key: "fsh", label: "FSH", type: "number", unit: "IU/L", min: 0, max: 200, step: 0.1 },
          { key: "lh", label: "LH", type: "number", unit: "IU/L", min: 0, max: 200, step: 0.1 },
          { key: "estradiol", label: "Estradiol", type: "number", unit: "pg/mL", min: 0, max: 5000, step: 1 },
          { key: "progesterone", label: "Progesterone", type: "number", unit: "ng/mL", min: 0, max: 100, step: 0.01 },
          { key: "inhibinB", label: "Inhibin B", type: "number", unit: "pg/mL", min: 0, max: 1000, step: 1 },
          { key: "testosterone", label: "Testosterone", type: "number", unit: "ng/dL", min: 0, max: 500, step: 0.1 },
          { key: "dheas", label: "DHEAS", type: "number", unit: "µg/dL", min: 0, max: 1500, step: 1 },
          { key: "prolactin", label: "Prolactin", type: "number", unit: "ng/mL", min: 0, max: 500, step: 0.1 },
          { key: "shbg", label: "SHBG", type: "number", unit: "nmol/L", min: 0, max: 400, step: 0.1, optional: true },
          { key: "otherEndocrine", label: "Other Endocrine Investigations", type: "textarea", colSpan: 3, optional: true, placeholder: "Additional endocrine results, displayed as information only" },
          { key: "tsh", label: "TSH", type: "number", unit: "mIU/L", min: 0, max: 100, step: 0.01 },
        ],
      },
      {
        title: "Metabolic",
        fields: [
          { key: "vitaminD", label: "Vitamin D", type: "number", unit: "ng/mL", min: 0, max: 200, step: 0.1 },
          { key: "hba1c", label: "HbA1c", type: "number", unit: "%", min: 2, max: 20, step: 0.1 },
        ],
      },
    ],
  },
  {
    id: "ultrasound",
    title: "Ultrasound",
    short: "Ultrasound",
    description: "Baseline pelvic ultrasound findings.",
    icon: ScanLine,
    groups: [
      {
        title: "Ovaries",
        fields: [
          { key: "ovarianVolumeRight", label: "Right Ovary Volume", type: "number", unit: "mL", min: 0, max: 100, step: 0.1 },
          { key: "ovarianVolumeLeft", label: "Left Ovary Volume", type: "number", unit: "mL", min: 0, max: 100, step: 0.1 },
          { key: "rightOvary", label: "Right Ovary", type: "select", options: ["Normal", "Polycystic morphology", "Endometrioma", "Cyst", "Not visualised", "Absent"] },
          { key: "leftOvary", label: "Left Ovary", type: "select", options: ["Normal", "Polycystic morphology", "Endometrioma", "Cyst", "Not visualised", "Absent"] },
          { key: "dominantFollicle", label: "Dominant Follicle", type: "number", unit: "mm", min: 0, max: 40, step: 0.1 },
          { key: "usEndometrioma", label: "Endometrioma", type: "select", options: ["None", "Right", "Left", "Bilateral"] },
          { key: "ovarianCysts", label: "Ovarian Cysts", type: "select", options: ["None", "Right", "Left", "Bilateral", "Unknown"] },
          { key: "ovarianCystSize", label: "Largest Cyst Diameter", type: "number", unit: "mm", min: 0, max: 250, step: 0.1, optional: true },
        ],
      },
      {
        title: "Uterus & Endometrium",
        fields: [
          { key: "endometrium", label: "Endometrium Thickness", type: "number", unit: "mm", min: 0, max: 40, step: 0.1 },
          { key: "endometrialPattern", label: "Pattern", type: "select", options: ["Trilaminar", "Homogeneous", "Hyperechoic", "Irregular"] },
          { key: "uterineAbnormalities", label: "Uterine Abnormalities", type: "select", options: ["None", "Septate", "Bicornuate", "Unicornuate", "Arcuate", "Didelphys", "Other"] },
          { key: "usFibroids", label: "Fibroids", type: "select", options: ["None", "Subserosal", "Intramural", "Submucosal", "Multiple"] },
          { key: "usPolyps", label: "Polyps", type: "select", options: YES_NO },
          { key: "usAdenomyosis", label: "Adenomyosis", type: "select", options: YES_NO },
          { key: "usHydrosalpinx", label: "Hydrosalpinx", type: "select", options: ["None", "Unilateral", "Bilateral"] },
          { key: "otherPelvicFindings", label: "Other Pelvic Findings", type: "textarea", colSpan: 3, optional: true, placeholder: "Any other relevant ultrasound finding" },
          { key: "usFibroidSize", label: "Largest Fibroid Diameter", type: "number", unit: "mm", min: 0, max: 300, step: 0.1, optional: true },
        ],
      },
    ],
  },
  {
    id: "male",
    title: "Male Factor",
    short: "Male Factor",
    description: "Semen analysis and andrology history.",
    icon: Mars,
    groups: [
      {
        title: "Semen Analysis",
        fields: [
          { key: "semenVolume", label: "Semen Volume", type: "number", unit: "mL", min: 0, max: 20, step: 0.1 },
          { key: "concentration", label: "Concentration", type: "number", unit: "M/mL", min: 0, max: 500, step: 0.1 },
          { key: "progressiveMotility", label: "Progressive Motility", type: "number", unit: "%", min: 0, max: 100, step: 1 },
          { key: "totalMotility", label: "Total Motility", type: "number", unit: "%", min: 0, max: 100, step: 1 },
          { key: "morphology", label: "Morphology", type: "number", unit: "% normal", min: 0, max: 100, step: 0.1 },
          { key: "dnaFragmentation", label: "DNA Fragmentation", type: "number", unit: "%", min: 0, max: 100, step: 0.1 },
        ],
      },
      {
        title: "Andrology History",
        fields: [
          { key: "previousTese", label: "Previous TESE", type: "select", options: YES_NO },
          { key: "azoospermia", label: "Azoospermia", type: "select", options: ["No", "Obstructive", "Non-obstructive", "Unknown"] },
          { key: "varicocele", label: "Varicocele", type: "select", options: ["No", "Grade I", "Grade II", "Grade III", "Repaired"] },
          { key: "cryopreservation", label: "Previous Cryopreservation", type: "select", options: YES_NO },
        ],
      },
      {
        title: "Expanded Male Assessment",
        description: "Expanded because male factor is selected as a contributing factor",
        conditional: true,
        showIf: hasCause("Male Factor"),
        fields: [
          { key: "whoReference", label: "WHO Semen Analysis Edition", type: "select", options: ["WHO 6th (2021)", "WHO 5th (2010)", "Other / not stated"] },
          { key: "whoOverall", label: "WHO Classification Recorded", type: "select", options: ["Normozoospermia", "Oligozoospermia", "Asthenozoospermia", "Teratozoospermia", "Oligoasthenoteratozoospermia", "Azoospermia", "Cryptozoospermia"] },
          { key: "dfiMethod", label: "DNA Fragmentation Method", type: "select", optional: true, options: ["SCSA", "TUNEL", "Comet", "SCD / Halo", "Not done"] },
          { key: "maleTese", label: "TESE", type: "select", options: ["Not done", "Planned", "Performed — sperm found", "Performed — no sperm"] },
          { key: "malePesa", label: "PESA", type: "select", options: ["Not done", "Planned", "Performed — sperm found", "Performed — no sperm"] },
          { key: "maleMicroTese", label: "MicroTESE", type: "select", options: ["Not done", "Planned", "Performed — sperm found", "Performed — no sperm"] },
          { key: "maleCryoSample", label: "Cryopreserved Sample Available", type: "select", options: YES_NO },
          { key: "malePreviousFertility", label: "Previous Fertility (any partner)", type: "select", options: YES_NO },
          { key: "maleNotes", label: "Andrology notes", type: "textarea", colSpan: 3, optional: true, placeholder: "Free-text andrology context (optional)" },
        ],
      },
    ],

  },
  {
    id: "cycles",
    title: "Previous IVF / ICSI Cycles",
    short: "Cycles",
    description: "Add one expandable card per previous cycle. Unlimited entries.",
    icon: History,
    custom: "cycles",
    groups: [],
  },
  {
    id: "genetics",
    title: "Genetics",
    short: "Genetics",
    description: "Screening, karyotype and preimplantation testing history.",
    icon: Dna,
    groups: [
      {
        title: "Screening",
        fields: [
          { key: "carrierScreening", label: "Carrier Screening", type: "select", options: ["Not done", "Negative", "Carrier — female", "Carrier — male", "Both carriers"] },
          { key: "karyotype", label: "Karyotype", type: "select", options: ["Not done", "Normal both partners", "Abnormal — female", "Abnormal — male", "Abnormal — both"] },
          { key: "knownGeneticDisease", label: "Known Genetic Disease", type: "textarea", colSpan: 3, optional: true, placeholder: "Specify condition, inheritance pattern" },
        ],
      },
      {
        title: "Preimplantation Testing",
        fields: [
          { key: "pgtA", label: "PGT-A", type: "select", options: ["Not done", "Planned", "Previously performed"] },
          { key: "pgtM", label: "PGT-M", type: "select", options: ["Not done", "Planned", "Previously performed"] },
          { key: "pgtSR", label: "PGT-SR", type: "select", options: ["Not done", "Planned", "Previously performed"] },
        ],
      },
    ],
  },
  {
    id: "preferences",
    title: "Patient Preferences",
    short: "Preferences",
    description: "Documented patient choices and constraints.",
    icon: Sparkles,
    groups: [
      {
        title: "Treatment Preferences",
        fields: [
          { key: "budget", label: "Budget", type: "select", options: ["Limited", "Moderate", "Flexible", "Not disclosed"] },
          { key: "preferredMedication", label: "Preferred Medication", type: "text", placeholder: "As documented by patient" },
          { key: "freshTransfer", label: "Fresh Transfer Preference", type: "select", options: ["Preferred", "Neutral", "Declined"] },
          { key: "freezeAll", label: "Freeze-All Preference", type: "select", options: ["Preferred", "Neutral", "Declined"] },
        ],
      },
      {
        title: "Consent & Openness",
        fields: [
          { key: "donorEggs", label: "Accept Donor Eggs", type: "select", options: YES_NO },
          { key: "donorSperm", label: "Accept Donor Sperm", type: "select", options: YES_NO },
          { key: "acceptPgt", label: "Accept PGT", type: "select", options: YES_NO },
          { key: "preferredClinic", label: "Preferred Clinic", type: "text", placeholder: "Clinic name" },
        ],
      },
    ],
  },
  {
    id: "documents",
    title: "Document Center",
    short: "Documents",
    description: "Attach imaging, laboratory and operative documentation to this assessment.",
    icon: FolderOpen,
    custom: "documents",
    groups: [],
  },
  {
    id: "timeline",
    title: "Reproductive Timeline",
    short: "Timeline",
    description: "Chronological view of every documented reproductive event.",
    icon: CalendarClock,
    custom: "timeline",
    groups: [],
  },
  {
    id: "review",
    title: "Review",
    short: "Review",
    description: "Clinical summary of all captured data. No calculations performed.",
    icon: Activity,
    custom: "review",
    groups: [],
  },
];

export const cycleFields: FieldDef[] = [
  { key: "cycleNumber", label: "Cycle Number", type: "number", min: 1, max: 40 },
  { key: "cycleYear", label: "Year", type: "number", min: 1980, max: 2100 },
  { key: "cycleDate", label: "Cycle Date", type: "date" },
  { key: "cycleIndication", label: "Indication", type: "text", placeholder: "Documented indication for the cycle" },
  { key: "cycleType", label: "Cycle Type", type: "select", options: ["IVF", "ICSI", "IVF + ICSI", "IUI", "Frozen transfer only"] },
  { key: "clinic", label: "Clinic", type: "text" },
  { key: "ageAtCycle", label: "Age at Cycle", type: "number", unit: "years", min: 15, max: 60 },
  { key: "amhAtCycle", label: "AMH at Cycle", type: "number", unit: "ng/mL", min: 0, max: 50, step: 0.01 },
  { key: "afcAtCycle", label: "AFC at Cycle", type: "number", unit: "follicles", min: 0, max: 100 },
  { key: "protocol", label: "Protocol", type: "select", options: ["Long agonist", "Short agonist", "Antagonist", "Mild / Mini", "Natural", "Duostim", "Other"] },
  { key: "gonadotropinType", label: "Gonadotropin Type", type: "select", options: ["Recombinant FSH", "Urinary FSH", "hMG", "Recombinant FSH + hMG", "Recombinant FSH + LH", "Corifollitropin alfa", "Other"] },
  { key: "medication", label: "Gonadotropin Brand / Name", type: "text" },
  { key: "startingDose", label: "Starting Dose", type: "number", unit: "IU/day" },
  { key: "maxDose", label: "Maximum Dose", type: "number", unit: "IU/day" },
  { key: "doseChanges", label: "Dose Changes", type: "text", placeholder: "e.g. increased to 300 IU on day 6" },
  { key: "totalDose", label: "Total Gonadotropin Exposure", type: "number", unit: "IU" },
  { key: "duration", label: "Duration of Stimulation", type: "number", unit: "days" },
  { key: "gnrhAnalogue", label: "GnRH Analogue", type: "select", options: ["Antagonist", "Agonist — long", "Agonist — short", "None", "Other"] },
  { key: "gnrhDetails", label: "GnRH Analogue Detail", type: "text", optional: true, placeholder: "Drug, dose, start day" },
  { key: "trigger", label: "Trigger Medication", type: "select", options: ["hCG", "GnRH agonist", "Dual trigger", "Other"] },
  { key: "triggerTiming", label: "Trigger Timing", type: "text", placeholder: "e.g. stimulation day 10" },
  { key: "peakE2", label: "Peak Estradiol", type: "number", unit: "pg/mL", min: 0, max: 30000 },
  { key: "cycleLh", label: "LH at Trigger", type: "number", unit: "IU/L", min: 0, max: 200, step: 0.1 },
  { key: "cycleProgesterone", label: "Progesterone at Trigger", type: "number", unit: "ng/mL", min: 0, max: 100, step: 0.01 },
  { key: "folliclesTotal", label: "Number of Follicles", type: "number", min: 0, max: 100 },
  { key: "follicles17", label: "Follicles ≥ 17 mm", type: "number", min: 0, max: 100 },
  { key: "follicles14", label: "Follicles ≥ 14 mm", type: "number", min: 0, max: 100 },
  { key: "retrieved", label: "Retrieved Oocytes", type: "number" },
  { key: "mii", label: "MII", type: "number" },
  { key: "fertilized", label: "Fertilized", type: "number" },
  {
    key: "fertilizationRate",
    label: "Fertilization Rate",
    type: "derived",
    hint: "Auto-calculated",
    compute: (v) => {
      const f = Number(v["fertilized"]);
      const m = Number(v["mii"]);
      if (!Number.isFinite(f) || !Number.isFinite(m) || !m) return "";
      return `${Math.round((f / m) * 100)}%`;
    },
  },
  { key: "twoPn", label: "2PN", type: "number" },
  { key: "day3", label: "Day 3 Embryos", type: "number" },
  { key: "blastocysts", label: "Blastocysts", type: "number" },
  { key: "embryoGrades", label: "Embryo Grades", type: "text", placeholder: "e.g. 2× 4AA, 1× 4BB" },
  { key: "transferred", label: "Embryos Transferred", type: "number" },
  { key: "transferType", label: "Transfer", type: "select", options: ["Fresh", "Frozen", "Freeze-all — no transfer", "Cancelled"] },
  { key: "frozenTransfer", label: "Frozen Transfer Performed", type: "select", options: YES_NO },
  { key: "frozen", label: "Embryos Frozen", type: "number" },
  { key: "pgtPerformed", label: "PGT Performed", type: "select", options: ["No", "PGT-A", "PGT-M", "PGT-SR", "Combined"] },
  { key: "pgtResult", label: "PGT Result", type: "text", optional: true, placeholder: "e.g. 1 euploid of 3 biopsied" },
  { key: "implantation", label: "Implantation", type: "select", options: YES_NO },
  { key: "biochemicalPregnancy", label: "Biochemical Pregnancy", type: "select", options: YES_NO },
  { key: "clinicalPregnancy", label: "Clinical Pregnancy", type: "select", options: YES_NO },
  { key: "liveBirth", label: "Live Birth", type: "select", options: YES_NO },
  { key: "miscarriage", label: "Miscarriage", type: "select", options: YES_NO },
  { key: "ohss", label: "OHSS", type: "select", options: ["No", "Mild", "Moderate", "Severe"] },
  { key: "cancelled", label: "Cycle Cancelled", type: "select", options: YES_NO },
  { key: "cancellationReason", label: "Reason for Cancellation", type: "text", optional: true, showIf: (v) => String(v["cancelled"] ?? "") === "Yes", placeholder: "Documented reason" },
  { key: "complications", label: "Other Complication", type: "text", optional: true, placeholder: "Any other complication recorded" },
  { key: "cycleNotes", label: "Cycle Notes", type: "textarea", colSpan: 3, optional: true, placeholder: "Free-text notes for this cycle (optional)" },
];

/**
 * Logical grouping of the previous-cycle form.
 * Presentation only — no field is added, removed or re-interpreted here.
 */
export interface CycleFieldGroup {
  id: string;
  title: string;
  description?: string;
  keys: string[];
}

export const cycleFieldGroups: CycleFieldGroup[] = [
  {
    id: "identification",
    title: "Cycle identification",
    description: "When and where the cycle was performed, and the baseline at that time.",
    keys: ["cycleNumber", "cycleYear", "cycleDate", "cycleType", "cycleIndication", "clinic", "ageAtCycle", "amhAtCycle", "afcAtCycle"],
  },
  { id: "protocol", title: "Protocol", keys: ["protocol"] },
  {
    id: "gonadotropin",
    title: "Gonadotropin treatment",
    keys: ["gonadotropinType", "medication", "startingDose", "maxDose", "doseChanges", "totalDose", "duration"],
  },
  { id: "gnrh", title: "GnRH analogue", keys: ["gnrhAnalogue", "gnrhDetails"] },
  {
    id: "monitoring",
    title: "Monitoring",
    keys: ["peakE2", "cycleLh", "cycleProgesterone", "folliclesTotal", "follicles17", "follicles14"],
  },
  { id: "trigger", title: "Trigger", keys: ["trigger", "triggerTiming"] },
  { id: "retrieval", title: "Oocyte retrieval", keys: ["retrieved", "mii"] },
  { id: "fertilization", title: "Fertilization", keys: ["fertilized", "fertilizationRate", "twoPn"] },
  { id: "embryology", title: "Embryology", keys: ["day3", "blastocysts", "embryoGrades", "frozen"] },
  { id: "pgt", title: "PGT", keys: ["pgtPerformed", "pgtResult"] },
  { id: "transfer", title: "Transfer", keys: ["transferType", "transferred", "frozenTransfer"] },
  {
    id: "outcome",
    title: "Pregnancy / outcome",
    keys: ["implantation", "biochemicalPregnancy", "clinicalPregnancy", "miscarriage", "liveBirth"],
  },
  {
    id: "complications",
    title: "Complications",
    keys: ["ohss", "cancelled", "cancellationReason", "complications", "cycleNotes"],
  },
];

/** Cycle fields resolved for a group, preserving the declared field definitions. */
export const cycleGroupFields = (group: CycleFieldGroup): FieldDef[] =>
  group.keys
    .map((k) => cycleFields.find((f) => f.key === k))
    .filter((f): f is FieldDef => Boolean(f));

/** Groups visible for the current answers. */
export const visibleGroups = (step: StepDef, values: Record<string, unknown>): GroupDef[] =>
  step.groups.filter((g) => !g.showIf || g.showIf(values));

/** Fields of a group visible for the current answers. */
export const visibleFields = (group: GroupDef, values: Record<string, unknown>): FieldDef[] =>
  group.fields.filter((f) => !f.showIf || f.showIf(values));

/** Scoreable (non-derived, non-optional) fields currently visible in a step. */
export const allStepFields = (
  step: StepDef,
  values: Record<string, unknown> = {},
): FieldDef[] =>
  visibleGroups(step, values)
    .flatMap((g) => visibleFields(g, values))
    .filter((f) => f.type !== "derived" && !f.optional);

