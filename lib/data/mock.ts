/**
 * Realistic internal sample data used while backend tables are being wired.
 * The data-access layer in `./index.ts` reads from Supabase when configured
 * and falls back to these fixtures — components never import this directly.
 */
import type {
  Agent,
  AppNotification,
  Assistant,
  Booth,
  DistributionJob,
  ImportBatch,
  AgentReport,
  PendingApproval,
  ReconException,
  Reconciliation,
  ReconciliationLine,
  Submission,
  SupportTicket,
  TeamUser,
  ActivityItem,
} from "@/types";

export const MOCK_AGENTS: Agent[] = [
  {
    id: "AGT-000184",
    fullName: "Musa Zhou",
    email: "musa@example.com",
    phone: "+263 77 123 4567",
    province: "Harare",
    location: "Victoria Falls",
    status: "active",
    modules: [
      { module: "enpassent", enabled: true },
      { module: "econet-moovah", enabled: true },
    ],
    boothsCount: 2,
    assistantsCount: 2,
    joinedAt: "2023-01-12",
    nationalId: "63-123456-Z-12",
    iceCashId: "IC12345678",
    kycStatus: "verified",
    metrics: {
      period: "2025-08",
      currency: "ZWG",
      totalInsurance: 1_248_320,
      totalZinara: 320_450,
      totalDeposits: 1_500_000,
      closingPosition: -68_770,
      insuranceChangePct: 12,
      zinaraChangePct: -8,
      depositsChangePct: 15,
      closingChangePct: -5,
    },
  },
  {
    id: "AGT-000185",
    fullName: "Tafadzwa Chitumbura",
    email: "tafadzwa@example.com",
    phone: "+263 71 987 6543",
    province: "Mashonaland West",
    location: "Hwange",
    status: "active",
    modules: [
      { module: "enpassent", enabled: true },
      { module: "econet-moovah", enabled: false },
    ],
    boothsCount: 1,
    assistantsCount: 1,
    joinedAt: "2023-04-02",
    nationalId: "63-443211-Z-45",
    kycStatus: "verified",
    metrics: {
      period: "2025-08",
      currency: "ZWG",
      totalInsurance: 980_120,
      totalZinara: 210_300,
      totalDeposits: 1_050_000,
      closingPosition: -140_580,
    },
  },
  {
    id: "AGT-000186",
    fullName: "Rumbidzai Moyo",
    email: "rumbidzai@example.com",
    phone: "+263 77 555 1234",
    province: "Matabeleland North",
    location: "Bulawayo",
    status: "active",
    modules: [
      { module: "enpassent", enabled: false },
      { module: "econet-moovah", enabled: true },
    ],
    boothsCount: 1,
    assistantsCount: 0,
    joinedAt: "2023-07-19",
    kycStatus: "pending",
    metrics: {
      period: "2025-08",
      currency: "ZWG",
      totalInsurance: 675_400,
      totalZinara: 120_000,
      totalDeposits: 800_000,
      closingPosition: -4_600,
    },
  },
  {
    id: "AGT-000187",
    fullName: "Kudakwashe Ncube",
    email: "kuda@example.com",
    phone: "+263 71 444 8888",
    province: "Harare",
    location: "Chitungwiza",
    status: "suspended",
    modules: [
      { module: "enpassent", enabled: true },
      { module: "econet-moovah", enabled: true },
    ],
    boothsCount: 3,
    assistantsCount: 2,
    joinedAt: "2022-11-05",
    kycStatus: "verified",
    metrics: {
      period: "2025-08",
      currency: "ZWG",
      totalInsurance: 1_120_500,
      totalZinara: 250_000,
      totalDeposits: 1_000_000,
      closingPosition: 370_500,
    },
  },
  {
    id: "AGT-000188",
    fullName: "Nomsa Ndlovu",
    email: "nomsa@example.com",
    phone: "+263 77 222 3333",
    province: "Matabeleland South",
    location: "Plumtree",
    status: "active",
    modules: [
      { module: "enpassent", enabled: true },
      { module: "econet-moovah", enabled: true },
    ],
    boothsCount: 1,
    assistantsCount: 1,
    joinedAt: "2024-02-14",
    kycStatus: "pending",
    metrics: {
      period: "2025-08",
      currency: "ZWG",
      totalInsurance: 410_200,
      totalZinara: 98_400,
      totalDeposits: 455_000,
      closingPosition: 53_600,
    },
  },
];

export const MOCK_BOOTHS: Booth[] = [
  {
    id: "BTH-0101",
    agentId: "AGT-000184",
    name: "Victoria Falls Booth",
    location: "Victoria Falls",
    province: "Matabeleland North",
    status: "active",
    modules: ["enpassent", "econet-moovah"],
    assistantsCount: 2,
    createdAt: "2024-01-05",
  },
  {
    id: "BTH-0102",
    agentId: "AGT-000184",
    name: "Hwange Booth",
    location: "Hwange",
    province: "Matabeleland North",
    status: "active",
    modules: ["enpassent"],
    assistantsCount: 1,
    createdAt: "2024-03-18",
  },
  {
    id: "BTH-0103",
    agentId: "AGT-000184",
    name: "Bulawayo Booth",
    location: "Bulawayo",
    province: "Bulawayo",
    status: "pending",
    modules: ["econet-moovah"],
    assistantsCount: 0,
    createdAt: "2026-08-28",
  },
  {
    id: "BTH-0104",
    agentId: "AGT-000185",
    name: "Hwange Main",
    location: "Hwange",
    province: "Matabeleland North",
    status: "active",
    modules: ["enpassent"],
    assistantsCount: 1,
    createdAt: "2024-06-01",
  },
];

export const MOCK_ASSISTANTS: Assistant[] = [
  {
    id: "AST-0011",
    agentId: "AGT-000184",
    boothId: "BTH-0101",
    boothName: "Victoria Falls Booth",
    fullName: "Tairo Moyo",
    email: "tairo@example.com",
    phone: "+263 77 900 1001",
    status: "active",
    requestedPermissions: ["submissions", "reports"],
    createdAt: "2025-11-02",
  },
  {
    id: "AST-0012",
    agentId: "AGT-000184",
    boothId: "BTH-0102",
    boothName: "Hwange Booth",
    fullName: "Simbarashe Dube",
    email: "simba@example.com",
    phone: "+263 77 900 1002",
    status: "active",
    requestedPermissions: ["submissions"],
    createdAt: "2025-12-10",
  },
  {
    id: "AST-0013",
    agentId: "AGT-000184",
    boothId: "BTH-0101",
    boothName: "Victoria Falls Booth",
    fullName: "Nomsa Ndlovu",
    email: "nomsa.a@example.com",
    phone: "+263 77 900 1003",
    status: "pending",
    requestedPermissions: ["reports"],
    createdAt: "2026-09-10",
  },
];

export const MOCK_RECONCILIATIONS: Reconciliation[] = [
  {
    id: "RCN-2608-001",
    agentId: "AGT-000184",
    agentName: "Musa Zhou",
    module: "enpassent",
    period: "2026-08",
    status: "success",
    currency: "ZWG",
    openingPosition: 0,
    insurance: 1_248_320,
    zinara: 320_450,
    deposits: 1_500_000,
    adjustments: 0,
    closingPosition: -68_770,
    version: 2,
  },
  {
    id: "RCN-2608-002",
    agentId: "AGT-000185",
    agentName: "Tafadzwa Chitumbura",
    module: "enpassent",
    period: "2026-08",
    status: "warning",
    currency: "ZWG",
    openingPosition: 0,
    insurance: 980_120,
    zinara: 210_300,
    deposits: 1_050_000,
    adjustments: 0,
    closingPosition: -140_580,
    version: 1,
  },
  {
    id: "RCN-2608-003",
    agentId: "AGT-000186",
    agentName: "Rumbidzai Moyo",
    module: "econet-moovah",
    period: "2026-08",
    status: "success",
    currency: "ZWG",
    openingPosition: 4_000,
    insurance: 675_400,
    zinara: 120_000,
    deposits: 800_000,
    adjustments: -3_400,
    closingPosition: -4_600,
    version: 1,
  },
  {
    id: "RCN-2608-004",
    agentId: "AGT-000187",
    agentName: "Kudakwashe Ncube",
    module: "enpassent",
    period: "2026-08",
    status: "attention",
    currency: "ZWG",
    openingPosition: 0,
    insurance: 1_120_500,
    zinara: 250_000,
    deposits: 1_000_000,
    adjustments: 0,
    closingPosition: 370_500,
    version: 1,
  },
  {
    id: "RCN-2607-001",
    agentId: "AGT-000184",
    agentName: "Musa Zhou",
    module: "enpassent",
    period: "2026-07",
    status: "success",
    currency: "ZWG",
    openingPosition: 0,
    insurance: 1_114_000,
    zinara: 298_700,
    deposits: 1_380_000,
    adjustments: 0,
    closingPosition: -32_700,
    version: 1,
  },
  {
    id: "RCN-2606-001",
    agentId: "AGT-000184",
    agentName: "Musa Zhou",
    module: "enpassent",
    period: "2026-06",
    status: "warning",
    currency: "ZWG",
    openingPosition: 0,
    insurance: 1_076_900,
    zinara: 285_400,
    deposits: 1_290_000,
    adjustments: -1_500,
    closingPosition: -73_900,
    version: 1,
  },
];

export const MOCK_RECON_LINES: Record<string, ReconciliationLine[]> = {
  "RCN-2608-001": [
    { item: "Motor insurance", category: "insurance", expected: 1_048_320, actual: 1_048_320, variance: 0, status: "matched" },
    { item: "Funeral cover", category: "insurance", expected: 200_000, actual: 200_000, variance: 0, status: "matched" },
    { item: "ZINARA licences", category: "zinara", expected: 320_450, actual: 320_450, variance: 0, status: "matched" },
    { item: "NMB deposit — 09 Aug", category: "deposit", expected: 420_000, actual: 420_000, variance: 0, status: "matched" },
    { item: "POS settlement — 15 Aug", category: "deposit", expected: 390_000, actual: 380_000, variance: -10_000, status: "variance" },
    { item: "Cash deposit — 22 Aug", category: "deposit", expected: 690_000, actual: 700_000, variance: 10_000, status: "variance" },
  ],
  "RCN-2607-001": [
    { item: "Motor insurance", category: "insurance", expected: 914_000, actual: 914_000, variance: 0, status: "matched" },
    { item: "Funeral cover", category: "insurance", expected: 200_000, actual: 200_000, variance: 0, status: "matched" },
    { item: "ZINARA licences", category: "zinara", expected: 298_700, actual: 298_700, variance: 0, status: "matched" },
    { item: "Deposits", category: "deposit", expected: 1_380_000, actual: 1_412_700, variance: 32_700, status: "matched" },
  ],
  "RCN-2606-001": [
    { item: "Motor insurance", category: "insurance", expected: 876_900, actual: 876_900, variance: 0, status: "matched" },
    { item: "Funeral cover", category: "insurance", expected: 200_000, actual: 200_000, variance: 0, status: "matched" },
    { item: "ZINARA licences", category: "zinara", expected: 285_400, actual: 285_400, variance: 0, status: "matched" },
    { item: "Deposits", category: "deposit", expected: 1_290_000, actual: 1_365_400, variance: 75_400, status: "variance" },
  ],
};

export const MOCK_EXCEPTIONS: ReconException[] = [
  {
    id: "EXC-4001",
    batchId: "IMP-2608-01",
    type: "amount_variance",
    severity: "high",
    module: "enpassent",
    agentId: "AGT-000187",
    agentName: "Kudakwashe Ncube",
    sourceRef: "Enpassent!J412",
    description: "Recognised deposits exceed calculated insurance revenue by ZiG 370,500 with no adjustment record.",
    status: "open",
    createdAt: "2026-09-05T09:12:00Z",
  },
  {
    id: "EXC-4002",
    batchId: "IMP-2608-01",
    type: "unmatched_agent",
    severity: "critical",
    module: "enpassent",
    sourceRef: "Econet_Moovah!C88",
    description: "Source identity EP-99117 has no mapping in agent_external_ids and no confident match was found.",
    status: "investigating",
    createdAt: "2026-09-05T09:12:00Z",
  },
  {
    id: "EXC-4003",
    batchId: "IMP-2608-01",
    type: "duplicate_transaction",
    severity: "medium",
    module: "econet-moovah",
    agentId: "AGT-000185",
    agentName: "Tafadzwa Chitumbura",
    sourceRef: "NMB!R210",
    description: "Reference NMB845678 appears twice in the deposits worksheet within the same period.",
    status: "open",
    createdAt: "2026-09-05T09:13:00Z",
  },
  {
    id: "EXC-4004",
    batchId: "IMP-2608-01",
    type: "missing_column",
    severity: "medium",
    module: "econet-moovah",
    sourceRef: "ZINARA (Aug)",
    description: "Sheet 'ZINARA' is missing expected column 'Reference'; mapped by position instead.",
    status: "resolved",
    resolution: "Column added at source; revalidated 06 Sep.",
    createdAt: "2026-09-05T09:14:00Z",
  },
];

export const MOCK_IMPORTS: ImportBatch[] = [
  {
    id: "IMP-2608-01",
    fileName: "Econet_Moovah_Aug2026.xlsx",
    fileSizeBytes: 46_100_000,
    module: "econet-moovah",
    period: "2026-08",
    uploadedBy: "Sean Atkins",
    uploadedAt: "2026-09-02T08:04:00Z",
    status: "completed",
    rowCount: 18_432,
    checksum: "sha256:9f2c…a41d",
    worksheets: [
      { name: "Insurance", rowCount: 9_812, columnCount: 14, headers: ["Ref", "Agent ID", "Policy No", "Amount", "Date"], selected: true, warnings: [] },
      { name: "ZINARA", rowCount: 6_204, columnCount: 9, headers: ["Ref", "Agent ID", "Vehicle", "Amount"], selected: true, warnings: ["Missing column 'Reference'"] },
      { name: "Deposits", rowCount: 2_416, columnCount: 11, headers: ["Ref", "Agent ID", "Bank", "Amount", "Date"], selected: true, warnings: [] },
    ],
  },
  {
    id: "IMP-2608-02",
    fileName: "Enpassent_Aug2026.xlsx",
    fileSizeBytes: 12_400_000,
    module: "enpassent",
    period: "2026-08",
    uploadedBy: "Sean Atkins",
    uploadedAt: "2026-09-02T08:10:00Z",
    status: "processing",
    rowCount: 5_980,
    checksum: "sha256:71be…0c9f",
    worksheets: [
      { name: "Agent Summary", rowCount: 248, columnCount: 18, headers: ["Agent ID", "Insurance", "ZINARA", "Deposits"], selected: true, warnings: [] },
      { name: "Transactions", rowCount: 5_732, columnCount: 12, headers: ["Ref", "Policy", "Amount"], selected: true, warnings: [] },
    ],
  },
];

export const MOCK_REPORTS: AgentReport[] = [
  { id: "RPT-01", agentId: "AGT-000184", reconId: "RCN-2608-001", type: "consolidated", title: "Consolidated Report", module: "enpassent", period: "2026-08", format: "pdf", sizeLabel: "2.4 MB", status: "available", submittedAt: "2026-09-10" },
  { id: "RPT-02", agentId: "AGT-000184", reconId: "RCN-2608-001", type: "detailed_transactions", title: "Detailed Transactions", module: "enpassent", period: "2026-08", format: "xlsx", sizeLabel: "1.1 MB", status: "available", submittedAt: "2026-09-10" },
  { id: "RPT-03", agentId: "AGT-000184", reconId: "RCN-2608-001", type: "commission_summary", title: "Commission Summary", module: "enpassent", period: "2026-08", format: "pdf", sizeLabel: "989 KB", status: "available", submittedAt: "2026-09-08" },
  { id: "RPT-04", agentId: "AGT-000184", reconId: "RCN-2608-001", type: "zinara", title: "ZINARA Report", module: "enpassent", period: "2026-08", format: "xlsx", sizeLabel: "1.5 MB", status: "available", submittedAt: "2026-09-08" },
  { id: "RPT-05", agentId: "AGT-000184", reconId: "RCN-2608-001", type: "insurance", title: "Insurance Report", module: "enpassent", period: "2026-08", format: "pdf", sizeLabel: "1.2 MB", status: "available", submittedAt: "2026-09-05" },
  { id: "RPT-06", agentId: "AGT-000184", reconId: "RCN-2607-001", type: "consolidated", title: "Consolidated Report", module: "enpassent", period: "2026-07", format: "pdf", sizeLabel: "2.2 MB", status: "available", submittedAt: "2026-08-08" },
  { id: "RPT-07", agentId: "AGT-000184", reconId: "RCN-2606-001", type: "consolidated", title: "Consolidated Report", module: "enpassent", period: "2026-06", format: "pdf", sizeLabel: "2.0 MB", status: "available", submittedAt: "2026-07-10" },
];

export const MOCK_SUBMISSIONS: Submission[] = [
  { id: "SUB-301", agentId: "AGT-000184", agentName: "Musa Zhou", module: "enpassent", type: "monthly_field_report", title: "Monthly Field Report", status: "pending", submittedAt: "2026-09-10" },
  { id: "SUB-302", agentId: "AGT-000184", agentName: "Musa Zhou", module: "enpassent", type: "proof_of_payment", title: "Proof of Payment — NMB", status: "under_review", submittedAt: "2026-09-08" },
  { id: "SUB-303", agentId: "AGT-000184", agentName: "Musa Zhou", module: "enpassent", type: "customer_query", title: "Customer Query — CUST1023", status: "completed", submittedAt: "2026-09-05" },
  { id: "SUB-304", agentId: "AGT-000184", agentName: "Musa Zhou", module: "enpassent", type: "error_report", title: "Error Report — ERR-445", status: "completed", submittedAt: "2026-09-01" },
];

export const MOCK_TICKETS: SupportTicket[] = [
  { id: "TKT-71", agentId: "AGT-000184", agentName: "Musa Zhou", module: "enpassent", category: "reconciliation_query", subject: "August closing position mismatch", status: "in_progress", createdAt: "2026-09-05" },
  { id: "TKT-72", agentId: "AGT-000185", agentName: "Tafadzwa Chitumbura", module: "general", category: "account_access", subject: "Assistant cannot sign in", status: "open", createdAt: "2026-09-11" },
  { id: "TKT-73", agentId: "AGT-000184", agentName: "Musa Zhou", module: "general", category: "technical", subject: "Mobile app slow on booth tablet", status: "resolved", createdAt: "2026-08-28" },
];

export const MOCK_TEAM_USERS: TeamUser[] = [
  { id: "usr-01", fullName: "Admin User", email: "admin@enpassent.co.zw", role: "super_admin", status: "active", lastLoginAt: "2026-09-12T10:24:00Z" },
  { id: "usr-02", fullName: "Teridz Support", email: "support@enpassent.co.zw", role: "tech_support", status: "active", lastLoginAt: "2026-09-12T09:11:00Z" },
  { id: "usr-03", fullName: "Musa Zhou", email: "musa.z@example.com", role: "agent", status: "active", lastLoginAt: "2026-09-12T16:30:00Z" },
  { id: "usr-04", fullName: "Tairo Moyo", email: "tairo@example.com", role: "assistant", status: "pending", lastLoginAt: "2026-09-10T14:05:00Z" },
];

export const MOCK_PENDING_APPROVALS: PendingApproval[] = [
  { id: "APR-01", kind: "assistant", name: "Nomsa Ndlovu", email: "nomsa.a@example.com", detail: "Assistant — Victoria Falls Booth", requestedBy: "Musa Zhou", requestedAt: "2026-09-10" },
  { id: "APR-02", kind: "assistant", name: "Blessing Chikafu", email: "blessing@example.com", detail: "Assistant — Hwange Main", requestedBy: "Tafadzwa Chitumbura", requestedAt: "2026-09-09" },
  { id: "APR-03", kind: "booth", name: "Bulawayo Booth", detail: "New booth request — Bulawayo", requestedBy: "Musa Zhou", requestedAt: "2026-08-28" },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  { id: "NTF-01", title: "Data import completed", body: "Enpassent · August 2026 — 5,980 rows staged.", read: false, at: "2026-09-02T08:14:00Z", kind: "import" },
  { id: "NTF-02", title: "Reconciliation batch processed", body: "Batch IMP-2608-01 finished: 236 successful, 8 warnings, 4 need attention.", read: false, at: "2026-09-05T09:15:00Z", kind: "reconciliation" },
  { id: "NTF-03", title: "New user added", body: "Tairo Moyo was added as an assistant (pending approval).", read: true, at: "2026-09-10T14:05:00Z", kind: "assistant" },
  { id: "NTF-04", title: "System maintenance", body: "Scheduled on 21 Sep 2026, 22:00 — brief downtime expected.", read: true, at: "2026-09-08T09:00:00Z", kind: "profile" },
];

export const MOCK_ACTIVITIES: ActivityItem[] = [
  { id: "ACT-01", kind: "import", title: "Import completed", description: "Enpassent — August 2026", at: "2026-09-12T07:10:00Z", module: "enpassent" },
  { id: "ACT-02", kind: "report", title: "Report sent to agents", description: "236 emails · Enpassent", at: "2026-09-11T15:40:00Z", module: "enpassent" },
  { id: "ACT-03", kind: "assistant", title: "New assistant", description: "Tairo Moyo (Musa Zhou)", at: "2026-09-10T14:05:00Z" },
  { id: "ACT-04", kind: "profile", title: "Agent updated profile", description: "Rumbidzai Moyo", at: "2026-09-09T11:22:00Z" },
  { id: "ACT-05", kind: "exception", title: "Exception resolved", description: "EXC-4004 — ZINARA schema", at: "2026-09-06T10:02:00Z", module: "econet-moovah" },
];

export const MOCK_DISTRIBUTIONS: DistributionJob[] = [
  { id: "DST-01", period: "2026-08", module: "enpassent", recipientsCount: 236, channels: ["email", "whatsapp"], status: "sent", createdAt: "2026-09-11T15:40:00Z" },
  { id: "DST-02", period: "2026-09", module: "all", recipientsCount: 248, channels: ["email"], status: "scheduled", createdAt: "2026-10-01T06:00:00Z" },
];

import type { Txn } from "@/types";

/** Agent-level transaction feed (mobile Transactions + recon drill-down). */
export const MOCK_TRANSACTIONS: Txn[] = [
  { id: "TX00123", ref: "ENP12345678", title: "Policy No. ENP12345678", subtitle: "Toyota Hilux", category: "insurance", amount: 12_500, currency: "ZWG", date: "2026-08-12", status: "matched" },
  { id: "TX00124", ref: "AFD 1234", title: "ZINARA Payment", subtitle: "Reg: AFD 1234", category: "zinara", amount: 4_200, currency: "ZWG", date: "2026-08-11", status: "variance" },
  { id: "TX00125", ref: "NMB845678", title: "NMB Deposit", subtitle: "Ref: NMB845678", category: "deposit", amount: 25_000, currency: "ZWG", date: "2026-08-10", status: "matched" },
  { id: "TX00126", ref: "ENP125677", title: "Policy No. ENP125677", subtitle: "Nissan NV350", category: "insurance", amount: 10_800, currency: "ZWG", date: "2026-08-09", status: "matched" },
  { id: "TX00127", ref: "AGT 9876", title: "ZINARA Payment", subtitle: "Reg: AGT 9876", category: "zinara", amount: 3_700, currency: "ZWG", date: "2026-08-08", status: "variance" },
  { id: "TX00128", ref: "POS88421", title: "POS Settlement", subtitle: "Terminal POS88421", category: "deposit", amount: 18_400, currency: "ZWG", date: "2026-08-05", status: "pending" },
  { id: "TX00129", ref: "ENP127704", title: "Policy No. ENP127704", subtitle: "Mazda BT-50", category: "insurance", amount: 9_950, currency: "ZWG", date: "2026-08-03", status: "matched" },
  { id: "TX00130", ref: "CBZ55401", title: "CBZ Deposit", subtitle: "Ref: CBZ55401", category: "deposit", amount: 31_200, currency: "ZWG", date: "2026-08-01", status: "matched" },
];

/** Per-province coverage (admin dashboard coverage panel). */
export function mockCoverage() {
  return [
    { name: "Harare", pct: 40, agents: 96 },
    { name: "Victoria Falls", pct: 24, agents: 58 },
    { name: "Bulawayo", pct: 18, agents: 44 },
    { name: "Hwange", pct: 12, agents: 30 },
    { name: "Other", pct: 6, agents: 20 },
  ];
}

/** Weekly transaction volume bars (mobile admin dashboard). */
export function mockWeeklyVolume() {
  return [21, 22, 23, 24, 25, 26, 27].map((d, i) => ({
    month: String(d),
    volume: [120, 160, 140, 210, 190, 260, 180][i] * 1200,
  }));
}

import type { IdentityAlias } from "@/lib/reconciliation/types";

/** agent_external_ids equivalents used by the identity resolver. */
export const MOCK_EXTERNAL_IDS: IdentityAlias[] = [
  { scheme: "enpassent_user_id", value: "EP-101184", agentId: "AGT-000184" },
  { scheme: "icecash_id", value: "IC12345678", agentId: "AGT-000184" },
  { scheme: "econet_id", value: "EC-771234", agentId: "AGT-000184" },
  { scheme: "enpassent_user_id", value: "EP-101185", agentId: "AGT-000185" },
  { scheme: "icecash_id", value: "IC44321145", agentId: "AGT-000185" },
  { scheme: "enpassent_user_id", value: "EP-101186", agentId: "AGT-000186" },
  { scheme: "econet_id", value: "EC-775551", agentId: "AGT-000186" },
  { scheme: "enpassent_user_id", value: "EP-101187", agentId: "AGT-000187" },
  { scheme: "enpassent_user_id", value: "EP-101188", agentId: "AGT-000188" },
];

/** Monthly series used by Super Admin revenue trend chart. */
export function mockRevenueTrend() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const insurance = [52, 61, 58, 73, 69, 82, 79, 88];
  const zinara = [14, 16, 15, 19, 18, 21, 20, 23];
  return months.map((m, i) => ({
    month: m,
    insurance: insurance[i] * 16_500,
    zinara: zinara[i] * 14_000,
  }));
}

/** Agent portal performance series (Mar–Aug). */
export function mockAgentPerformance() {
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const insurance = [620_000, 780_000, 700_000, 960_000, 1_050_000, 1_248_320];
  const zinara = [180_000, 210_000, 195_000, 240_000, 260_000, 320_450];
  return months.map((m, i) => ({ month: m, insurance: insurance[i], zinara: zinara[i] }));
}

export function mockBoothRevenue() {
  return [
    { name: "Victoria Falls", value: 684_770, pct: 43 },
    { name: "Hwange", value: 511_000, pct: 32 },
    { name: "Bulawayo", value: 265_000, pct: 15 },
    { name: "Other", value: 100_000, pct: 10 },
  ];
}
