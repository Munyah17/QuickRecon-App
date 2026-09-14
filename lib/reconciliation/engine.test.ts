import { runReconciliationEngine } from "./engine";
import type { SourceRow } from "./types";
import type { IdentityAlias } from "./types";

const agents = [
  { id: "AGT-000184", fullName: "Musa Zhou", openingPosition: 50_000 },
  { id: "AGT-000185", fullName: "Tafadzwa Chitumbura", openingPosition: 0 },
  { id: "AGT-000186", fullName: "Rumbidzai Moyo", openingPosition: 12_000 },
  { id: "AGT-000187", fullName: "Chenai Dube", openingPosition: 0 },
];

const aliases: IdentityAlias[] = [
  { scheme: "enpassent_user_id", value: "EP-101184", agentId: "AGT-000184" },
  { scheme: "icecash_id", value: "IC12345678", agentId: "AGT-000184" },
  { scheme: "enpassent_user_id", value: "EP-101185", agentId: "AGT-000185" },
  { scheme: "enpassent_user_id", value: "EP-101186", agentId: "AGT-000186" },
];

const insuranceSheet: SourceRow[] = [
  { "Agent ID": "EP-101184", "Agent Name": "Musa Zhou", Amount: 500_000, Currency: "ZWG", Ref: "R001", Date: "2026-09-01" },
  { "Agent ID": "EP-101185", "Agent Name": "Tafadzwa Chitumbura", Amount: 350_000, Currency: "ZWG", Ref: "R002", Date: "2026-09-02" },
  { "Agent ID": "EP-101186", "Agent Name": "Rumbidzai Moyo", Amount: 200_000, Currency: "ZWG", Ref: "R003", Date: "2026-09-03" },
  { "Agent ID": "EP-101184", "Agent Name": "Musa Zhou", Amount: 250_000, Currency: "ZWG", Ref: "R004", Date: "2026-09-10" },
  { "Agent ID": "EP-999999", "Agent Name": "Unknown Agent", Amount: 99_000, Currency: "ZWG", Ref: "R005", Date: "2026-09-05" },
  { "Agent Name": "Ghost Agent", Amount: 10_000, Currency: "ZWG", Ref: "R006", Date: "2026-09-06" },
];

const zinaraSheet: SourceRow[] = [
  { "Agent ID": "EP-101184", "Agent Name": "Musa Zhou", Amount: 80_000, Currency: "ZWG", Ref: "Z001", Date: "2026-09-01" },
  { "Agent ID": "EP-101185", "Agent Name": "Tafadzwa Chitumbura", Amount: 60_000, Currency: "ZWG", Ref: "Z002", Date: "2026-09-02" },
  { "Agent ID": "EP-101186", "Agent Name": "Rumbidzai Moyo", Amount: 40_000, Currency: "ZWG", Ref: "Z003", Date: "2026-09-03" },
];

const depositSheet: SourceRow[] = [
  { "Agent ID": "EP-101184", "Agent Name": "Musa Zhou", Amount: 700_000, Currency: "ZWG", Ref: "D001", Date: "2026-09-05" },
  { "Agent ID": "EP-101184", "Agent Name": "Musa Zhou", Amount: 700_000, Currency: "ZWG", Ref: "D001", Date: "2026-09-05" },
  { "Agent ID": "EP-101185", "Agent Name": "Tafadzwa Chitumbura", Amount: 350_000, Currency: "ZWG", Ref: "D002", Date: "2026-09-06" },
  { "Agent ID": "EP-101186", "Agent Name": "Rumbidzai Moyo", Amount: 200_000, Currency: "USD", Ref: "D003", Date: "2026-09-07" },
];

const sheets = {
  Insurance: insuranceSheet,
  ZINARA: zinaraSheet,
  Deposits: depositSheet,
};

const output = runReconciliationEngine({
  module: "enpassent",
  period: "2026-09",
  sheets,
  agents,
  aliases,
  thresholds: { attention: 100_000, warning: 1 },
  exchangeRates: { USD: 14.5 },
});

console.log("=== RECONCILIATION ENGINE SIMULATION ===\n");
console.log("Module:", output.module);
console.log("Period:", output.period);
console.log("\n--- STATS ---");
console.log(JSON.stringify(output.stats, null, 2));
console.log("\n--- EXCEPTIONS (" + output.exceptions.length + ") ---");
for (const e of output.exceptions) {
  console.log(`  [${e.severity.toUpperCase()}] ${e.type} @ ${e.sourceRef}: ${e.description}`);
}
console.log("\n--- AGENT RESULTS (" + output.results.length + ") ---");
for (const r of output.results) {
  console.log(`\n  Agent: ${r.agentName} (${r.agentId})`);
  console.log(`  Currency: ${r.currency}`);
  console.log(`  Opening: ${r.openingPosition}`);
  console.log(`  Insurance: ${r.insurance}`);
  console.log(`  ZINARA: ${r.zinara}`);
  console.log(`  Deposits: ${r.deposits}`);
  console.log(`  Adjustments: ${r.adjustments}`);
  console.log(`  Closing: ${r.closingPosition}`);
  console.log(`  Status: ${r.status}`);
  console.log(`  Records: ${r.recordCount}`);
}
console.log("\n=== SIMULATION COMPLETE ===");
