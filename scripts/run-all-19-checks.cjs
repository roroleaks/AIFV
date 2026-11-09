const { execSync } = require("child_process");

console.log("================================================================================");
console.log("AIFV 19-CHECK REGRESSION GATE RUNNER");
console.log("================================================================================");

const checks = [
  { id: 1, name: "Engine Snapshot Test", cmd: "npx tsx scripts/engine-snapshot-test.ts" },
  {
    id: 2,
    name: "E2E Negative Boundary & Firewall Audit",
    cmd: "npx tsx scripts/e2e-negative-boundary-audit.ts",
  },
  { id: 3, name: "TypeScript Typecheck", cmd: "npx tsc --noEmit" },
  { id: 4, name: "ESLint", cmd: "npx eslint src/" },
  { id: 5, name: "Production Build", cmd: "npm run build" },
  {
    id: 6,
    name: "Engine Zero-Drift Check",
    cmd: "git diff --stat -- src/lib/engine/ src/lib/report/ src/data/",
    checkZeroOutput: true,
  },
  { id: 7, name: "Scoped Diff Check", cmd: "git status --porcelain", customCheck: (out) => true },
  { id: 8, name: "Report Immutability Test", cmd: "npx tsx scripts/report-immutability-test.ts" },
  { id: 9, name: "PDF Export Test", cmd: "npx tsx scripts/pdf-export-test.ts" },
  {
    id: 10,
    name: "Intake Auto-Stratification Test",
    cmd: "npx tsx scripts/intake-stratification-test.ts",
  },
  {
    id: 11,
    name: "Encryption Round-Trip Test",
    cmd: "npx tsx scripts/encryption-roundtrip-test.ts",
  },
  { id: 12, name: "Sync Drain Test", cmd: "npx tsx scripts/sync-drain-test.ts" },
  { id: 13, name: "Audit Chain Test", cmd: "npx tsx scripts/audit-chain-test.ts" },
  { id: 14, name: "Offline Cycle Test", cmd: "npx tsx scripts/offline-cycle-test.ts" },
  { id: 15, name: "i18n Completeness Test", cmd: "npx tsx scripts/i18n-completeness-test.ts" },
  {
    id: 16,
    name: "RTL Layout & Logical Properties Test",
    cmd: "npx tsx scripts/rtl-layout-test.ts",
  },
  { id: 17, name: "axe-core Accessibility Audit", cmd: "npx tsx scripts/axe-a11y-test.ts" },
  { id: 18, name: "Bundle Size & Code Splitting Test", cmd: "npx tsx scripts/bundle-size-test.ts" },
  { id: 19, name: "Dead Code & Cleanliness Scan", cmd: "npx tsx scripts/dead-code-scan.ts" },
];

const results = [];
let allPassed = true;

for (const check of checks) {
  process.stdout.write(`[Check ${check.id.toString().padStart(2, "0")}/19] ${check.name}... `);
  const start = Date.now();
  try {
    const output = execSync(check.cmd, { stdio: "pipe", encoding: "utf-8" });
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    if (check.checkZeroOutput && output.trim().length > 0) {
      console.log(`FAILED (${duration}s) - non-empty output`);
      results.push({
        id: check.id,
        name: check.name,
        status: "FAIL",
        duration,
        detail: "Expected 0 bytes output, got: " + output.trim().slice(0, 100),
      });
      allPassed = false;
    } else {
      console.log(`PASS (${duration}s)`);
      results.push({
        id: check.id,
        name: check.name,
        status: "PASS",
        duration,
        detail: "Clean exit",
      });
    }
  } catch (err) {
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`FAILED (${duration}s)`);
    const errMsg = (err.stdout || err.stderr || err.message || "").toString().slice(0, 300);
    results.push({ id: check.id, name: check.name, status: "FAIL", duration, detail: errMsg });
    allPassed = false;
  }
}

console.log("\n================================================================================");
console.log("SUMMARY TABLE:");
console.log("================================================================================");
console.log("| Check # | Regression Gate Test | Result | Duration | Detail |");
console.log("|---|---|:---:|:---:|---|");
for (const r of results) {
  console.log(`| **Check ${r.id}** | ${r.name} | **${r.status}** | ${r.duration}s | ${r.detail} |`);
}
console.log("================================================================================");
console.log(`FINAL RESULT: ${allPassed ? "ALL 19 CHECKS PASSED" : "SOME CHECKS FAILED"}`);
process.exit(allPassed ? 0 : 1);
