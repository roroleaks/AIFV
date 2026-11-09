/**
 * i18n Completeness & 1:1 Key Coverage Test (Check 15)
 *
 * Requirements:
 *  - Asserts 1:1 key coverage between en.json and ar.json.
 *  - Verifies all nested keys match recursively.
 *  - Checks that every key has non-empty translated content in both locales.
 *  - Verifies medical terminology compliance (Latin acronyms preserved in Arabic).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function flattenKeys(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenKeys(v as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(v);
    }
  }
  return result;
}

console.log("================================================================================");
console.log("STARTING AIFV i18n COMPLETENESS & KEY COVERAGE TEST");
console.log("================================================================================");

const enPath = path.join(ROOT, "src", "i18n", "en.json");
const arPath = path.join(ROOT, "src", "i18n", "ar.json");

if (!fs.existsSync(enPath) || !fs.existsSync(arPath)) {
  console.error("FATAL: Missing en.json or ar.json in src/i18n!");
  process.exit(1);
}

const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));
const ar = JSON.parse(fs.readFileSync(arPath, "utf-8"));

const enKeys = flattenKeys(en);
const arKeys = flattenKeys(ar);

const enKeyList = Object.keys(enKeys).sort();
const arKeyList = Object.keys(arKeys).sort();

console.log(`\n[STEP 1] Key Enumeration`);
console.log(`English keys found: ${enKeyList.length}`);
console.log(`Arabic keys found:  ${arKeyList.length}`);

// Check 1: Keys in EN but missing in AR
const missingInAr = enKeyList.filter((k) => !(k in arKeys));
if (missingInAr.length > 0) {
  console.error(`[FAIL] Keys present in en.json but MISSING in ar.json:`, missingInAr);
  process.exit(1);
}
console.log("  ✓ PASS: All en.json keys exist in ar.json (0 missing)");

// Check 2: Keys in AR but missing in EN
const missingInEn = arKeyList.filter((k) => !(k in enKeys));
if (missingInEn.length > 0) {
  console.error(`[FAIL] Keys present in ar.json but MISSING in en.json:`, missingInEn);
  process.exit(1);
}
console.log("  ✓ PASS: All ar.json keys exist in en.json (0 missing)");

// Check 3: Non-empty translations
let emptyTranslations = 0;
for (const [k, v] of Object.entries(enKeys)) {
  if (!v || v.trim() === "") {
    console.error(`[FAIL] Empty English translation for key: ${k}`);
    emptyTranslations++;
  }
}
for (const [k, v] of Object.entries(arKeys)) {
  if (!v || v.trim() === "") {
    console.error(`[FAIL] Empty Arabic translation for key: ${k}`);
    emptyTranslations++;
  }
}
if (emptyTranslations > 0) {
  process.exit(1);
}
console.log("  ✓ PASS: Zero empty translations across both dictionaries");

// Check 4: Latin Medical Acronym Preservation in Arabic
const REQUIRED_LATIN_ACRONYMS = [
  "POSEIDON",
  "Bologna",
  "OHSS",
  "AMH",
  "AFC",
  "FSH",
  "E2",
  "AES-GCM-256",
];
for (const acronym of REQUIRED_LATIN_ACRONYMS) {
  const matchingKeys = Object.entries(arKeys).filter(([_, v]) => v.includes(acronym));
  if (matchingKeys.length === 0) {
    console.error(
      `[FAIL] Required clinical acronym "${acronym}" not found in Arabic translations!`,
    );
    process.exit(1);
  }
}
console.log(
  "  ✓ PASS: Clinical acronyms (POSEIDON, Bologna, OHSS, AMH, AFC, FSH, E2) preserved in Latin script in Arabic",
);

console.log("\n================================================================================");
console.log(`i18n COVERAGE RESULTS: ${enKeyList.length} KEYS 100% MATCHED (1:1 PARITY)`);
console.log("================================================================================");
process.exit(0);
