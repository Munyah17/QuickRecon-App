/**
 * Seeds a demo agent + demo reconciliation report (latest formats) into the
 * live QuickRecon Supabase project, then renders the real artifacts — the
 * multi-sheet workbook, PDF, Consolidated-A CSV, email HTML and SMS text —
 * using the actual lib/reconciliation/document.ts code (transpiled on the fly,
 * same trick as verify-adapters.mjs).
 *
 *   node scripts/seed-demo-agent.mjs
 *
 * Idempotent: re-running upserts the same rows (fixed demo IDs) and refreshes
 * the artifacts under demo-artifacts/.
 *
 * Demo agent:  AGT-900001 — "Tatenda Moyo" (Borrowdale, Harare)
 *   - no portal login (user_id stays null — reports go out via email/WhatsApp)
 *   - 2 booths-side records: booth, booth modules, payment methods, aliases
 *   - a submitted KYC submission + a resolved recon exception for realism
 * Demo report: RCN-enpassent-2026-09-DEMO — Enpassent, period 2026-09,
 *   dual-currency (ZiG + USD) reconciliation_documents in the Consolidated-A
 *   layout, a published reconciliations row, lines, a delivery record and a
 *   distribution job so every surface (profile, recon detail, distributions)
 *   shows the issue.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

// --- env -------------------------------------------------------------------
const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// --- REST helper (service role bypasses RLS) ---------------------------------
async function sb(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
const upsert = (table, rows, onConflict) =>
  sb(`${table}${onConflict ? `?on_conflict=${onConflict}` : ""}`, {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
const del = (table, filter) => sb(`${table}?${filter}`, { method: "DELETE" });

// --- Demo identity -----------------------------------------------------------
const AGENT_ID = "AGT-900001";
const AGENT = {
  id: AGENT_ID,
  user_id: null, // field agent — no portal login, reports by email/WhatsApp
  full_name: "Tatenda Moyo",
  email: "demo.tatenda.moyo@example.com",
  phone: "+263771200345",
  province: "Harare",
  location: "Borrowdale",
  status: "active",
  national_id: "63-2244556-K-77",
  icecash_id: "ICE-DEMO-900001",
  kyc_status: "verified",
  joined_at: "2026-06-01",
  opening_position: 1250.0,
};
const BOOTH_ID = "BTH-0901";
const PERIOD = "2026-09";
const MODULE = "enpassent";
const BATCH_ID = `RCN-${MODULE}-${PERIOD}-DEMO`;
const BATCH_USD_ID = `RCN-${MODULE}-${PERIOD}-DEMO-USD`;
const RECON_ID = "RCN-2609-DEMO";
const RECON_USD_ID = "RCN-2609-DEMO-USD";

// --- Demo figures ------------------------------------------------------------
// Engine math: netInsurance = insurance - commission; premiumCover = netInsurance
// totalExpected = netInsurance + zinara + pds + openingVariance
// closingVariance = totalExpected - deposits + adjustments; closingPosition = same
const zig = {
  agentId: AGENT_ID,
  agentName: AGENT.full_name,
  module: MODULE,
  period: PERIOD,
  currency: "ZWG",
  generatedAt: new Date().toISOString(),
  openingVariance: 1250.0,
  insurance: 96450.5,
  premiumCover: 87805.47,
  commission: 8645.03,
  netInsurance: 87805.47,
  zinara: 142800.0,
  pds: 1240.0,
  totalExpected: 233095.47,
  bankDeposits: { NMB: 148200, NBS: 34560, Ecocash: 22980, CBZ: 18420, Transfers: 6435.47 },
  deposits: 230595.47,
  adjustments: -500.0,
  closingVariance: 2000.0,
  closingPosition: 2000.0,
  status: "warning",
  transactions: [
    // Insurance sales — sum 96,450.50
    { date: "2026-09-02", agentName: AGENT.full_name, amount: 8450.0, currency: "ZWG", reference: "INS-2609-001", category: "insurance", vrn: "AEF-2231", insuranceCompany: "Old Mutual", rtaAmount: 1180, narration: "Motor comprehensive" },
    { date: "2026-09-05", agentName: AGENT.full_name, amount: 6720.5, currency: "ZWG", reference: "INS-2609-002", category: "insurance", vrn: "AFZ-9087", insuranceCompany: "Alliance Health", rtaAmount: 980, narration: "Motor third party" },
    { date: "2026-09-09", agentName: AGENT.full_name, amount: 12300.0, currency: "ZWG", reference: "INS-2609-003", category: "insurance", vrn: "AGA-4410", insuranceCompany: "Old Mutual", rtaAmount: 1540, narration: "Motor comprehensive" },
    { date: "2026-09-14", agentName: AGENT.full_name, amount: 7980.0, currency: "ZWG", reference: "INS-2609-004", category: "insurance", vrn: "AFJ-1188", insuranceCompany: "Zimnat", rtaAmount: 1060, narration: "Motor third party" },
    { date: "2026-09-18", agentName: AGENT.full_name, amount: 15400.0, currency: "ZWG", reference: "INS-2609-005", category: "insurance", vrn: "AGH-7620", insuranceCompany: "Old Mutual", rtaAmount: 1980, narration: "Motor comprehensive" },
    { date: "2026-09-22", agentName: AGENT.full_name, amount: 21600.0, currency: "ZWG", reference: "INS-2609-006", category: "insurance", vrn: "AGK-3350", insuranceCompany: "CBZ Insurance", rtaAmount: 2620, narration: "Motor comprehensive — fleet" },
    { date: "2026-09-27", agentName: AGENT.full_name, amount: 24000.0, currency: "ZWG", reference: "INS-2609-007", category: "insurance", vrn: "AFA-0912", insuranceCompany: "Old Mutual", rtaAmount: 2910, narration: "Motor comprehensive — fleet" },
    // ZINARA — sum 142,800
    { date: "2026-09-03", agentName: AGENT.full_name, amount: 28560.0, currency: "ZWG", reference: "ZIN-2609-011", category: "zinara", zinaraAccountId: "ZNR-88-104521", vrn: "AEF-2231", paymentMethod: "Ecocash" },
    { date: "2026-09-08", agentName: AGENT.full_name, amount: 31200.0, currency: "ZWG", reference: "ZIN-2609-012", category: "zinara", zinaraAccountId: "ZNR-88-104522", vrn: "AFZ-9087", paymentMethod: "NMB swipe" },
    { date: "2026-09-15", agentName: AGENT.full_name, amount: 26400.0, currency: "ZWG", reference: "ZIN-2609-013", category: "zinara", zinaraAccountId: "ZNR-88-104540", vrn: "AFJ-1188", paymentMethod: "Ecocash" },
    { date: "2026-09-21", agentName: AGENT.full_name, amount: 28560.0, currency: "ZWG", reference: "ZIN-2609-014", category: "zinara", zinaraAccountId: "ZNR-88-104588", vrn: "AGH-7620", paymentMethod: "NBS transfer" },
    { date: "2026-09-28", agentName: AGENT.full_name, amount: 28080.0, currency: "ZWG", reference: "ZIN-2609-015", category: "zinara", zinaraAccountId: "ZNR-88-104601", vrn: "AFA-0912", paymentMethod: "CBZ transfer" },
    // Deposits — sum 230,595.47
    { date: "2026-09-10", agentName: AGENT.full_name, amount: 84200.0, currency: "ZWG", bankAccount: "NMB", reference: "NMB-DEP-4401", category: "deposit", narration: "Weekly banking" },
    { date: "2026-09-24", agentName: AGENT.full_name, amount: 64000.0, currency: "ZWG", bankAccount: "NMB", reference: "NMB-DEP-4402", category: "deposit", narration: "Weekly banking" },
    { date: "2026-09-17", agentName: AGENT.full_name, amount: 34560.0, currency: "ZWG", bankAccount: "NBS", reference: "NBS-DEP-1188", category: "deposit", narration: "ZINARA remittance" },
    { date: "2026-09-04", agentName: AGENT.full_name, amount: 7660.0, currency: "ZWG", bankAccount: "Ecocash", reference: "ECO-T4472586", category: "deposit", narration: "T4472586" },
    { date: "2026-09-12", agentName: AGENT.full_name, amount: 8320.0, currency: "ZWG", bankAccount: "Ecocash", reference: "ECO-T2071716", category: "deposit", narration: "T2071716" },
    { date: "2026-09-26", agentName: AGENT.full_name, amount: 7000.0, currency: "ZWG", bankAccount: "Ecocash", reference: "ECO-T9610489", category: "deposit", narration: "T9610489" },
    { date: "2026-09-29", agentName: AGENT.full_name, amount: 18420.0, currency: "ZWG", bankAccount: "CBZ", reference: "CBZ-DEP-0813", category: "deposit", narration: "CBZ deposit" },
    { date: "2026-09-30", agentName: AGENT.full_name, amount: 6435.47, currency: "ZWG", bankAccount: "Transfers", reference: "TRF-2609-77", category: "deposit", narration: "Internal transfer" },
    // Alteration — -500
    { date: "2026-09-29", agentName: AGENT.full_name, amount: -500.0, currency: "ZWG", reference: "ADJ-2609-01", category: "adjustment", narration: "Duplicate insurance posting reversed (INS-2609-003 partial)" },
  ],
  lines: [
    { item: "Insurance", expected: 96450.5, actual: 96450.5, variance: 0 },
    { item: "ZINARA", expected: 142800, actual: 142800, variance: 0 },
    { item: "Deposits", expected: 233095.47, actual: 230595.47, variance: 2500 },
    { item: "Adjustments", expected: -500, actual: -500, variance: 0 },
  ],
};
const usd = {
  agentId: AGENT_ID,
  agentName: AGENT.full_name,
  module: MODULE,
  period: PERIOD,
  currency: "USD",
  generatedAt: zig.generatedAt,
  openingVariance: 0,
  insurance: 4820.0,
  premiumCover: 4338.0,
  commission: 482.0,
  netInsurance: 4338.0,
  zinara: 960.0,
  pds: 0,
  totalExpected: 5298.0,
  bankDeposits: { "USD Deposits": 5298.0 },
  deposits: 5298.0,
  adjustments: 0,
  closingVariance: 0,
  closingPosition: 0,
  status: "success",
  transactions: [
    { date: "2026-09-06", agentName: AGENT.full_name, amount: 1950.0, currency: "USD", reference: "INS-USD-2609-01", category: "insurance", vrn: "AFK-5510", insuranceCompany: "Old Mutual", rtaAmount: 210, narration: "Motor comprehensive USD" },
    { date: "2026-09-16", agentName: AGENT.full_name, amount: 1320.0, currency: "USD", reference: "INS-USD-2609-02", category: "insurance", vrn: "AGL-8840", insuranceCompany: "Zimnat", rtaAmount: 150, narration: "Motor third party USD" },
    { date: "2026-09-25", agentName: AGENT.full_name, amount: 1550.0, currency: "USD", reference: "INS-USD-2609-03", category: "insurance", vrn: "AFB-2210", insuranceCompany: "CBZ Insurance", rtaAmount: 170, narration: "Motor comprehensive USD" },
    { date: "2026-09-11", agentName: AGENT.full_name, amount: 480.0, currency: "USD", reference: "ZIN-USD-2609-01", category: "zinara", zinaraAccountId: "ZNR-88-105110", vrn: "AFK-5510", paymentMethod: "USD cash" },
    { date: "2026-09-23", agentName: AGENT.full_name, amount: 480.0, currency: "USD", reference: "ZIN-USD-2609-02", category: "zinara", zinaraAccountId: "ZNR-88-105144", vrn: "AFB-2210", paymentMethod: "USD cash" },
    { date: "2026-09-30", agentName: AGENT.full_name, amount: 5298.0, currency: "USD", bankAccount: "USD Deposits", reference: "USD-DEP-0903", category: "deposit", narration: "USD banking" },
  ],
  lines: [
    { item: "Insurance", expected: 4820, actual: 4820, variance: 0 },
    { item: "ZINARA", expected: 960, actual: 960, variance: 0 },
    { item: "Deposits", expected: 5298, actual: 5298, variance: 0 },
    { item: "Adjustments", expected: 0, actual: 0, variance: 0 },
  ],
};
const DOCS = [zig, usd];

// --- Transpile lib/reconciliation/document.ts + deps --------------------------
// document.ts imports "@/lib/format" (formatMoney) and "./types" (BANK_CHANNELS).
// Transpile all three into scripts/.gen/ so relative + bare imports resolve.
function transpileInto(srcPath, outDir, outName, rewrite = {}) {
  const src = readFileSync(srcPath, "utf8");
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [from, to] of Object.entries(rewrite)) {
    js = js.split(`"${from}"`).join(`"${to}"`).split(`'${from}'`).join(`'${to}'`);
  }
  const out = join(outDir, outName);
  writeFileSync(out, js);
  return out;
}

const GEN = "scripts/.gen";
mkdirSync(GEN, { recursive: true });
transpileInto("lib/format.ts", GEN, "format.mjs");
transpileInto("lib/reconciliation/types.ts", GEN, "recon-types.mjs");
const docPath = transpileInto("lib/reconciliation/document.ts", GEN, "document.mjs", {
  "@/lib/format": "./format.mjs",
  "./types": "./recon-types.mjs",
  // Node ESM resolves bare file imports strictly — extension required.
  "pdfmake/build/pdfmake": "pdfmake/build/pdfmake.js",
  "pdfmake/build/vfs_fonts": "pdfmake/build/vfs_fonts.js",
});
// pdfmake sniffs `localStorage`; Node 22+ exposes an experimental stub that
// emits warnings and can stall getBuffer — hide it for the generator run.
try {
  Object.defineProperty(globalThis, "localStorage", {
    value: undefined,
    writable: true,
    configurable: true,
  });
} catch {
  /* non-configurable — leave as-is */
}
const {
  documentToCSV,
  documentsToWorkbook,
  documentsToPDF,
  documentToHTML,
  documentToSMS,
} = await import(pathToFileURL(docPath).href);

// Fill the summary text the engine would produce.
for (const d of DOCS) {
  const fm = new Intl.NumberFormat("en-ZW", { minimumFractionDigits: 2 }).format(
    Math.abs(d.closingVariance)
  );
  const cur = d.currency === "USD" ? "USD" : "ZiG";
  d.summaryText =
    d.status === "success"
      ? `All figures reconciled. Closing variance is ${cur} ${fm}.`
      : d.status === "warning"
        ? `A variance of ${cur} ${fm} was detected. Please review the attached detail.`
        : `A significant variance of ${cur} ${fm} requires attention before the next period.`;
}

console.log("Seeding demo agent + report into", SUPABASE_URL);

// 0. Resolve a staff profile for created_by / approved_by / delivered_by.
const owners = await sb(
  `profiles?role=eq.super_admin&select=id&limit=1`
);
if (!owners?.length) throw new Error("No super_admin profile found — sign in once first.");
const OWNER = owners[0].id;

// 1. Agent + identity surface.
await upsert("agents", AGENT);
console.log("  agents", AGENT_ID);

await upsert("agent_external_ids", [
  { agent_id: AGENT_ID, scheme: "enpassent_user_id", value: "ENP-99012" },
  { agent_id: AGENT_ID, scheme: "econet_id", value: "ECOM-55301" },
  { agent_id: AGENT_ID, scheme: "icecash_id", value: AGENT.icecash_id },
], "scheme,value");
await upsert("agent_modules", [
  { agent_id: AGENT_ID, module: "enpassent", enabled: true, updated_by: OWNER },
  { agent_id: AGENT_ID, module: "econet-moovah", enabled: true, updated_by: OWNER },
]);
console.log("  aliases + modules");

await upsert("booths", {
  id: BOOTH_ID,
  agent_id: AGENT_ID,
  name: "Borrowdale Village Kiosk",
  location: "Borrowdale",
  province: "Harare",
  status: "active",
});
await upsert("booth_modules", [
  { booth_id: BOOTH_ID, module: "enpassent" },
  { booth_id: BOOTH_ID, module: "econet-moovah" },
]);
console.log("  booth", BOOTH_ID);

await del("payment_methods", `owner_type=eq.agent&owner_id=eq.${AGENT_ID}`);
await upsert("payment_methods", { owner_type: "agent", owner_id: AGENT_ID, kind: "bank", label: "CBZ — Current", bank_name: "CBZ Bank", branch_code: "6014", account_name: "Tatenda Moyo", account_number: "01234567890123", currency: "ZWG", is_primary: true, created_by: OWNER });
await upsert("payment_methods", { owner_type: "agent", owner_id: AGENT_ID, kind: "mobile_money", label: "EcoCash", provider: "EcoCash", mobile_number: AGENT.phone, currency: "ZWG", is_primary: false, created_by: OWNER });
console.log("  payment methods");

// 2. Realistic demo extras.
await upsert("submissions", {
  id: "SUB-DEMO-90001",
  agent_id: AGENT_ID,
  module: "enpassent",
  type: "kyc",
  title: "Proof of residence — Borrowdale",
  description: "ZESA bill dated August 2026 uploaded for KYC refresh.",
  status: "under_review",
});
console.log("  submission");

// 3. Reconciliation batch + published recon + lines.
await upsert("reconciliation_batches", {
  id: BATCH_ID,
  module: MODULE,
  period: PERIOD,
  status: "published",
  created_by: OWNER,
  approved_by: OWNER,
  approved_at: new Date().toISOString(),
  published_at: new Date().toISOString(),
});
await upsert("reconciliation_exceptions", {
  id: "EXC-DEMO-9001",
  batch_id: BATCH_ID,
  module: MODULE,
  agent_id: AGENT_ID,
  type: "unmatched_agent",
  severity: "low",
  source_ref: "ECO-T9610489",
  description: "Ecocash narration T9610489 initially unmatched — resolved via agent alias ICE-DEMO-900001.",
  status: "resolved",
  resolution: "Matched to AGT-900001 through enpassent_user_id alias.",
  resolved_by: OWNER,
  resolved_at: new Date().toISOString(),
});
console.log("  resolved exception");
// USD currency doc needs its own batch — reconciliation_documents is
// unique(batch_id, agent_id), i.e. one currency doc per agent per batch.
await upsert("reconciliation_batches", {
  id: BATCH_USD_ID,
  module: MODULE,
  period: PERIOD,
  status: "published",
  created_by: OWNER,
  approved_by: OWNER,
  approved_at: new Date().toISOString(),
  published_at: new Date().toISOString(),
});
await upsert("reconciliations", {
  id: RECON_ID,
  batch_id: BATCH_ID,
  agent_id: AGENT_ID,
  module: MODULE,
  period: PERIOD,
  status: "published",
  currency: "ZWG",
  opening_position: zig.openingVariance,
  insurance: zig.insurance,
  zinara: zig.zinara,
  deposits: zig.deposits,
  adjustments: zig.adjustments,
  closing_position: zig.closingPosition,
  version: 1,
  published_at: new Date().toISOString(),
});
await upsert("reconciliations", {
  id: RECON_USD_ID,
  batch_id: BATCH_USD_ID,
  agent_id: AGENT_ID,
  module: MODULE,
  period: PERIOD,
  status: "published",
  currency: "USD",
  opening_position: usd.openingVariance,
  insurance: usd.insurance,
  zinara: usd.zinara,
  deposits: usd.deposits,
  adjustments: usd.adjustments,
  closing_position: usd.closingPosition,
  version: 1,
  published_at: new Date().toISOString(),
});
const toLine = (reconId, l) => ({
  reconciliation_id: reconId,
  item: l.item,
  category: l.item === "Deposits" ? "deposit" : l.item === "Adjustments" ? "adjustment" : l.item.toLowerCase() === "zinara" ? "zinara" : "insurance",
  expected: l.expected,
  actual: l.actual,
  variance: l.variance,
  status: l.variance === 0 ? "matched" : "variance",
});
await del("reconciliation_lines", `reconciliation_id=in.(${RECON_ID},${RECON_USD_ID})`);
await upsert("reconciliation_lines", [
  ...zig.lines.map((l) => toLine(RECON_ID, l)),
  ...usd.lines.map((l) => toLine(RECON_USD_ID, l)),
]);
console.log("  batch + reconciliation + lines");

// 4. The issued documents — Consolidated-A layout, csv_text from real code.
await upsert("reconciliation_documents", DOCS.map((d) => ({
  batch_id: d.currency === "USD" ? BATCH_USD_ID : BATCH_ID,
  agent_id: d.agentId,
  agent_name: d.agentName,
  module: d.module,
  period: d.period,
  currency: d.currency,
  opening_variance: d.openingVariance,
  insurance: d.insurance,
  premium_cover: d.premiumCover,
  commission: d.commission,
  net_insurance: d.netInsurance,
  zinara: d.zinara,
  pds: d.pds,
  total_expected: d.totalExpected,
  bank_deposits: d.bankDeposits,
  deposits: d.deposits,
  adjustments: d.adjustments,
  closing_variance: d.closingVariance,
  closing_position: d.closingPosition,
  status: d.status,
  transactions: d.transactions,
  summary_text: d.summaryText,
  csv_text: documentToCSV(d),
  created_at: d.generatedAt,
})), "batch_id,agent_id");
console.log("  reconciliation_documents ×2 (ZiG + USD)");

// 5. Issue trail — report row, delivery audit, distribution job.
await del("reports", `agent_id=eq.${AGENT_ID}&period=eq.${PERIOD}`);
await upsert("reports", {
  agent_id: AGENT_ID,
  reconciliation_id: RECON_ID,
  module: MODULE,
  period: PERIOD,
  type: "consolidated",
  title: `Consolidated Revenue Report — ${PERIOD}`,
  created_by: OWNER,
});
await del("reconciliation_deliveries", `agent_id=eq.${AGENT_ID}&batch_id=in.(${BATCH_ID},${BATCH_USD_ID})`);
await upsert("reconciliation_deliveries", [BATCH_ID, BATCH_USD_ID].map((b) => ({
  batch_id: b,
  agent_id: AGENT_ID,
  channels: ["email", "whatsapp"],
  status: "sent",
  delivered_by: OWNER,
})));
await upsert("distribution_jobs", {
  id: "DJ-DEMO-2026-09",
  period: PERIOD,
  module: MODULE,
  channels: ["email", "whatsapp"],
  message: "September 2026 consolidated reconciliation — demo issue",
  status: "sent",
  created_by: OWNER,
});
const job = await sb(`distribution_recipients?job_id=eq.DJ-DEMO-2026-09&agent_id=eq.${AGENT_ID}`);
if (!job?.length) {
  await upsert("distribution_recipients", [
    { job_id: "DJ-DEMO-2026-09", agent_id: AGENT_ID, channel: "email", address: AGENT.email, status: "delivered", sent_at: new Date().toISOString(), delivered_at: new Date().toISOString() },
    { job_id: "DJ-DEMO-2026-09", agent_id: AGENT_ID, channel: "whatsapp", address: AGENT.phone, status: "delivered", sent_at: new Date().toISOString(), delivered_at: new Date().toISOString() },
  ]);
}
console.log("  reports + delivery audit + distribution job");

// 6. Render the artifacts with the REAL latest-format generators.
const OUT = "demo-artifacts";
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, `${MODULE}-reconciliation-${AGENT_ID}-${PERIOD}.xlsx`), await documentsToWorkbook(DOCS));
writeFileSync(join(OUT, `${MODULE}-reconciliation-${AGENT_ID}-${PERIOD}.pdf`), await documentsToPDF(DOCS));
writeFileSync(join(OUT, `consolidated-a-${AGENT_ID}-${PERIOD}.csv`), documentToCSV(zig) + "\n" + documentToCSV(usd).split("\n").slice(1).join("\n"));
writeFileSync(join(OUT, `email-preview-${AGENT_ID}-${PERIOD}.html`), documentToHTML(zig));
writeFileSync(join(OUT, `sms-${AGENT_ID}-${PERIOD}.txt`), DOCS.map(documentToSMS).join("\n\n"));
console.log(`  artifacts → ${OUT}/`);

rmSync(GEN, { recursive: true, force: true });
console.log("\nDone. Demo agent:", AGENT_ID, "· batch:", BATCH_ID);
console.log(`Verify: agent profile /app/agents/${AGENT_ID} · recon /app/reconciliation/${RECON_ID}`);
