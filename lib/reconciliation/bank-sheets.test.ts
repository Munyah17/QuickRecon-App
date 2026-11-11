import assert from "node:assert/strict";
import { test } from "node:test";
import { runReconciliationEngine } from "./engine";
import type { IdentityAlias, SourceRow } from "./types";

const agents = [{ id: "AGT-000001", fullName: "Test Agent", openingPosition: 0 }];
const aliases: IdentityAlias[] = [
  { scheme: "cbz_pos", value: "89000001", agentId: "AGT-000001" },
  { scheme: "fbc_pos", value: "29000001", agentId: "AGT-000001" },
  { scheme: "steward_pos", value: "SBM90001", agentId: "AGT-000001" },
  { scheme: "nmb_pos", value: "X0000T01", agentId: "AGT-000001" },
];

const run = (sheets: Record<string, SourceRow[]>) =>
  runReconciliationEngine({ module: "econet-moovah", period: "2026-10", sheets, agents, aliases });

const pos = (bank: string, terminal: string, transactor: number, amount: number): SourceRow => ({
  BANK: bank,
  DATE: "2026-09-01",
  AMOUNT: amount,
  CURRENCY: "ZWG",
  "AGENT NAME": "TEST AGENT",
  TRANSACTOR: transactor,
  "TERMINAL ID": terminal,
});

const nmb = (ref: number, rrn: string, amount: number): SourceRow => ({
  "Ref. No.": ref,
  Narration: `MPOS/Purchase /X0000T01/Test Merchant/ RRN:${rrn}/5890XXXX`,
  DebitAmount: "-",
  CreditAmount: amount,
  "Transaction Date": "2026-09-02",
});

test("POS rows sharing a terminal and amount are separate transactions", () => {
  const out = run({
    "POS ZIG": [
      pos("CBZ ZIG", "89000001", 1, 100),
      pos("CBZ ZIG", "89000001", 2, 100),
      pos("CBZ ZIG", "89000001", 3, 100),
    ],
  });
  assert.equal(out.stats.duplicates, 0);
  assert.equal(out.results[0].deposits, 300);
});

test("a repeated POS transaction id is still excluded as a duplicate", () => {
  const out = run({
    "POS ZIG": [pos("CBZ ZIG", "89000001", 1, 100), pos("CBZ ZIG", "89000001", 1, 100)],
  });
  assert.equal(out.stats.duplicates, 1);
  assert.equal(out.results[0].deposits, 100);
});

test("POS rows are bucketed by the bank each row names", () => {
  const out = run({
    "POS ZIG": [
      pos("CBZ ZIG", "89000001", 1, 100),
      pos("CBZ ZIG ON BANK STATEMENT ONLY", "89000001", 2, 10),
      pos("FBC ZIG", "29000001", 3, 40),
      pos("TNC ZIG", "SBM90001", 4, 25),
    ],
  });
  assert.deepEqual(out.results[0].bankDeposits, { CBZ: 110, FBC: 40, STEWARD: 25 });
  assert.equal(out.results[0].deposits, 175);
  assert.equal(out.exceptions.filter((e) => e.type === "unrecognised_payment_source").length, 0);
});

test("NMB rows sharing a Ref. No. and amount but not an RRN are both counted", () => {
  const out = run({
    "Nmb Zig": [nmb(1723, "000347573320", 2925), nmb(1723, "000347854865", 2925)],
  });
  assert.equal(out.stats.duplicates, 0);
  assert.equal(out.results[0].deposits, 5850);
});

test("an NMB row repeated with the same Ref. No. and RRN is still a duplicate", () => {
  const out = run({
    "Nmb Zig": [nmb(1723, "000347573320", 2925), nmb(1723, "000347573320", 2925)],
  });
  assert.equal(out.stats.duplicates, 1);
  assert.equal(out.results[0].deposits, 2925);
});
