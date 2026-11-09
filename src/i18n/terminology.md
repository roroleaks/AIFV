# IVF Medical Terminology & Localization Guide (AiFV CDSS)

This document formalizes clinical localization conventions for English (`en`) and Arabic (`ar`, RTL) environments in accordance with ESHRE, ASRM, and Arab Board of Health Specializations in Obstetrics & Gynecology conventions.

---

## 1. Principle of Latin Script Retention for Standard Clinical Acronyms

In Arabic clinical environments, specialized medical acronyms, clinical score systems, and drug classes are preserved in **Latin script** within Arabic prose to avoid ambiguity, prevent misinterpretation during high-stress clinical workflows, and ensure alignment with laboratory diagnostic slips and ultrasound telemetry.

### Retained Acronyms in Latin Script:

- **POSEIDON** (Patient-Oriented Strategies Encompassing IndividualizeD Oocyte Number)
  - Arabic: تصنيف POSEIDON (مجموعة POSEIDON 1, 2, 3, 4)
- **Bologna** Criteria for Poor Ovarian Response
  - Arabic: معايير Bologna للاستجابة المبيضية الضعيفة
- **CONSORT** (Consolidated Standards of Ovarian Stimulation Research & Treatment)
  - Arabic: خوارزمية CONSORT لحساب الجرعة
- **OHSS** (Ovarian Hyperstimulation Syndrome)
  - Arabic: متلازمة فرط استجابة المبيض (مخاطر OHSS)
- **GnRH** (Gonadotropin-Releasing Hormone)
  - Arabic: هرمون GnRH (بروتوكول مضاد GnRH / بروتوكول محفز GnRH)
- **rFSH / hp-hMG** (Recombinant FSH / Highly Purified Menotropin)
  - Arabic: محفز الإباضة rFSH و hp-hMG
- **Hormone Markers:**
  - **AMH** (Anti-Müllerian Hormone) -> هرمون AMH
  - **AFC** (Antral Follicle Count) -> تعداد الجريبات الغارية (AFC)
  - **FSH** (Follicle-Stimulating Hormone) -> هرمون FSH الأساسي
  - **E2** (Estradiol) -> إستراديول (E2)
  - **LH** (Luteinizing Hormone) -> هرمون LH
  - **P4** (Progesterone) -> بروجستيرون (P4)
  - **hCG** (Human Chorionic Gonadotropin) -> محفز الإباضة hCG

---

## 2. Arabic Medical Terms (Standardized Translations)

| English Clinical Term                | Standard Arabic Translation              |
| ------------------------------------ | ---------------------------------------- |
| Controlled Ovarian Stimulation (COS) | تنشيط الإباضة المضبوط (COS)              |
| Folliculometry                       | قياس وتطور الجريبات بالموجات فوق الصوتية |
| Endometrial Thickness                | سمك بطانة الرحم                          |
| Trilaminar Pattern                   | نمط ثلاثي الطبقات                        |
| Trigger Readiness                    | جاهزية محفز الإباضة النهائي              |
| Ovarian Response                     | الاستجابة المبيضية                       |
| Starting Dose                        | الجرعة المبدئية لحقن التنشيط             |
| Dose Adjustment                      | تعديل الجرعة أثناء المتابعة              |
| Clinical Override                    | تعديل سريري بقرار الطبيب                 |
| Immutable Legal Dossier              | ملف سريري رقمي موثق ومقفل                |
| Encrypted at Rest                    | مشفر بالكامل أثناء الحفظ (AES-GCM-256)   |
| Clinical Decision Support            | نظام دعم القرار السريري التوليدي         |

---

## 3. Numeric Formatting & Clinical Safety

Per ESHRE digital CDSS guidelines:

- Laboratory metrics, drug dosages (`IU/day`), and measurements (`mm`, `pg/mL`, `ng/mL`) strictly default to **Western Arabic digits (0–9)** via `Intl.NumberFormat('ar', { numberingSystem: 'latn' })` to eliminate cross-reading errors with ultrasound calipers and syringe calibration markings.
