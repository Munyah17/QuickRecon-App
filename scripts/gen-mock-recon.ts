/**
 * Generate mock reconciliation documents through the REAL export pipeline so
 * the workbook/CSV/PDF layout can be verified without touching the database.
 *
 *   npx -y tsx scripts/gen-mock-recon.ts
 *
 * Output lands in ./mock-exports/
 */
import { writeFileSync, mkdirSync } from "node:fs";
import {
  documentToCSV,
  documentsToWorkbook,
  batchToWorkbook,
  documentsToPDF,
  type AgentReconDocument,
} from "../lib/reconciliation/document";
import type { TransactionDetail } from "../lib/reconciliation/types";

const now = new Date().toISOString();
const agent = { agentId: "AGT-000001", agentName: "Musa Zhou" };

const tx = (t: Partial<TransactionDetail> & Pick<TransactionDetail, "amount" | "reference">): TransactionDetail => ({
  agentName: agent.agentName,
  date: "2026-10-14",
  ...t,
});

const zigDoc: AgentReconDocument = {
  ...agent,
  module: "enpassent",
  period: "2026-10",
  currency: "ZWG",
  generatedAt: now,
  openingVariance: 12_400,
  insurance: 61_000,
  premiumCover: 54_900,
  commission: 6_100,
  netInsurance: 54_900,
  zinara: 18_750,
  pds: 2_430,
  insurancePds: 1_580,
  zinaraPds: 850,
  totalExpected: 76_080,
  bankDeposits: {
    Ecocash: 52_300,
    CBZ: 12_000,
    NBS: 3_090,
    STEWARD: 4_500,
    NMB: 2_200,
    Transfers: 9_700,
  },
  deposits: 83_790,
  adjustments: -450,
  closingVariance: 7_260,
  closingPosition: 19_660,
  status: "success",
  transactions: [
    tx({ amount: 11_000, category: "insurance", reference: "POL-88231", vrn: "AFG 4821", insuranceCompany: "Old Mutual", rtaAmount: 550, narration: "Comprehensive motor" }),
    tx({ amount: 24_000, category: "insurance", reference: "POL-88258", vrn: "AGP 1193", insuranceCompany: "Zimnat", rtaAmount: 1_200, narration: "Comprehensive motor" }),
    tx({ amount: 26_000, category: "insurance", reference: "POL-88277", vrn: "AEW 7750", insuranceCompany: "Credsure", rtaAmount: 1_300, narration: "Third party + RTA" }),
    tx({ amount: 9_600, category: "zinara", reference: "ZNR-11402", vrn: "AFG 4821", zinaraAccountId: "ZNR-8841", paymentMethod: "Ecocash" }),
    tx({ amount: 9_150, category: "zinara", reference: "ZNR-11433", vrn: "AGP 1193", zinaraAccountId: "ZNR-9027", paymentMethod: "CBZ" }),
    tx({ amount: 32_000, category: "deposit", reference: "ECO-5512091", bankAccount: "Ecocash", bankChannel: "Ecocash", narration: "Float remittance" }),
    tx({ amount: 20_300, category: "deposit", reference: "ECO-5513377", bankAccount: "Ecocash", bankChannel: "Ecocash", narration: "Float remittance" }),
    tx({ amount: 12_000, category: "deposit", reference: "CBZ:8841", bankAccount: "CBZ", bankChannel: "CBZ", narration: "POS settlement" }),
    tx({ amount: 3_090, category: "deposit", reference: "NBS:77210", bankAccount: "NBS", bankChannel: "NBS", narration: "Terminal settlement" }),
    tx({ amount: 4_500, category: "deposit", reference: "STW-3391", bankAccount: "Steward", bankChannel: "STEWARD", narration: "Branch deposit" }),
    tx({ amount: 2_200, category: "deposit", reference: "NMB:T17", bankAccount: "NMB", bankChannel: "NMB", narration: "MPOS N1411T17" }),
    tx({ amount: 9_700, category: "deposit", reference: "TRF-0021", bankAccount: "Bank Transfer", bankChannel: "Transfers", narration: "Inter-bank transfer" }),
    tx({ amount: -450, category: "adjustment", reference: "ADJ-118", narration: "Reversal — duplicate premium", vrn: "AGP 1193" }),
  ],
  lines: [
    { item: "Insurance premiums", expected: 61_000, actual: 61_000, variance: 0 },
    { item: "ZINARA licensing", expected: 18_750, actual: 18_750, variance: 0 },
    { item: "Deposits remitted", expected: 76_080, actual: 83_790, variance: 7_710 },
    { item: "Alterations", expected: 0, actual: -450, variance: -450 },
  ],
  summaryText:
    "Musa Zhou — October 2026 (ZiG). Total expected ZiG 76,080.00 against deposits of ZiG 83,790.00; closing variance ZiG 7,260.00 including opening position ZiG 12,400.00.",
};

const usdDoc: AgentReconDocument = {
  ...agent,
  module: "enpassent",
  period: "2026-10",
  currency: "USD",
  generatedAt: now,
  openingVariance: -220,
  insurance: 3_850,
  premiumCover: 3_465,
  commission: 385,
  netInsurance: 3_465,
  zinara: 640,
  pds: 96,
  insurancePds: 74,
  zinaraPds: 22,
  totalExpected: 4_201,
  bankDeposits: {
    "USD Deposits": 2_900,
    "CBZ USD": 1_100,
    "NMB USD": 310,
  },
  deposits: 4_310,
  adjustments: 0,
  closingVariance: -111,
  closingPosition: -331,
  status: "warning",
  transactions: [
    tx({ amount: 2_300, category: "insurance", reference: "POL-U112", vrn: "AFB 3310", insuranceCompany: "Old Mutual", rtaAmount: 115, currency: "USD", narration: "Comprehensive motor USD" }),
    tx({ amount: 1_550, category: "insurance", reference: "POL-U118", vrn: "AHX 9021", insuranceCompany: "Zimnat", rtaAmount: 78, currency: "USD", narration: "Comprehensive motor USD" }),
    tx({ amount: 640, category: "zinara", reference: "ZNR-U441", vrn: "AFB 3310", zinaraAccountId: "ZNR-8841", paymentMethod: "USD Deposits", currency: "USD" }),
    tx({ amount: 1_800, category: "deposit", reference: "USD-1181", bankAccount: "USD Deposits", bankChannel: "USD Deposits", currency: "USD", usdAmount: 1_800, narration: "Cash USD deposit" }),
    tx({ amount: 1_100, category: "deposit", reference: "USD-1219", bankAccount: "USD Deposits", bankChannel: "USD Deposits", currency: "USD", usdAmount: 1_100, narration: "Cash USD deposit" }),
    tx({ amount: 1_100, category: "deposit", reference: "CBZUSD:9012", bankAccount: "CBZ USD", bankChannel: "CBZ USD", currency: "USD", usdAmount: 1_100, narration: "CBZ nostro settlement" }),
    tx({ amount: 310, category: "deposit", reference: "NMBU:T09", bankAccount: "NMB USD", bankChannel: "NMB USD", currency: "USD", usdAmount: 310, narration: "MPOS USD T09" }),
  ],
  lines: [
    { item: "Insurance premiums", expected: 3_850, actual: 3_850, variance: 0 },
    { item: "ZINARA licensing", expected: 640, actual: 640, variance: 0 },
    { item: "Deposits remitted", expected: 4_201, actual: 4_310, variance: 109 },
    { item: "Alterations", expected: 0, actual: 0, variance: 0 },
  ],
  summaryText:
    "Musa Zhou — October 2026 (USD). Total expected USD 4,201.00 against deposits of USD 4,310.00; closing variance -USD 111.00 including opening position -USD 220.00.",
};

const docs = [usdDoc, zigDoc];

async function main() {
  mkdirSync("mock-exports", { recursive: true });

  writeFileSync("mock-exports/mock-recon-MusaZhou-2026-10.xlsx", await documentsToWorkbook(docs));
  writeFileSync("mock-exports/mock-recon-batch-summary.xlsx", await batchToWorkbook(docs));
  writeFileSync("mock-exports/mock-recon-MusaZhou-2026-10-ZiG.csv", documentToCSV(zigDoc));
  writeFileSync("mock-exports/mock-recon-MusaZhou-2026-10-USD.csv", documentToCSV(usdDoc));
  try {
    writeFileSync("mock-exports/mock-recon-MusaZhou-2026-10.pdf", await documentsToPDF(docs));
    console.log("PDF written");
  } catch (e) {
    console.log("PDF skipped:", (e as Error).message);
  }
  console.log("Mock exports written to mock-exports/");
}

main().catch((e) => { console.error(e); process.exit(1); });
