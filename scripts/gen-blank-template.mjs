import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";

// Worksheet structure agreed with the client — order matters.
const SHEETS = [
  "Dashboard",
  "Summary",
  "Insurance",
  "ZINARA",
  "NMB",
  "NBS",
  "CBZ",
  "STEWARD",
  "USD Deposits",
  "Transfers & Ecocash",
  "Alterations",
];

// Columns confirmed so far (left → right). Sheets not yet specced stay blank.
const COLUMNS = {
  Summary: [
    "Agent Name",
    "Opening Variance",
    "Insurance",
    "Premium Cover",
    "Commission",
    "Net Insurance",
    "ZINARA",
    "Insurance PDS",
    "ZINARA PDS",
    "Total Expected",
    "CBZ",
    "NBS",
    "NMB",
    "STEWARD",
    "USD Deposits",
    "Transfers & Ecocash",
    "Alterations",
  ],
};

const NAVY = "FF0F2B4C";
const wb = new ExcelJS.Workbook();
wb.creator = "QuickRecon App";
wb.created = new Date();

for (const name of SHEETS) {
  const ws = wb.addWorksheet(name);
  const cols = COLUMNS[name];
  if (cols) {
    ws.addRow(cols);
    ws.getRow(1).eachCell((c) => {
      c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      c.alignment = { vertical: "middle", wrapText: true };
    });
    ws.getRow(1).height = 28;
    // Two data rows reserved for USD & ZiG.
    ws.addRow([]);
    ws.addRow([]);
    ws.columns.forEach((c, i) => (c.width = i === 0 ? 24 : 14));
  } else {
    ws.getCell("A1").value = `${name} — columns TBD`;
    ws.getCell("A1").font = { bold: true, size: 12 };
    ws.columns = [{ width: 30 }];
  }
}

const buf = await wb.xlsx.writeBuffer();
writeFileSync("recon-template-blank.xlsx", Buffer.from(buf));
console.log("Wrote recon-template-blank.xlsx with", SHEETS.length, "sheets.");
console.log("Summary columns:", COLUMNS.Summary.length);
