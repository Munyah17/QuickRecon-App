/**
 * Builds the agent reporting workbook(s) in the canonical format the
 * reconciliation adapters ingest, from the legacy "Agent Dumb.xlsx" dump.
 *
 * Outputs (next to the source file):
 *   1. "Agent Dumb (new format).xlsx"   — the same data restructured into the
 *      canonical sheets, with AGENT ID columns back-filled from the roster.
 *   2. "Agent Template - Econet.xlsx"   — blank template for Econet agents
 *      (INSURANCE ECO only — an Enpassent sheet is never sent to them).
 *   3. "Agent Template - Enpassent.xlsx" — blank template for Enpassent agents.
 *
 * Canonical sheets
 *   INSURANCE ECO | INSURANCE ENPA     per-module insurance sales
 *   ZINARA                             vehicle-license sales (shared)
 *   NMB DEPOSITS | CBZ & FBC DEPOSITS | NBS DEPOSITS
 *                                      per-bank deposits, identical columns
 *   ALTERATIONS ZIG | ALTERATIONS USD  manual adjustments, deposit-style cols
 *
 * Every transactional sheet carries AGENT ID (the agent's code from creation —
 * Zinara user id preferred, else a bank terminal id) and CURRENCY. There is
 * deliberately no "ZIG Deposits" sheet: denomination is expressed per row via
 * CURRENCY.
 *
 * Usage:
 *   node scripts/build-agent-templates.mjs [dump.xlsx] [roster.xlsx]
 */
import * as XLSX from "xlsx";
import * as fs from "node:fs";
import { dirname, join } from "node:path";

XLSX.set_fs(fs);

const SRC = process.argv[2] ?? "C:/Users/MeXa/Downloads/Agent Dumb.xlsx";
const ROSTER =
  process.argv[3] ??
  "C:/Users/MeXa/Downloads/Quick Recon - Agent Template (fixed).xlsx";
const OUT_DIR = dirname(SRC);

/* ---------------------------------------------------------------- helpers */

const rowsOf = (ws) => XLSX.utils.sheet_to_json(ws, { defval: null });

const cell = (row, ...names) => {
  for (const n of names)
    for (const k of Object.keys(row))
      if (k.trim().toLowerCase() === n.toLowerCase()) return row[k];
  return null;
};

const splitCodes = (v) =>
  v == null ? [] : String(v).split(/[;,]/).map((s) => s.trim()).filter(Boolean);

const titleCase = (s) =>
  String(s)
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

const excelDate = (n) => {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 1 || n > 60000)
    return n ?? null;
  return new Date(Math.round((n - 25569) * 86400 * 1000))
    .toISOString()
    .slice(0, 10);
};

const bareZinara = (v) => {
  const i = v.indexOf(" - ");
  return i > 0 ? v.slice(0, i).trim() : v;
};

/* ------------------------------------------------- roster: code ↔ agent */

const codeToName = new Map(); // normalised code -> agent full name
const nameToId = new Map(); // UPPER name -> preferred AGENT ID
const nmbUsdCodes = new Set(); // F…/Q… NMB USD terminal ids

try {
  const roster = XLSX.readFile(ROSTER);
  for (const r of rowsOf(roster.Sheets[roster.SheetNames[0]])) {
    const name = String(cell(r, "Full Name", "Name") ?? "").trim();
    if (!name) continue;
    const key = name.toUpperCase();
    const codes = {
      zinara: splitCodes(cell(r, "Zinara User")),
      nmb: splitCodes(cell(r, "NMB")),
      nmbUsd: splitCodes(cell(r, "NMB USD")),
      cbz: splitCodes(cell(r, "CBZ")),
      nbs: splitCodes(cell(r, "NBS")),
      fbc: splitCodes(cell(r, "FBC")),
    };
    for (const v of codes.zinara) {
      codeToName.set(v.toUpperCase(), name);
      codeToName.set(bareZinara(v).toUpperCase(), name);
    }
    for (const set of [codes.nmb, codes.cbz, codes.nbs, codes.fbc])
      for (const v of set) codeToName.set(v.toUpperCase(), name);
    for (const v of codes.nmbUsd) {
      codeToName.set(v.toUpperCase(), name);
      nmbUsdCodes.add(v.toUpperCase());
    }
    const preferred =
      codes.zinara[0] ?? codes.nmb[0] ?? codes.cbz[0] ??
      codes.nbs[0] ?? codes.fbc[0];
    if (preferred && !nameToId.has(key))
      nameToId.set(key, bareZinara(preferred));
  }
} catch {
  console.warn(`Roster not readable (${ROSTER}) — AGENT ID columns left blank where not derivable.`);
}

const agentIdFor = (name) => nameToId.get(String(name ?? "").trim().toUpperCase()) ?? null;
const nameForCode = (code) => codeToName.get(String(code ?? "").trim().toUpperCase()) ?? null;

/** NMB terminal code → currency. F…/Q… ids are the USD wallets (roster "NMB USD"). */
const nmbCurrency = (code) =>
  nmbUsdCodes.has(String(code ?? "").toUpperCase()) || /^[FQ]/i.test(String(code ?? ""))
    ? "USD"
    : "ZWG";

/* ------------------------------------------------------------- load dump */

const wb = XLSX.readFile(SRC);
const sheet = (re) => wb.SheetNames.find((n) => re.test(n));

/* ------------------------------------------------------- canonical headers */

const COLS = {
  insEco: ["AGENT ID", "AGENT", "DATE", "STATUS", "POLICY NO", "VRN", "POLICY COVER", "STAMP DUTY", "GOVERNMENT LEVY", "RTA AMOUNT", "PREMIUM COLLECTED", "PAYMENT METHOD", "CURRENCY"],
  insEnpa: ["AGENT ID", "AGENT", "DATE", "STATUS", "CANCELLED DATE", "POLICY NO", "PREMIUM COLLECTED", "POLICY COVER", "PAYMENT METHOD", "VRN", "LOCATION", "INSURANCE COMPANY", "CURRENCY"],
  zinara: ["AGENT ID", "AGENT", "OFFICE", "ZINARA ACCOUNT ID", "REGISTRATION NUMBER", "PAYMENT METHOD", "AMOUNT", "CURRENCY"],
  deposit: ["DATE", "AGENT ID", "AGENT NAME", "BANK", "AMOUNT", "CURRENCY", "REF", "NARRATION"],
  alteration: ["DATE", "AGENT ID", "AGENT NAME", "AMOUNT", "CURRENCY", "BANK", "NARRATION"],
};

/* ------------------------------------------------- transform source sheets */

const outSheets = {};

{
  const name = sheet(/^INSURANCE ECO/i);
  if (name) {
    outSheets["INSURANCE ECO"] = rowsOf(wb.Sheets[name]).map((r) => {
      const agent = String(cell(r, "AGENT", "Agent", "Agent Name") ?? "").trim();
      return {
        "AGENT ID": agentIdFor(agent),
        AGENT: agent || null,
        DATE: excelDate(cell(r, "ISSUE DATE", "Date")),
        STATUS: cell(r, "STATUS"),
        "POLICY NO": cell(r, "POLICY NO", "Policy_No"),
        VRN: cell(r, "VRN"),
        "POLICY COVER": cell(r, "POLICY COVER", "Policy Cover"),
        "STAMP DUTY": cell(r, "STAMP DUTY"),
        "GOVERNMENT LEVY": cell(r, "GOVERNMENT LEVY"),
        "RTA AMOUNT": cell(r, "RTA AMOUNT", "RTA"),
        "PREMIUM COLLECTED": cell(r, "PREMIUM COLLECTED", "Premium_Collected"),
        "PAYMENT METHOD": cell(r, "PAYMENT METHOD", "Payment_Method"),
        CURRENCY: cell(r, "CURRENCY") ?? "ZWG",
      };
    });
  }
}

{
  const name = sheet(/^INSURANCE ENPA/i);
  if (name) {
    outSheets["INSURANCE ENPA"] = rowsOf(wb.Sheets[name]).map((r) => {
      const agent = String(cell(r, "AGENT", "Agent", "Agent Name") ?? "").trim();
      return {
        "AGENT ID": agentIdFor(agent),
        AGENT: agent || null,
        DATE: excelDate(cell(r, "Date", "ISSUE DATE")),
        STATUS: cell(r, "STATUS"),
        "CANCELLED DATE": excelDate(cell(r, "Cancelled Date")),
        "POLICY NO": cell(r, "POLICY NO", "Policy_No"),
        "PREMIUM COLLECTED": cell(r, "PREMIUM COLLECTED", "Premium_Collected"),
        "POLICY COVER": cell(r, "POLICY COVER", "Policy Cover"),
        "PAYMENT METHOD": cell(r, "PAYMENT METHOD", "Payment_Method"),
        VRN: cell(r, "VRN"),
        LOCATION: cell(r, "LOCATION", "Location"),
        "INSURANCE COMPANY": cell(r, "INSURANCE COMPANY", "Insurance Company"),
        CURRENCY: cell(r, "CURRENCY") ?? "ZWG",
      };
    });
  }
}

{
  const name = sheet(/^ZINARA/i);
  if (name) {
    outSheets["ZINARA"] = rowsOf(wb.Sheets[name]).map((r) => {
      const account = String(cell(r, "USER1", "ZINARA ACCOUNT ID", "ZINARA ACCOUNT") ?? "").trim();
      const holder = account.includes(" - ") ? account.split(" - ")[1].trim() : "";
      const agent = String(cell(r, "AGENT NAME", "Agent Name") ?? "").trim() || titleCase(holder);
      return {
        "AGENT ID": bareZinara(account) || agentIdFor(agent),
        AGENT: agent || null,
        OFFICE: cell(r, "OFFICE"),
        "ZINARA ACCOUNT ID": account || null,
        "REGISTRATION NUMBER": cell(r, "REGISTRATION NUMBER", "REGISTRATIO NNUMBER", "VRN"),
        "PAYMENT METHOD": cell(r, "PAYMENT METHOD"),
        AMOUNT: cell(r, "AMOUNT", "PAYMENT AMOUNT"),
        CURRENCY: cell(r, "CURRENCY") ?? "ZWG",
      };
    });
  }
}

// NMB statement → deposit rows. Terminal code lives inside the narration
// ("MPOS/Purchase /X0319T16/Enpasent …/RRN:…") — pull it into AGENT ID.
{
  const name = sheet(/^NMB\b/i);
  if (name) {
    outSheets["NMB DEPOSITS"] = rowsOf(wb.Sheets[name]).map((r) => {
      const narration = String(cell(r, "Narration") ?? "").trim();
      const code = (narration.match(/\/([A-Z]\d{4}T\d{2})\//i) ?? [])[1]?.toUpperCase() ?? null;
      return {
        DATE: excelDate(cell(r, "Transaction Date", "Date")),
        "AGENT ID": code,
        "AGENT NAME": nameForCode(code),
        BANK: "NMB",
        AMOUNT: cell(r, "CreditAmount", "Credit", "Amount"),
        CURRENCY: nmbCurrency(code),
        REF: cell(r, "Ref. No.", "Ref", "Reference"),
        NARRATION: narration || null,
      };
    });
  }
}

// CBZ / FBC terminal list → deposit rows.
{
  const name = sheet(/^CBZ/i);
  if (name) {
    outSheets["CBZ & FBC DEPOSITS"] = rowsOf(wb.Sheets[name]).map((r) => {
      const tid = String(cell(r, "TERMINAL ID", "TID") ?? "").trim() || null;
      const bankRaw = String(cell(r, "BANK") ?? "").toUpperCase();
      return {
        DATE: excelDate(cell(r, "DATE", "Date")),
        "AGENT ID": tid,
        "AGENT NAME": nameForCode(tid),
        BANK: bankRaw.includes("FBC") ? "FBC" : "CBZ",
        AMOUNT: cell(r, "AMOUNT", "CreditAmount"),
        CURRENCY: bankRaw.includes("USD") || bankRaw.includes("US$") ? "USD" : "ZWG",
        REF: cell(r, "TRANSACTOR", "REF", "Ref"),
        NARRATION: cell(r, "NARRATION", "Narration"),
      };
    });
  }
}

// NBS pivot (TID × date columns) → deposit rows.
{
  const name = sheet(/^NBS/i);
  if (name) {
    const ws = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const [head = [], ...body] = grid;
    const dateCols = head
      .map((h, i) => ({ i, serial: typeof h === "number" ? h : null }))
      .filter((c) => c.serial && c.serial > 1 && c.serial < 60000);
    const rows = [];
    for (const r of body) {
      const tid = String(r[0] ?? "").trim();
      if (!tid) continue;
      for (const c of dateCols) {
        const amt = r[c.i];
        if (amt == null || amt === "-" || amt === "") continue;
        rows.push({
          DATE: excelDate(c.serial),
          "AGENT ID": tid,
          "AGENT NAME": nameForCode(tid),
          BANK: "NBS",
          AMOUNT: amt,
          CURRENCY: "ZWG",
          REF: null,
          NARRATION: null,
        });
      }
    }
    outSheets["NBS DEPOSITS"] = rows;
  }
}

// Alterations — two currency sheets, identical deposit-style columns.
for (const [src, dest, cur] of [
  [/^Alterations ZIG/i, "ALTERATIONS ZIG", "ZWG"],
  [/^Alterations Usd/i, "ALTERATIONS USD", "USD"],
]) {
  const name = sheet(src);
  if (!name) continue;
  outSheets[dest] = rowsOf(wb.Sheets[name]).map((r) => {
    const agent = String(cell(r, "Agent Name", "AGENT", "Agent") ?? "").trim();
    return {
      DATE: excelDate(cell(r, "Date", "DATE")),
      "AGENT ID": agentIdFor(agent),
      "AGENT NAME": agent || null,
      AMOUNT: cell(r, "Amount", "AMOUNT"),
      CURRENCY: cur,
      BANK: cell(r, "Bank", "BANK"),
      NARRATION: cell(r, "Narration", "NARRATION"),
    };
  });
}

/* --------------------------------------------------------------- write out */

const ORDER = [
  "INSURANCE ECO", "INSURANCE ENPA", "ZINARA",
  "NMB DEPOSITS", "CBZ & FBC DEPOSITS", "NBS DEPOSITS",
  "ALTERATIONS ZIG", "ALTERATIONS USD",
];
const COLS_FOR = (name) =>
  name === "INSURANCE ECO" ? COLS.insEco
    : name === "INSURANCE ENPA" ? COLS.insEnpa
    : name === "ZINARA" ? COLS.zinara
    : name.startsWith("ALTERATIONS") ? COLS.alteration
    : COLS.deposit;

const makeWs = (name, data) => {
  const cols = COLS_FOR(name);
  const ws = XLSX.utils.json_to_sheet(data, { header: cols });
  ws["!cols"] = cols.map((c) => ({ wch: Math.max(c.length + 4, 14) }));
  return ws;
};

const build = (names, data) => {
  const w = XLSX.utils.book_new();
  for (const n of names) XLSX.utils.book_append_sheet(w, makeWs(n, data[n] ?? []), n);
  return w;
};

// 1. Restructured data workbook — every canonical sheet.
XLSX.writeFile(build(ORDER, outSheets), join(OUT_DIR, "Agent Dumb (new format).xlsx"));

// 2/3. Blank per-module templates — shared sheets + that module's insurance.
const SHARED = ORDER.filter((n) => !/^INSURANCE/.test(n));
XLSX.writeFile(
  build(["INSURANCE ECO", ...SHARED], {}),
  join(OUT_DIR, "Agent Template - Econet.xlsx")
);
XLSX.writeFile(
  build(["INSURANCE ENPA", ...SHARED], {}),
  join(OUT_DIR, "Agent Template - Enpassent.xlsx")
);

/* ---------------------------------------------------------------- report */

console.log("Rebuilt:", join(OUT_DIR, "Agent Dumb (new format).xlsx"));
for (const n of ORDER) {
  const d = outSheets[n] ?? [];
  const noId = d.filter((r) => !r["AGENT ID"]).length;
  console.log(`  ${n.padEnd(20)} ${String(d.length).padStart(4)} rows${noId ? `  (${noId} without AGENT ID)` : ""}`);
}
console.log("Templates:", join(OUT_DIR, "Agent Template - Econet.xlsx"), "+ Agent Template - Enpassent.xlsx");
