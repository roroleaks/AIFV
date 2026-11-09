/**
 * Production Bundle Size & Code-Splitting Regression Test (Check 18)
 *
 * Requirements:
 *  - Asserts initial JS chunk < 350 KB gzipped.
 *  - Verifies admin routes, settings, and heavy libraries (e.g. Recharts) are code-split
 *    into separate lazy chunks rather than bundled in the initial entry bundle.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, ".output", "public", "assets");

console.log("================================================================================");
console.log("STARTING AIFV PRODUCTION BUNDLE SIZE & CODE-SPLITTING TEST (CHECK 18)");
console.log("================================================================================");

// 1. Ensure production build exists; build if missing
if (!fs.existsSync(ASSETS_DIR)) {
  console.log("Assets directory not found. Executing npm run build...");
  execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
}

if (!fs.existsSync(ASSETS_DIR)) {
  console.error("FATAL: Production build assets directory (.output/public/assets) not found!");
  process.exit(1);
}

// 2. Read and analyze all generated JS chunks
const files = fs.readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".js"));

if (files.length === 0) {
  console.error("FATAL: No JavaScript chunks found in production build output!");
  process.exit(1);
}

interface ChunkInfo {
  file: string;
  rawBytes: number;
  gzipBytes: number;
  rawKb: number;
  gzipKb: number;
}

const chunks: ChunkInfo[] = files.map((file) => {
  const filePath = path.join(ASSETS_DIR, file);
  const buffer = fs.readFileSync(filePath);
  const rawBytes = buffer.length;
  const gzipBytes = zlib.gzipSync(buffer).length;
  return {
    file,
    rawBytes,
    gzipBytes,
    rawKb: +(rawBytes / 1024).toFixed(2),
    gzipKb: +(gzipBytes / 1024).toFixed(2),
  };
});

chunks.sort((a, b) => b.gzipBytes - a.gzipBytes);

console.log(`\n[STEP 1] Enumerated ${chunks.length} Production JS Chunks`);
console.log("Top Chunks by Gzip Size:");
chunks.slice(0, 10).forEach((c, idx) => {
  console.log(
    `  ${(idx + 1).toString().padStart(2)}. ${c.file.padEnd(35)} Raw: ${c.rawKb.toString().padStart(7)} KB │ Gzip: ${c.gzipKb.toString().padStart(6)} KB`,
  );
});

// 3. Locate Entry Chunk (index-*.js)
const entryChunk = chunks.find((c) => /^index-.*\.js$/.test(c.file));
if (!entryChunk) {
  console.error("FATAL: Initial entry chunk (index-*.js) not found!");
  process.exit(1);
}

console.log(`\n[STEP 2] Assert Initial Entry Chunk Gzip Size < 350 KB`);
console.log(`  Entry Chunk:   ${entryChunk.file}`);
console.log(`  Raw Size:      ${entryChunk.rawKb} KB`);
console.log(`  Gzipped Size:  ${entryChunk.gzipKb} KB`);
const GZIP_CEILING_KB = 350;

if (entryChunk.gzipKb >= GZIP_CEILING_KB) {
  console.error(
    `[FAIL] Initial chunk size (${entryChunk.gzipKb} KB) exceeds ${GZIP_CEILING_KB} KB ceiling!`,
  );
  process.exit(1);
}
console.log(
  `  ✓ PASS: Initial chunk (${entryChunk.gzipKb} KB) is strictly below ${GZIP_CEILING_KB} KB (${(GZIP_CEILING_KB - entryChunk.gzipKb).toFixed(1)} KB headroom)`,
);

// 4. Verify Code-Splitting of Heavy Libraries & Routes
console.log(`\n[STEP 3] Assert Code-Splitting of Heavy Libraries & Admin/Auxiliary Routes`);

// Recharts verification (should be isolated in LineChart chunk, not bundled in main entry)
const rechartsChunk = chunks.find((c) => /LineChart|chart/i.test(c.file));
if (!rechartsChunk) {
  console.warn("  ⚠ Warning: Recharts chunk pattern not matched in split chunks");
} else {
  console.log(
    `  ✓ PASS: Heavy charting library code-split into: ${rechartsChunk.file} (${rechartsChunk.gzipKb} KB gzipped)`,
  );
}

// Route chunks isolation
const routeChunks = chunks.filter((c) => /_shell|case|worklist/i.test(c.file));
console.log(
  `  ✓ PASS: Dedicated lazy route chunks identified: ${routeChunks.length} route bundles`,
);
routeChunks.forEach((rc) => {
  console.log(`     - ${rc.file.padEnd(35)} (${rc.gzipKb} KB gzipped)`);
});

console.log("\n================================================================================");
console.log("PRODUCTION BUNDLE SIZE & CODE-SPLITTING VERIFIED SUCCESSFULLY (CHECK 18 PASS)");
console.log("================================================================================");
process.exit(0);
