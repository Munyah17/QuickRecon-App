/**
 * QuickRecon App — core domain types.
 * Shared across the data layer, reconciliation engine and UI.
 */

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export type ModuleCode = "enpassent" | "econet-moovah";

export interface BusinessModule {
  code: ModuleCode;
  name: string;
  status: "active" | "suspended";
}

export type ModuleSelection = ModuleCode | "all";

// ---------------------------------------------------------------------------
// Users, roles, permissions
// ---------------------------------------------------------------------------

export type RoleCode =
  | "super_admin"
  | "admin"
  | "agent"
  | "assistant"
  | "tech_support";

export type UserStatus = "active" | "suspended" | "pending" | "inactive";

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: RoleCode;
  roleLabel: string;
  status: UserStatus;
  /** Present when the user is an agent or assistant account. */
  agentId?: string;
  /** Present when the user is an assistant — link to parent agent. */
  parentAgentId?: string;
  lastLoginAt?: string;
}

// ---------------------------------------------------------------------------
// Agents, booths, assistants
// ---------------------------------------------------------------------------

export type AgentStatus = "active" | "suspended" | "inactive" | "pending";

export interface AgentModuleAccess {
  module: ModuleCode;
  enabled: boolean;
}

export interface Agent {
  id: string; // AGT-000184
  fullName: string;
  email: string;
  phone: string;
  province: string;
  location: string;
  status: AgentStatus;
  modules: AgentModuleAccess[];
  boothsCount: number;
  assistantsCount: number;
  joinedAt: string;
  nationalId?: string;
  iceCashId?: string;
  kycStatus: "verified" | "pending" | "unverified";
  metrics?: AgentPeriodMetrics;
}

export interface Booth {
  id: string;
  agentId: string;
  name: string;
  location: string;
  province: string;
  status: "active" | "pending" | "suspended";
  modules: ModuleCode[];
  assistantsCount: number;
  createdAt: string;
}

export interface Assistant {
  id: string;
  agentId: string;
  boothId?: string;
  boothName?: string;
  fullName: string;
  email: string;
  phone: string;
  status: "active" | "pending" | "suspended" | "rejected";
  requestedPermissions: string[];
  createdAt: string;
}

export interface AgentExternalId {
  agentId: string;
  scheme:
    | "agent_code"
    | "enpassent_user_id"
    | "econet_id"
    | "icecash_id"
    | "zinara_id"
    | "bank_pos_terminal"
    | "nmb_id"
    | "nbs_id"
    | "cbz_id";
  value: string;
}

// ---------------------------------------------------------------------------
// Financial / reconciliation
// ---------------------------------------------------------------------------

export type Currency = "ZWG" | "USD";

export interface Money {
  amount: number;
  currency: Currency;
}

export interface AgentPeriodMetrics {
  period: string; // "2026-08"
  currency: Currency;
  totalInsurance: number;
  totalZinara: number;
  totalDeposits: number;
  closingPosition: number;
  insuranceChangePct?: number;
  zinaraChangePct?: number;
  depositsChangePct?: number;
  closingChangePct?: number;
}

export type ReconciliationStatus =
  | "processing"
  | "review"
  | "success"
  | "warning"
  | "attention"
  | "approved"
  | "published";

export interface Reconciliation {
  id: string;
  agentId: string;
  agentName: string;
  module: ModuleCode;
  period: string;
  status: ReconciliationStatus;
  currency: Currency;
  openingPosition: number;
  insurance: number;
  zinara: number;
  deposits: number;
  adjustments: number;
  closingPosition: number;
  publishedAt?: string;
  version: number;
}

export interface ReconciliationLine {
  item: string;
  category: "insurance" | "zinara" | "deposit" | "adjustment" | "other";
  expected: number;
  actual: number;
  variance: number;
  status: "matched" | "variance" | "missing" | "extra";
}

export type ReconExceptionStatus =
  | "open"
  | "investigating"
  | "resolved"
  | "ignored";

export type ReconExceptionType =
  | "unmatched_agent"
  | "unknown_external_id"
  | "duplicate_transaction"
  | "missing_expected_record"
  | "amount_variance"
  | "missing_column"
  | "schema_changed"
  | "invalid_date"
  | "invalid_currency"
  | "unrecognised_payment_source"
  | "possible_duplicate_import"
  | "calculation_warning"
  | "unbalanced_reconciliation";

export interface ReconException {
  id: string;
  batchId: string;
  type: ReconExceptionType;
  severity: "critical" | "high" | "medium" | "low";
  module: ModuleCode;
  agentId?: string;
  agentName?: string;
  sourceRef?: string;
  description: string;
  status: ReconExceptionStatus;
  resolution?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

export type ImportStatus =
  | "uploaded"
  | "validating"
  | "validated"
  | "processing"
  | "completed"
  | "failed";

export interface ImportBatch {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  module: ModuleCode;
  period: string;
  uploadedBy: string;
  uploadedAt: string;
  status: ImportStatus;
  worksheets: ImportWorksheet[];
  rowCount: number;
  checksum: string;
}

export interface ImportWorksheet {
  name: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  selected: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Reports / distribution
// ---------------------------------------------------------------------------

export type ReportType =
  | "consolidated"
  | "detailed_transactions"
  | "commission_summary"
  | "zinara"
  | "insurance"
  | "monthly";

export interface AgentReport {
  id: string;
  agentId: string;
  /** Reconciliation this report was generated from (links to the detail view). */
  reconId?: string;
  type: ReportType;
  title: string;
  module: ModuleCode;
  period: string;
  format: "pdf" | "xlsx";
  sizeLabel: string;
  status: "available" | "pending" | "generating";
  submittedAt: string;
}

export interface DistributionJob {
  id: string;
  period: string;
  module: ModuleSelection;
  recipientsCount: number;
  channels: ("email" | "whatsapp")[];
  status: "scheduled" | "processing" | "sent" | "failed" | "partial";
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Submissions (agent work documents — NOT company reconciliation imports)
// ---------------------------------------------------------------------------

export type SubmissionType =
  | "monthly_field_report"
  | "icecash_registration"
  | "zinara_registration"
  | "proof_of_payment"
  | "customer_query"
  | "expense_document"
  | "error_report"
  | "support_document"
  | "other";

export type SubmissionStatus =
  | "pending"
  | "under_review"
  | "completed"
  | "rejected";

export interface Submission {
  id: string;
  agentId: string;
  agentName: string;
  module: ModuleCode;
  type: SubmissionType;
  title: string;
  description?: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewerComment?: string;
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

export type TicketCategory =
  | "technical"
  | "account_access"
  | "reconciliation_query"
  | "submission_issue"
  | "report_issue"
  | "other";

export interface SupportTicket {
  id: string;
  agentId: string;
  agentName: string;
  module: ModuleCode | "general";
  category: TicketCategory;
  subject: string;
  status: "open" | "in_progress" | "awaiting_user" | "resolved" | "closed";
  createdAt: string;
}

export interface Txn {
  id: string;
  ref: string;
  title: string;
  subtitle?: string;
  category: "insurance" | "zinara" | "deposit";
  amount: number;
  currency: Currency;
  date: string;
  status: "matched" | "pending" | "variance";
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export type ActivityKind =
  | "import"
  | "reconciliation"
  | "report"
  | "assistant"
  | "agent"
  | "profile"
  | "exception"
  | "submission";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  description?: string;
  at: string;
  module?: ModuleCode;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  at: string;
  kind: ActivityKind;
}

export interface TeamUser {
  id: string;
  fullName: string;
  email: string;
  role: RoleCode;
  status: UserStatus;
  nationalId?: string;
  lastLoginAt?: string;
}

export interface PendingApproval {
  id: string;
  kind: "assistant" | "user" | "booth";
  name: string;
  email?: string;
  detail: string;
  requestedBy?: string;
  requestedAt: string;
}

export interface TaskMilestone {
  id: string;
  title: string;
  done: boolean;
  doneAt?: string;
}

export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  assigneeType: "agent" | "staff";
  assigneeId: string;
  assigneeName: string;
  assigneePhone?: string;
  assigneeEmail?: string;
  /** Shared tasks are visible only to super_admin/admin and the assignee. */
  shared: boolean;
  milestones: TaskMilestone[];
  createdBy?: string;
  createdAt: string;
  completedAt?: string;
}
