import { formatMoney } from "@/lib/format";
import type { Currency } from "@/types";
import type { AgentReconResult, EngineOutput } from "./types";

export interface AgentReconDocument {
  agentId: string;
  agentName: string;
  module: string;
  period: string;
  currency: Currency;
  generatedAt: string;
  openingPosition: number;
  insurance: number;
  zinara: number;
  deposits: number;
  adjustments: number;
  closingPosition: number;
  status: "success" | "warning" | "attention";
  lines: {
    item: string;
    expected: number;
    actual: number;
    variance: number;
  }[];
  summaryText: string;
  pdfUrl?: string;
  csvUrl?: string;
}

export interface BatchDocuments {
  batchId: string;
  module: string;
  period: string;
  generatedAt: string;
  documents: AgentReconDocument[];
}

/**
 * Builds one consolidated reconciliation document per agent from engine output.
 * No agent sees another agent's figures — documents are isolated by agentId.
 */
export function generateAgentDocuments(engineOutput: EngineOutput): BatchDocuments {
  const generatedAt = new Date().toISOString();
  const batchId = `RCN-${engineOutput.module}-${engineOutput.period}-${Date.now()}`;

  return {
    batchId,
    module: engineOutput.module,
    period: engineOutput.period,
    generatedAt,
    documents: engineOutput.results.map((r) => buildDocumentForAgent(r, engineOutput, generatedAt)),
  };
}

function buildDocumentForAgent(
  result: AgentReconResult,
  engineOutput: EngineOutput,
  generatedAt: string
): AgentReconDocument {
  const variance = result.closingPosition;
  const summaryText =
    result.status === "success"
      ? `All figures reconciled. Closing position is ${formatMoney(result.closingPosition, result.currency)}.`
      : result.status === "warning"
        ? `A variance of ${formatMoney(Math.abs(variance), result.currency)} was detected. Please review the attached detail.`
        : `A significant variance of ${formatMoney(Math.abs(variance), result.currency)} requires attention before the next period.`;

  return {
    agentId: result.agentId,
    agentName: result.agentName,
    module: engineOutput.module,
    period: engineOutput.period,
    currency: result.currency,
    generatedAt,
    openingPosition: result.openingPosition,
    insurance: result.insurance,
    zinara: result.zinara,
    deposits: result.deposits,
    adjustments: result.adjustments,
    closingPosition: result.closingPosition,
    status: result.status,
    lines: result.lines,
    summaryText,
  };
}

/**
 * Serialises one agent document to CSV text. Private to that agent.
 */
export function documentToCSV(doc: AgentReconDocument): string {
  const rows = [
    ["QuickRecon Consolidated Reconciliation"],
    ["Agent", doc.agentName],
    ["Agent ID", doc.agentId],
    ["Module", doc.module],
    ["Period", doc.period],
    ["Currency", doc.currency],
    ["Generated", doc.generatedAt],
    [],
    ["Opening Position", doc.openingPosition.toString()],
    ["Insurance", doc.insurance.toString()],
    ["ZINARA", doc.zinara.toString()],
    ["Deposits", doc.deposits.toString()],
    ["Adjustments", doc.adjustments.toString()],
    ["Closing Position", doc.closingPosition.toString()],
    [],
    ["Item", "Expected", "Actual", "Variance"],
    ...doc.lines.map((l) => [l.item, String(l.expected), String(l.actual), String(l.variance)]),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

/**
 * Produces a plain-text summary suitable for SMS/WhatsApp or email body.
 */
export function documentToSMS(doc: AgentReconDocument): string {
  return `QuickRecon ${doc.period} reconciliation for ${doc.agentName} (${doc.agentId}): ${doc.summaryText} Closing: ${formatMoney(doc.closingPosition, doc.currency)}.`;
}

/**
 * Produces a simple HTML body for email distribution.
 */
export function documentToHTML(doc: AgentReconDocument): string {
  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#333;">
      <h2>QuickRecon Reconciliation — ${doc.period}</h2>
      <p><strong>Agent:</strong> ${doc.agentName} (${doc.agentId})</p>
      <p><strong>Module:</strong> ${doc.module}</p>
      <p><strong>Currency:</strong> ${doc.currency}</p>
      <p>${doc.summaryText}</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px;margin-top:12px;">
        <tr style="background:#f3f4f6;">
          <th style="text-align:left;padding:8px;border:1px solid #ddd;">Item</th>
          <th style="text-align:right;padding:8px;border:1px solid #ddd;">Expected</th>
          <th style="text-align:right;padding:8px;border:1px solid #ddd;">Actual</th>
          <th style="text-align:right;padding:8px;border:1px solid #ddd;">Variance</th>
        </tr>
        ${doc.lines
          .map(
            (l) => `
          <tr>
            <td style="padding:8px;border:1px solid #ddd;">${l.item}</td>
            <td style="text-align:right;padding:8px;border:1px solid #ddd;">${l.expected.toLocaleString()}</td>
            <td style="text-align:right;padding:8px;border:1px solid #ddd;">${l.actual.toLocaleString()}</td>
            <td style="text-align:right;padding:8px;border:1px solid #ddd;">${l.variance.toLocaleString()}</td>
          </tr>
        `
          )
          .join("")}
      </table>
      <p style="margin-top:16px;">This document is confidential and intended for ${doc.agentName} only.</p>
    </div>
  `;
}
