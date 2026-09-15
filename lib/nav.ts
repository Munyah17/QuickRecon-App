import {
  LayoutDashboard,
  Users,
  Upload,
  RefreshCcw,
  FileBarChart,
  ClipboardList,
  Send,
  UserCog,
  Settings,
  LifeBuoy,
  Store,
  UserRoundCheck,
  UserRound,
  ArrowLeftRight,
  Briefcase,
  Calculator,
  ShoppingCart,
  MonitorSmartphone,
  FileText,
  TriangleAlert,
  CalendarClock,
  History,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import type { RoleCode } from "@/types";

export interface NavChild {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavItem {
  label: string;
  /** Label shown to field users (agents/assistants) when it differs. */
  fieldLabel?: string;
  href: string;
  icon: LucideIcon;
  roles: RoleCode[];
  /** Shown in the compact mobile bottom bar. */
  mobilePrimary?: boolean;
  /** Collapsible sub-items shown in the sidebar. */
  children?: NavChild[];
}

const COMPANY_ROLES: RoleCode[] = ["super_admin", "admin", "tech_support"];
const FIELD_ROLES: RoleCode[] = ["agent", "assistant"];

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard, roles: [...COMPANY_ROLES, ...FIELD_ROLES], mobilePrimary: true },
  { label: "Imports", href: "/app/imports", icon: Upload, roles: COMPANY_ROLES },
  {
    label: "Reconciliation",
    href: "/app/reconciliation",
    icon: RefreshCcw,
    roles: COMPANY_ROLES,
    mobilePrimary: true,
    children: [
      { label: "Batch Review", href: "/app/reconciliation", icon: RefreshCcw },
      { label: "Exceptions", href: "/app/reconciliation/exceptions", icon: TriangleAlert },
    ],
  },
  {
    label: "Reports",
    fieldLabel: "My Reports",
    href: "/app/reports",
    icon: FileBarChart,
    roles: [...COMPANY_ROLES, ...FIELD_ROLES],
    mobilePrimary: true,
    children: [
      { label: "Send Reports", href: "/app/reports", icon: Send },
      { label: "Schedule", href: "/app/reports?tab=schedule", icon: CalendarClock },
      { label: "History", href: "/app/reports?tab=history", icon: History },
    ],
  },
  { label: "Submissions", href: "/app/submissions", icon: ClipboardList, roles: [...COMPANY_ROLES, ...FIELD_ROLES], mobilePrimary: true },
  { label: "Agents", href: "/app/agents", icon: Users, roles: COMPANY_ROLES, mobilePrimary: true },
  { label: "Staff Management", href: "/app/users", icon: UserCog, roles: ["super_admin", "admin", "tech_support"] },
  { label: "Communications", href: "/app/communications", icon: Send, roles: ["super_admin", "admin"] },
  {
    label: "ERP",
    href: "/app/erp",
    icon: Briefcase,
    roles: COMPANY_ROLES,
    children: [
      { label: "Accounting", href: "/app/erp?tab=accounting", icon: Calculator },
      { label: "HR", href: "/app/erp?tab=hr", icon: Users },
      { label: "Sales", href: "/app/erp?tab=sales", icon: ShoppingCart },
      { label: "POS", href: "/app/erp?tab=pos", icon: MonitorSmartphone },
      { label: "Invoices", href: "/app/erp?tab=invoices", icon: FileText },
    ],
  },
  { label: "My Booths", href: "/app/booths", icon: Store, roles: FIELD_ROLES },
  { label: "Assistants", href: "/app/assistants", icon: UserRoundCheck, roles: ["agent", "super_admin", "admin"] },
  { label: "Transactions", href: "/app/transactions", icon: ArrowLeftRight, roles: FIELD_ROLES },
  { label: "My Profile", href: "/app/profile", icon: UserRound, roles: FIELD_ROLES },
  { label: "Announcements", href: "/app/notifications", icon: Megaphone, roles: FIELD_ROLES },
  { label: "Support", href: "/app/support", icon: LifeBuoy, roles: [...COMPANY_ROLES, ...FIELD_ROLES] },
  { label: "Settings", href: "/app/settings", icon: Settings, roles: [...COMPANY_ROLES, ...FIELD_ROLES] },
];

/** Ordered mobile bottom items for field users, matching the agent mockups. */
export const AGENT_MOBILE_PRIMARY = [
  { label: "Home", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Reports", href: "/app/reports", icon: FileBarChart },
  { label: "Booths", href: "/app/booths", icon: Store },
  { label: "Submissions", href: "/app/submissions", icon: ClipboardList },
] as const;

/** Sidebar ordering per audience, matching the mockups exactly. */
const COMPANY_ORDER = [
  "/app/dashboard",
  "/app/agents",
  "/app/imports",
  "/app/reconciliation",
  "/app/reports",
  "/app/communications",
  "/app/users",
  "/app/submissions",
  "/app/erp",
  "/app/support",
  "/app/settings",
];
const FIELD_ORDER = [
  "/app/dashboard",
  "/app/profile",
  "/app/booths",
  "/app/reports",
  "/app/assistants",
  "/app/submissions",
  "/app/transactions",
  "/app/notifications",
  "/app/support",
  "/app/settings",
];

export function navForRole(role: RoleCode): NavItem[] {
  const field = FIELD_ROLES.includes(role);
  const order = field ? FIELD_ORDER : COMPANY_ORDER;
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
    .map((item) =>
      field && item.fieldLabel ? { ...item, label: item.fieldLabel } : item
    )
    .sort(
      (a, b) =>
        (order.indexOf(a.href) === -1 ? 99 : order.indexOf(a.href)) -
        (order.indexOf(b.href) === -1 ? 99 : order.indexOf(b.href))
    );
}

export function isCompanyRole(role: RoleCode): boolean {
  return COMPANY_ROLES.includes(role);
}
