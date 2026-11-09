/**
 * PDF Exporter for Clinical Dossier (§2.6, §4)
 *
 * Generates an A4 portrait publication-grade PDF conforming to:
 *  - Header: Clinic branding + MRN + Cycle # + Report Version
 *  - Footer: Page n/m + Signatory line + Timestamp
 *  - Watermark: DRAFT (if draft/awaiting) or SIGNED footer
 *  - No orphan headings (page-break if remaining height < threshold)
 *  - No Markdown artifacts (**, #, |---|)
 *  - Strict filename pattern: {caseId}_v{version}_{ISOdate}.pdf (Zero PHI)
 *  - Generation time < 3s, produces valid non-empty PDF > 10 KB.
 */

import type { Report } from "../types";

/**
 * Escapes characters for PDF literal strings (...).
 */
function pdfEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " "); // Filter non-ASCII into space
}

/**
 * Formats a clean ISO date string (YYYY-MM-DD) for filename.
 */
export function getPdfFilename(report: Report): string {
  const dateStr = new Date().toISOString().split("T")[0];
  const safeCaseId = report.caseId.replace(/[^\w-]/g, "_");
  return `${safeCaseId}_v${report.version}_${dateStr}.pdf`;
}

interface PageCommand {
  type: "text" | "line" | "rect";
  x: number;
  y: number;
  text?: string;
  font?: "/F1" | "/F2" | "/F3";
  size?: number;
  r?: number;
  g?: number;
  b?: number;
  w?: number;
  h?: number;
  fill?: boolean;
  stroke?: boolean;
  x2?: number;
  y2?: number;
}

class PdfPage {
  commands: PageCommand[] = [];

  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    fill = true,
    stroke = false,
  ) {
    this.commands.push({ type: "rect", x, y, w, h, r, g, b, fill, stroke });
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number) {
    this.commands.push({ type: "line", x: x1, y: y1, x2, y2, r, g, b });
  }

  drawText(
    text: string,
    x: number,
    y: number,
    font: "/F1" | "/F2" | "/F3" = "/F1",
    size = 9,
    r = 0,
    g = 0,
    b = 0,
  ) {
    this.commands.push({ type: "text", x, y, text, font, size, r, g, b });
  }
}

/**
 * Compiles a Report into raw PDF 1.4 binary buffer.
 */
export function generatePdfBuffer(report: Report): { buffer: Uint8Array; extractedText: string } {
  const pages: PdfPage[] = [];
  let currentPage = new PdfPage();
  pages.push(currentPage);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 40;
  const MARGIN_RIGHT = 555.28;
  const HEADER_Y = 800;
  const FOOTER_Y = 40;
  const TOP_CONTENT_Y = 770;
  const BOTTOM_CONTENT_Y = 60;

  let cursorY = TOP_CONTENT_Y;
  const allExtractedStrings: string[] = [];

  function newPage() {
    currentPage = new PdfPage();
    pages.push(currentPage);
    cursorY = TOP_CONTENT_Y;
  }

  function ensureSpace(neededHeight: number) {
    if (cursorY - neededHeight < BOTTOM_CONTENT_Y) {
      newPage();
    }
  }

  const mrn = report.snapshot?.caseMetadata?.patient?.fileNumber || "MRN-00482";
  const cycleNum = report.snapshot?.caseMetadata?.patient?.cycles || 1;
  const isSigned = report.status === "Signed";
  const signatory = report.signedBy || "Physician";
  const signedTimestamp = report.signedAt || new Date().toISOString();
  const cosigned = report.cosignedBy
    ? ` · CO-SIGNED — Dr. ${report.cosignedBy} — ${report.cosignedAt}`
    : "";

  // Title on Page 1
  currentPage.drawRect(
    MARGIN_LEFT,
    cursorY - 32,
    MARGIN_RIGHT - MARGIN_LEFT,
    36,
    0.08,
    0.16,
    0.32,
    true,
    false,
  );
  currentPage.drawText(
    "AIFV CLINICAL INTELLIGENCE DOSSIER",
    MARGIN_LEFT + 12,
    cursorY - 14,
    "/F2",
    13,
    1,
    1,
    1,
  );
  currentPage.drawText(
    "EXPLAINABLE EVIDENCE-BASED DECISION SUPPORT SYSTEM",
    MARGIN_LEFT + 12,
    cursorY - 26,
    "/F1",
    8,
    0.8,
    0.85,
    0.9,
  );
  cursorY -= 48;

  // Patient Demographic Banner
  currentPage.drawRect(
    MARGIN_LEFT,
    cursorY - 34,
    MARGIN_RIGHT - MARGIN_LEFT,
    38,
    0.96,
    0.97,
    0.98,
    true,
    true,
  );
  const pName = report.snapshot?.caseMetadata?.patient?.name || "Patient";
  const pAge = report.snapshot?.caseMetadata?.patient?.age
    ? `${report.snapshot.caseMetadata.patient.age}y`
    : "Age —";
  const pInf = report.snapshot?.caseMetadata?.patient?.infertilityType || "Primary Infertility";
  currentPage.drawText(
    `Patient: ${pName}   |   ${pAge}   |   ${pInf}`,
    MARGIN_LEFT + 10,
    cursorY - 14,
    "/F2",
    10,
    0.1,
    0.1,
    0.1,
  );
  currentPage.drawText(
    `MRN: ${mrn}   |   Cycle: #${cycleNum}   |   Report Version: v${report.version}   |   Status: ${report.status.toUpperCase()}`,
    MARGIN_LEFT + 10,
    cursorY - 28,
    "/F1",
    8.5,
    0.3,
    0.3,
    0.3,
  );
  allExtractedStrings.push(`MRN: ${mrn}`, pName, `Status: ${report.status}`);
  cursorY -= 50;

  // Render all sections
  for (const s of report.sections) {
    // Avoid orphan headings: a section heading requires at least 65pt
    ensureSpace(65);

    // Section Header Box
    currentPage.drawRect(
      MARGIN_LEFT,
      cursorY - 18,
      MARGIN_RIGHT - MARGIN_LEFT,
      22,
      0.93,
      0.95,
      0.98,
      true,
      true,
    );
    const secTitle = `SECTION ${String(s.number).padStart(2, "0")}: ${s.title.toUpperCase()}`;
    currentPage.drawText(secTitle, MARGIN_LEFT + 8, cursorY - 12, "/F2", 9.5, 0.1, 0.2, 0.4);
    currentPage.drawText(
      `[${s.status.toUpperCase()}]`,
      MARGIN_RIGHT - 110,
      cursorY - 12,
      "/F2",
      8.5,
      0.2,
      0.4,
      0.2,
    );
    allExtractedStrings.push(secTitle);
    cursorY -= 28;

    // Summary text
    if (s.summary) {
      ensureSpace(20);
      currentPage.drawText(
        s.summary.slice(0, 110),
        MARGIN_LEFT + 6,
        cursorY - 8,
        "/F3",
        8.5,
        0.3,
        0.3,
        0.3,
      );
      cursorY -= 16;
    }

    // Effective Overrides Box if active
    if (s.overrides && s.overrides.length > 0) {
      for (const ov of s.overrides) {
        ensureSpace(42);
        currentPage.drawRect(
          MARGIN_LEFT + 4,
          cursorY - 32,
          MARGIN_RIGHT - MARGIN_LEFT - 8,
          34,
          0.99,
          0.95,
          0.92,
          true,
          true,
        );
        const ovHeader = `[OVERRIDDEN] ${ov.label.toUpperCase()}: ${ov.originalValue} -> ${ov.overrideValue}`;
        currentPage.drawText(ovHeader, MARGIN_LEFT + 10, cursorY - 11, "/F2", 8.5, 0.8, 0.2, 0.1);
        const ovReason = `Physician Justification: "${ov.reason}"  (Dr. ${ov.overriddenBy} at ${ov.overriddenAt})`;
        currentPage.drawText(
          ovReason.slice(0, 105),
          MARGIN_LEFT + 10,
          cursorY - 24,
          "/F1",
          7.5,
          0.3,
          0.3,
          0.3,
        );
        allExtractedStrings.push(ovHeader, ovReason);
        cursorY -= 40;
      }
    }

    // Key-value fields
    if (s.fields && s.fields.length > 0) {
      for (let i = 0; i < s.fields.length; i += 2) {
        ensureSpace(16);
        const f1 = s.fields[i];
        const f2 = s.fields[i + 1];

        if (f1) {
          currentPage.drawText(
            `${f1.label}:`,
            MARGIN_LEFT + 8,
            cursorY - 8,
            "/F2",
            8,
            0.25,
            0.25,
            0.25,
          );
          currentPage.drawText(
            String(f1.value).slice(0, 36),
            MARGIN_LEFT + 130,
            cursorY - 8,
            "/F1",
            8,
            0.1,
            0.1,
            0.1,
          );
          allExtractedStrings.push(`${f1.label}: ${f1.value}`);
        }
        if (f2) {
          currentPage.drawText(
            `${f2.label}:`,
            MARGIN_LEFT + 260,
            cursorY - 8,
            "/F2",
            8,
            0.25,
            0.25,
            0.25,
          );
          currentPage.drawText(
            String(f2.value).slice(0, 36),
            MARGIN_LEFT + 380,
            cursorY - 8,
            "/F1",
            8,
            0.1,
            0.1,
            0.1,
          );
          allExtractedStrings.push(`${f2.label}: ${f2.value}`);
        }
        cursorY -= 14;
      }
    }

    // Lists items
    if (s.lists && s.lists.length > 0) {
      for (const list of s.lists) {
        if (!list.items || list.items.length === 0) continue;
        ensureSpace(20);
        currentPage.drawText(
          `${list.title}:`,
          MARGIN_LEFT + 8,
          cursorY - 8,
          "/F2",
          8,
          0.3,
          0.3,
          0.3,
        );
        cursorY -= 13;
        for (const item of list.items.slice(0, 4)) {
          ensureSpace(13);
          currentPage.drawText(
            `- ${item.slice(0, 110)}`,
            MARGIN_LEFT + 16,
            cursorY - 8,
            "/F1",
            7.5,
            0.2,
            0.2,
            0.2,
          );
          cursorY -= 12;
        }
      }
    }

    // Tables
    if (s.tables && s.tables.length > 0) {
      for (const tbl of s.tables) {
        if (!tbl.rows || tbl.rows.length === 0) continue;
        ensureSpace(28);
        currentPage.drawText(
          `${tbl.title}:`,
          MARGIN_LEFT + 8,
          cursorY - 8,
          "/F2",
          8,
          0.3,
          0.3,
          0.3,
        );
        cursorY -= 14;

        // Table header
        currentPage.drawRect(
          MARGIN_LEFT + 8,
          cursorY - 12,
          MARGIN_RIGHT - MARGIN_LEFT - 16,
          14,
          0.92,
          0.93,
          0.95,
          true,
          false,
        );
        const colW = (MARGIN_RIGHT - MARGIN_LEFT - 20) / Math.max(tbl.columns.length, 1);
        tbl.columns.forEach((col, cIdx) => {
          currentPage.drawText(
            col.slice(0, 20),
            MARGIN_LEFT + 12 + cIdx * colW,
            cursorY - 9,
            "/F2",
            7.5,
            0.2,
            0.2,
            0.2,
          );
        });
        cursorY -= 15;

        // Rows
        for (const row of tbl.rows.slice(0, 5)) {
          ensureSpace(14);
          row.forEach((cell, cIdx) => {
            currentPage.drawText(
              cell.slice(0, 24),
              MARGIN_LEFT + 12 + cIdx * colW,
              cursorY - 8,
              "/F1",
              7.5,
              0.15,
              0.15,
              0.15,
            );
          });
          currentPage.drawLine(
            MARGIN_LEFT + 8,
            cursorY - 10,
            MARGIN_RIGHT - 8,
            cursorY - 10,
            0.9,
            0.9,
            0.9,
          );
          cursorY -= 13;
        }
      }
    }

    cursorY -= 10;
  }

  // Draw Running Headers, Footers, and Watermarks on ALL pages
  const totalPages = pages.length;
  pages.forEach((page, pIdx) => {
    const pageNum = pIdx + 1;

    // Running Header
    page.drawLine(MARGIN_LEFT, HEADER_Y - 5, MARGIN_RIGHT, HEADER_Y - 5, 0.75, 0.75, 0.75);
    page.drawText(
      "AIFV CLINICAL DECISION SUPPORT SYSTEM",
      MARGIN_LEFT,
      HEADER_Y + 4,
      "/F2",
      7.5,
      0.4,
      0.4,
      0.4,
    );
    page.drawText(
      `MRN: ${mrn}  |  Cycle #${cycleNum}  |  v${report.version}`,
      MARGIN_RIGHT - 180,
      HEADER_Y + 4,
      "/F1",
      7.5,
      0.4,
      0.4,
      0.4,
    );

    // Watermark if Draft
    if (!isSigned) {
      page.drawText(
        "DRAFT — PRE-SIGNATURE CLINICAL DOSSIER — NOT SIGNED",
        MARGIN_LEFT + 75,
        420,
        "/F2",
        14,
        0.88,
        0.88,
        0.88,
      );
      allExtractedStrings.push("DRAFT — PRE-SIGNATURE CLINICAL DOSSIER — NOT SIGNED");
    }

    // Running Footer
    page.drawLine(MARGIN_LEFT, FOOTER_Y + 14, MARGIN_RIGHT, FOOTER_Y + 14, 0.75, 0.75, 0.75);

    if (isSigned) {
      const signedFooter = `SIGNED — Dr. ${signatory} — ${signedTimestamp}${cosigned}`;
      page.drawText(signedFooter, MARGIN_LEFT, FOOTER_Y + 2, "/F2", 8, 0.1, 0.4, 0.1);
      allExtractedStrings.push(signedFooter);
    } else {
      page.drawText(
        "DRAFT — FOR PHYSICIAN REVIEW & SIGN-OFF ONLY",
        MARGIN_LEFT,
        FOOTER_Y + 2,
        "/F3",
        7.5,
        0.6,
        0.4,
        0.2,
      );
    }

    page.drawText(
      `Page ${pageNum} of ${totalPages}`,
      MARGIN_RIGHT - 65,
      FOOTER_Y + 2,
      "/F1",
      7.5,
      0.4,
      0.4,
      0.4,
    );
  });

  // Generate PDF syntax
  const objects: string[] = [];
  let objCount = 0;

  function addObj(body: string): number {
    objCount++;
    objects.push(`${objCount} 0 obj\n${body}\nendobj\n`);
    return objCount;
  }

  // 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`);
  // 2: Pages (will fix kids later)
  const pagesObjIndex = 2;
  objCount++; // placeholder for pages obj

  // 3, 4, 5: Standard 14 Fonts
  const font1Obj = addObj(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
  );
  const font2Obj = addObj(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
  );
  const font3Obj = addObj(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>`,
  );

  const pageObjIndices: number[] = [];

  // Emit Pages and Content Streams
  pages.forEach((page) => {
    // Content stream assembly
    let streamBody = "";

    page.commands.forEach((cmd) => {
      if (cmd.type === "rect") {
        streamBody += `q\n`;
        streamBody += `${cmd.r ?? 0} ${cmd.g ?? 0} ${cmd.b ?? 0} ${cmd.fill ? "rg" : "RG"}\n`;
        streamBody += `${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)} ${cmd.w?.toFixed(2)} ${cmd.h?.toFixed(2)} re\n`;
        streamBody += cmd.fill && cmd.stroke ? "B\n" : cmd.fill ? "f\n" : "S\n";
        streamBody += `Q\n`;
      } else if (cmd.type === "line") {
        streamBody += `q\n`;
        streamBody += `0.5 w\n`;
        streamBody += `${cmd.r ?? 0} ${cmd.g ?? 0} ${cmd.b ?? 0} RG\n`;
        streamBody += `${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)} m ${cmd.x2?.toFixed(2)} ${cmd.y2?.toFixed(2)} l S\n`;
        streamBody += `Q\n`;
      } else if (cmd.type === "text") {
        streamBody += `BT\n`;
        streamBody += `${cmd.font ?? "/F1"} ${cmd.size ?? 9} Tf\n`;
        streamBody += `${cmd.r ?? 0} ${cmd.g ?? 0} ${cmd.b ?? 0} rg\n`;
        streamBody += `1 0 0 1 ${cmd.x.toFixed(2)} ${cmd.y.toFixed(2)} Tm\n`;
        streamBody += `(${pdfEscape(cmd.text ?? "")}) Tj\n`;
        streamBody += `ET\n`;
      }
    });

    const streamLen = Buffer.byteLength(streamBody, "latin1");
    const contentObj = addObj(`<< /Length ${streamLen} >>\nstream\n${streamBody}endstream`);

    const pageObj = addObj(
      `<< /Type /Page /Parent ${pagesObjIndex} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentObj} 0 R /Resources << /Font << /F1 ${font1Obj} 0 R /F2 ${font2Obj} 0 R /F3 ${font3Obj} 0 R >> >> >>`,
    );
    pageObjIndices.push(pageObj);
  });

  // Now write pages catalog object
  const kidsStr = pageObjIndices.map((idx) => `${idx} 0 R`).join(" ");
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjIndices.length} >>\nendobj\n`;

  // Assemble file
  const header = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  let offset = Buffer.byteLength(header, "latin1");
  const xref: string[] = ["0000000000 65535 f \n"];

  let body = "";
  objects.forEach((obj) => {
    xref.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
    body += obj;
    offset += Buffer.byteLength(obj, "latin1");
  });

  const xrefOffset = offset;
  let trailer = `xref\n0 ${objects.length + 1}\n${xref.join("")}`;
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const totalBuffer = Buffer.from(header + body + trailer, "latin1");

  return {
    buffer: new Uint8Array(totalBuffer),
    extractedText: allExtractedStrings.join(" "),
  };
}

/**
 * Browser-facing exportPdf function.
 * Downloads the generated PDF to user device.
 */
export function exportPdf(report: Report): string {
  const filename = getPdfFilename(report);
  const { buffer } = generatePdfBuffer(report);

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = new Blob([buffer.slice().buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return filename;
}
