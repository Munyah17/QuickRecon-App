"use client";

/**
 * Real client-side exports. Heavy libraries (xlsx/pdfmake/docx ≈ 1MB+)
 * are lazy-loaded only when an export is actually requested so they
 * never slow down page loads.
 */

export interface ExportData {
  /** Column headers, in order. */
  columns: string[];
  /** Row values aligned to columns. */
  rows: (string | number | null | undefined)[][];
}

export type ExportFormat = "csv" | "excel" | "pdf" | "docx";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

function exportCsv(data: ExportData, filename: string) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [data.columns.map(esc).join(",")];
  for (const row of data.rows) lines.push(row.map(esc).join(","));
  download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

async function exportExcel(data: ExportData, filename: string) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([data.columns, ...data.rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Recursively locate the vfs font dictionary (keys end in .ttf) inside
 * whatever interop shape the bundler gives vfs_fonts — default export,
 * nested pdfMake.vfs, or the raw dictionary itself. */
function findVfs(obj: unknown, depth = 0): Record<string, string> | null {
  if (!obj || typeof obj !== "object" || depth > 4) return null;
  const rec = obj as Record<string, unknown>;
  if (Object.keys(rec).some((k) => k.endsWith(".ttf"))) {
    return rec as Record<string, string>;
  }
  for (const v of Object.values(rec)) {
    const found = findVfs(v, depth + 1);
    if (found) return found;
  }
  return null;
}

async function getPdfMake() {
  const [pdfMakeMod, pdfFonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = (pdfMakeMod.default ?? pdfMakeMod) as unknown as {
    vfs: Record<string, string>;
    createPdf: (doc: unknown) => { download: (name: string) => void };
  };
  const vfs = findVfs(pdfFonts);
  if (!vfs || Object.keys(vfs).length === 0) {
    throw new Error("pdfmake fonts failed to load (empty vfs)");
  }
  pdfMake.vfs = vfs;
  return pdfMake;
}

async function exportPdf(data: ExportData, filename: string, title?: string) {
  const pdfMake = await getPdfMake();
  pdfMake.createPdf({
    pageSize: "A4",
    pageOrientation: data.columns.length > 6 ? "landscape" : "portrait",
    pageMargins: [32, 40, 32, 36],
    content: [
      { text: title ?? filename, fontSize: 13, bold: true, color: "#0f2b4c", margin: [0, 0, 0, 4] },
      { text: `Exported ${new Date().toLocaleString()} · ${data.rows.length} records`, fontSize: 8, color: "#6b7280", margin: [0, 0, 0, 10] },
      {
        table: {
          headerRows: 1,
          widths: data.columns.map(() => "auto"),
          body: [
            data.columns.map((c) => ({ text: c, bold: true, fontSize: 8, color: "#374151", fillColor: "#f3f4f6" })),
            ...data.rows.map((r) =>
              r.map((v) => ({ text: String(v ?? ""), fontSize: 8, color: "#111827" }))
            ),
          ],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: "#e5e7eb" },
      },
    ],
  }).download(`${filename}.pdf`);
}

async function exportDocx(data: ExportData, filename: string, title?: string) {
  const {
    AlignmentType, Document, Packer, Paragraph,
    Table: DocxTable, TableCell: DocxCell, TableRow: DocxRow,
    TextRun, WidthType,
  } = await import("docx");
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: title ?? filename, bold: true, size: 28 })],
            spacing: { after: 200 },
          }),
          new DocxTable({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new DocxRow({
                children: data.columns.map(
                  (c) =>
                    new DocxCell({
                      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })],
                    })
                ),
              }),
              ...data.rows.map(
                (r) =>
                  new DocxRow({
                    children: r.map(
                      (v) =>
                        new DocxCell({
                          children: [new Paragraph(String(v ?? ""))],
                        })
                    ),
                  })
              ),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Exported ${new Date().toLocaleString()} · ${data.rows.length} records`, italics: true, size: 16, color: "6b7280" })],
            spacing: { before: 200 },
            alignment: AlignmentType.RIGHT,
          }),
        ],
      },
    ],
  });
  download(await Packer.toBlob(doc), `${filename}.docx`);
}

/** Perform a real client-side export of the given dataset. */
export async function exportData(
  format: ExportFormat,
  data: ExportData,
  filename: string,
  title?: string
): Promise<void> {
  switch (format) {
    case "csv":
      exportCsv(data, filename);
      break;
    case "excel":
      await exportExcel(data, filename);
      break;
    case "pdf":
      await exportPdf(data, filename, title);
      break;
    case "docx":
      await exportDocx(data, filename, title);
      break;
  }
}

/**
 * Fetch a server-generated file and save it. Throws on error responses so
 * callers can surface a toast instead of the browser silently saving the
 * error body as a broken download (e.g. "file.xlsx.txt").
 */
export async function downloadFromApi(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  download(await res.blob(), filename);
}

/** Shared pdfMake accessor for other generators (payslips, receipts). */
export { getPdfMake };
