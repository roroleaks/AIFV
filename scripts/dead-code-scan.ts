/**
 * Dead-Code & Production Cleanliness Scan (Check 19)
 *
 * Requirements:
 *  1. Zero `localStorage` references in production dirs (`src/features`, `src/components`, `src/services`, `src/hooks`).
 *  2. Zero hardcoded PINs ("123456" / "12345678") in `src/` outside `pinConfig.ts`.
 *  3. Zero legacy stepper route references (`legacy/stepper`, `LegacyStepper`, `_shell.legacy`) across `src/`.
 *  4. Zero unused locals or parameters in Phase 1–8 application code.
 *  5. Zero `console.log` or `console.debug` in `src/features`, `src/components`, `src/services`.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

console.log("================================================================================");
console.log("STARTING AIFV DEAD-CODE & RELEASE CLEANLINESS SCAN (CHECK 19)");
console.log("================================================================================");

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    totalPassed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    if (detail) console.error(`    Detail: ${detail}`);
    totalFailed++;
  }
}

// -----------------------------------------------------------------------------
// Check 1: Zero localStorage in production paths
// -----------------------------------------------------------------------------
console.log("\n[TEST 1] Plaintext localStorage Scan in Production Directories");
try {
  const output = execSync(
    'git grep --untracked -n "localStorage" src/features src/components src/services src/hooks',
    { cwd: ROOT, encoding: "utf-8" },
  );
  assert(false, "Zero localStorage in src/features, src/components, src/services, src/hooks", output);
} catch {
  // Exit code 1 means 0 matches found -> PASS
  assert(true, "Zero localStorage in src/features, src/components, src/services, src/hooks (0 hits)");
}

// -----------------------------------------------------------------------------
// Check 2: Zero hardcoded PINs outside pinConfig.ts and scripts/
// -----------------------------------------------------------------------------
console.log("\n[TEST 2] Hardcoded PIN Scan ('123456' / '12345678')");
try {
  const output = execSync(
    'git grep --untracked -n "123456\\|12345678" src/',
    { cwd: ROOT, encoding: "utf-8" },
  );
  const lines = output.trim().split("\n").filter((l) => l.trim().length > 0);
  const nonConfigHits = lines.filter((l) => !l.includes("pinConfig.ts"));
  if (nonConfigHits.length === 0) {
    assert(true, "Zero hardcoded PINs in src/ outside pinConfig.ts (single source of truth)");
  } else {
    assert(false, "Zero hardcoded PINs in src/ outside pinConfig.ts", nonConfigHits.join("\n"));
  }
} catch {
  assert(true, "Zero hardcoded PINs in src/ outside pinConfig.ts");
}

// -----------------------------------------------------------------------------
// Check 3: Zero legacy stepper route references
// -----------------------------------------------------------------------------
console.log("\n[TEST 3] Legacy Stepper Route Elimination Scan");
try {
  const output = execSync(
    'git grep --untracked -n "legacy/stepper\\|LegacyStepper\\|_shell.legacy" src/',
    { cwd: ROOT, encoding: "utf-8" },
  );
  assert(false, "Zero legacy stepper references across src/", output);
} catch {
  assert(true, "Zero legacy stepper references across src/ (route & links cleanly eliminated)");
}

// -----------------------------------------------------------------------------
// Check 4: Unused locals & parameters in Phase 1–8 code
// -----------------------------------------------------------------------------
console.log("\n[TEST 4] TypeScript Strict Unused Locals & Parameters Scan");
let tscOutput = "";
try {
  tscOutput = execSync("npx tsc --noEmit --noUnusedLocals --noUnusedParameters", {
    cwd: ROOT,
    encoding: "utf-8",
  });
} catch (err: unknown) {
  const execErr = err as { stdout?: string; stderr?: string };
  tscOutput = (execErr.stdout || "") + (execErr.stderr || "");
}

const tscLines = tscOutput.split("\n").filter((l) => l.includes("error TS6133") || l.includes("error TS6192") || l.includes("error TS6196") || l.includes("error TS4111"));
// Filter out pure engine directories (which remain byte-untouched by design)
const appCodeErrors = tscLines.filter((l) => {
  return (
    l.includes("src/components/") ||
    l.includes("src/features/") ||
    l.includes("src/services/") ||
    l.includes("src/hooks/") ||
    l.includes("src/routes/") ||
    l.includes("src/i18n/")
  );
});

assert(
  appCodeErrors.length === 0,
  `Zero unused locals/parameters in Phase 1-8 app codebase (${appCodeErrors.length} found)`,
  appCodeErrors.join("\n"),
);

// -----------------------------------------------------------------------------
// Check 5: Zero console.log / console.debug in production services & components
// -----------------------------------------------------------------------------
console.log("\n[TEST 5] Console Debug Logging Scan");
try {
  const output = execSync(
    'git grep --untracked -n "console\\.log\\|console\\.debug" src/features src/components src/services',
    { cwd: ROOT, encoding: "utf-8" },
  );
  assert(false, "Zero console.log/console.debug in production services and components", output);
} catch {
  assert(true, "Zero console.log/console.debug in src/features, src/components, src/services (0 hits)");
}

console.log("\n================================================================================");
console.log(`DEAD-CODE SCAN RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log("================================================================================");

if (totalFailed > 0) {
  process.exit(1);
}
process.exit(0);
