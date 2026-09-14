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
  type LucideIcon,
} from "lucide-react";
import type { RoleCode } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: RoleCode[];
  /** Shown in the compact mobile bottom bar. */
  mobilePrimary?: boolean;
}

const COMPANY_ROLES: RoleCode[] = ["super_admin", "admin", "tech_support"];
const FIELD_ROLES: RoleCode[] = ["agent", "assistant"];

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard, roles: [...COMPANY_ROLES, ...FIELD_ROLES], mobilePrimary: true },
  { label: "Agents", href: "/app/agents", icon: Users, roles: COMPANY_ROLES, mobilePrimary: true },
  { label: "Imports", href: "/app/imports", icon: Upload, roles: COMPANY_ROLES },
  { label: "Reconciliation", href: "/app/reconciliation", icon: RefreshCcw, roles: COMPANY_ROLES, mobilePrimary: true },
  { label: "Reports", href: "/app/reports", icon: FileBarChart, roles: [...COMPANY_ROLES, ...FIELD_ROLES], mobilePrimary: true },
  { label: "Task Management", href: "/app/submissions", icon: ClipboardList, roles: [...COMPANY_ROLES, ...FIELD_ROLES], mobilePrimary: true },
  { label: "Communications", href: "/app/communications", icon: Send, roles: ["super_admin", "admin"] },
  { label: "ERP", href: "/app/erp", icon: Briefcase, roles: COMPANY_ROLES },
  { label: "User Management", href: "/app/users", icon: UserCog, roles: ["super_admin", "admin", "tech_support"] },
  { label: "My Booths", href: "/app/booths", icon: Store, roles: FIELD_ROLES },
  { label: "Assistants", href: "/app/assistants", icon: UserRoundCheck, roles: ["agent", "super_admin", "admin"] },
  { label: "Transactions", href: "/app/transactions", icon: ArrowLeftRight, roles: FIELD_ROLES },
  { label: "My Profile", href: "/app/profile", icon: UserRound, roles: FIELD_ROLES },
  { label: "Support", href: "/app/support", icon: LifeBuoy, roles: [...COMPANY_ROLES, ...FIELD_ROLES] },
  { label: "Settings", href: "/app/settings", icon: Settings, roles: [...COMPANY_ROLES, ...FIELD_ROLES] },
];

/** Ordered mobile bottom items for field users, matching the agent mockups. */
export const AGENT_MOBILE_PRIMARY = [
  { label: "Home", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Reports", href: "/app/reports", icon: FileBarChart },
  { label: "Booths", href: "/app/booths", icon: Store },
  { label: "Tasks", href: "/app/submissions", icon: ClipboardList },
] as const;

export function navForRole(role: RoleCode): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function isCompanyRole(role: RoleCode): boolean {
  return COMPANY_ROLES.includes(role);
}
