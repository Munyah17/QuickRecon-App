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
  ArrowLeftRight,
  Briefcase,
  Calculator,
  ShoppingCart,
  MonitorSmartphone,
  FileText,
  TriangleAlert,
  CalendarClock,
  History,
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
  href: string;
  icon: LucideIcon;
  roles: RoleCode[];
  /** Shown in the compact mobile bottom bar. */
  mobilePrimary?: boolean;
  /** Collapsible sub-items shown in the sidebar. */
  children?: NavChild[];
}

const COMPANY_ROLES: RoleCode[] = ["super_admin", "admin", "tech_support"];

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard, roles: COMPANY_ROLES, mobilePrimary: true },
  { label: "Imports", href: "/app/imports", icon: Upload, roles: COMPANY_ROLES },
  {
    label: "Reconciliation",
    href: "/app/reconciliation",
    icon: RefreshCcw,
    roles: COMPANY_ROLES,
    mobilePrimary: true,
    children: [
      { label: "Summary", href: "/app/reconciliation", icon: RefreshCcw },
      { label: "Breakdowns", href: "/app/reconciliation?tab=breakdowns", icon: FileBarChart },
      { label: "Transactions", href: "/app/reconciliation?tab=transactions", icon: ArrowLeftRight },
      { label: "Documents", href: "/app/reconciliation?tab=documents", icon: FileText },
      { label: "Alarm", href: "/app/reconciliation/exceptions", icon: TriangleAlert },
    ],
  },
  {
    label: "Reports",
    href: "/app/reports",
    icon: FileBarChart,
    roles: COMPANY_ROLES,
    mobilePrimary: true,
    children: [
      { label: "Send Reports", href: "/app/reports", icon: Send },
      { label: "Schedule", href: "/app/reports?tab=schedule", icon: CalendarClock },
      { label: "History", href: "/app/reports?tab=history", icon: History },
    ],
  },
  { label: "Submissions", href: "/app/submissions", icon: ClipboardList, roles: COMPANY_ROLES, mobilePrimary: true },
  { label: "Agents Management", href: "/app/agents", icon: Users, roles: COMPANY_ROLES, mobilePrimary: true },
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
  { label: "Support", href: "/app/support", icon: LifeBuoy, roles: COMPANY_ROLES },
  { label: "Settings", href: "/app/settings", icon: Settings, roles: COMPANY_ROLES },
];

/** Sidebar ordering, matching the mockups exactly. */
const COMPANY_ORDER = [
  "/app/dashboard",
  "/app/imports",
  "/app/reconciliation",
  "/app/reports",
  "/app/agents",
  "/app/users",
  "/app/communications",
  "/app/submissions",
  "/app/erp",
  "/app/support",
  "/app/settings",
];
export function navForRole(role: RoleCode): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).sort(
    (a, b) =>
      (COMPANY_ORDER.indexOf(a.href) === -1 ? 99 : COMPANY_ORDER.indexOf(a.href)) -
      (COMPANY_ORDER.indexOf(b.href) === -1 ? 99 : COMPANY_ORDER.indexOf(b.href))
  );
}

export function isCompanyRole(role: RoleCode): boolean {
  return COMPANY_ROLES.includes(role);
}
