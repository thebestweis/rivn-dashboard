export type AppRole = "owner" | "admin" | "manager" | "analyst" | "employee";

export type AppSection =
  | "dashboard"
  | "clients"
  | "projects"
  | "tasks"
  | "payments"
  | "payroll"
  | "expenses"
  | "analytics"
  | "billing"
  | "settings";

type PermissionMatrix = {
  canViewDashboard: boolean;
  canViewClients: boolean;
  canViewProjects: boolean;
  canViewTasks: boolean;
  canViewPayments: boolean;
  canViewPayroll: boolean;
  canViewExpenses: boolean;
  canViewAnalytics: boolean;
  canViewBilling: boolean;
  canViewSettings: boolean;

  canManageWorkspace: boolean;
  canManageUsers: boolean;
  canManageSystemSettings: boolean;
  canManageEmployees: boolean;
  canManageFinance: boolean;

  canEditClients: boolean;

  canManageProjects: boolean;
  canEditProjectDetails: boolean;

  canEditTasks: boolean;
};

const permissionsByRole: Record<AppRole, PermissionMatrix> = {
  owner: {
    canViewDashboard: true,
    canViewClients: true,
    canViewProjects: true,
    canViewTasks: true,
    canViewPayments: true,
    canViewPayroll: true,
    canViewExpenses: true,
    canViewAnalytics: true,
    canViewBilling: true,
    canViewSettings: true,

    canManageWorkspace: true,
    canManageUsers: true,
    canManageSystemSettings: true,
    canManageEmployees: true,
    canManageFinance: true,

    canEditClients: true,

    canManageProjects: true,
    canEditProjectDetails: true,

    canEditTasks: true,
  },

  admin: {
    canViewDashboard: true,
    canViewClients: true,
    canViewProjects: true,
    canViewTasks: true,
    canViewPayments: true,
    canViewPayroll: true,
    canViewExpenses: true,
    canViewAnalytics: true,
    canViewBilling: true,
    canViewSettings: true,

    canManageWorkspace: false,
    canManageUsers: true,
    canManageSystemSettings: false,
    canManageEmployees: true,
    canManageFinance: true,

    canEditClients: true,

    canManageProjects: true,
    canEditProjectDetails: true,

    canEditTasks: true,
  },

  manager: {
    canViewDashboard: true,
    canViewClients: true,
    canViewProjects: true,
    canViewTasks: true,
    canViewPayments: true,
    canViewPayroll: false,
    canViewExpenses: true,
    canViewAnalytics: false,
    canViewBilling: false,
    canViewSettings: false,

    canManageWorkspace: false,
    canManageUsers: false,
    canManageSystemSettings: false,
    canManageEmployees: false,
    canManageFinance: false,

    canEditClients: true,

    canManageProjects: true,
    canEditProjectDetails: true,

    canEditTasks: true,
  },

  analyst: {
    canViewDashboard: true,
    canViewClients: true,
    canViewProjects: false,
    canViewTasks: false,
    canViewPayments: true,
    canViewPayroll: true,
    canViewExpenses: true,
    canViewAnalytics: true,
    canViewBilling: false,
    canViewSettings: false,

    canManageWorkspace: false,
    canManageUsers: false,
    canManageSystemSettings: false,
    canManageEmployees: false,
    canManageFinance: false,

    canEditClients: false,

    canManageProjects: false,
    canEditProjectDetails: false,

    canEditTasks: false,
  },

  employee: {
    canViewDashboard: false,
    canViewClients: false,
    canViewProjects: true,
    canViewTasks: true,
    canViewPayments: false,
    canViewPayroll: false,
    canViewExpenses: false,
    canViewAnalytics: false,
    canViewBilling: false,
    canViewSettings: false,

    canManageWorkspace: false,
    canManageUsers: false,
    canManageSystemSettings: false,
    canManageEmployees: false,
    canManageFinance: false,

    canEditClients: false,

    canManageProjects: false,
    canEditProjectDetails: true,

    canEditTasks: true,
  },
};

export function isAppRole(value: string | null | undefined): value is AppRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "manager" ||
    value === "analyst" ||
    value === "employee"
  );
}

export function getPermissions(role: AppRole): PermissionMatrix {
  return permissionsByRole[role] ?? permissionsByRole.employee;
}

export function canAccessSection(role: AppRole, section: AppSection): boolean {
  const permissions = getPermissions(role);

  switch (section) {
    case "dashboard":
      return permissions.canViewDashboard;
    case "clients":
      return permissions.canViewClients;
    case "projects":
      return permissions.canViewProjects;
    case "tasks":
      return permissions.canViewTasks;
    case "payments":
      return permissions.canViewPayments;
    case "payroll":
      return permissions.canViewPayroll;
    case "expenses":
      return permissions.canViewExpenses;
    case "analytics":
      return permissions.canViewAnalytics;
    case "billing":
      return permissions.canViewBilling;
    case "settings":
      return permissions.canViewSettings;
    default:
      return false;
  }
}

export function getSectionByPathname(pathname: string): AppSection | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "dashboard";
  }

  if (pathname === "/clients" || pathname.startsWith("/clients/")) {
    return "clients";
  }

  if (pathname === "/projects" || pathname.startsWith("/projects/")) {
    return "projects";
  }

  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) {
    return "tasks";
  }

  if (pathname === "/payments" || pathname.startsWith("/payments/")) {
    return "payments";
  }

  if (pathname === "/payroll" || pathname.startsWith("/payroll/")) {
    return "payroll";
  }

  if (pathname === "/expenses" || pathname.startsWith("/expenses/")) {
    return "expenses";
  }

  if (pathname === "/analytics" || pathname.startsWith("/analytics/")) {
    return "analytics";
  }

  if (pathname === "/billing" || pathname.startsWith("/billing/")) {
    return "billing";
  }

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "settings";
  }

  return null;
}

export function canAccessPathname(role: AppRole, pathname: string): boolean {
  const section = getSectionByPathname(pathname);

  if (!section) {
    return true;
  }

  return canAccessSection(role, section);
}

//
// Старые функции оставляем для совместимости
//

export function isOwner(role: string) {
  return role === "owner";
}

export function isAdmin(role: string) {
  return role === "admin" || role === "owner";
}

export function isManager(role: string) {
  return ["owner", "admin", "manager"].includes(role);
}

export function canViewAnalytics(role: string) {
  return isAppRole(role) ? getPermissions(role).canViewAnalytics : false;
}

export function canManageMembers(role: string) {
  return isAppRole(role) ? getPermissions(role).canManageUsers : false;
}

//
// Action-level helpers
//

export function canEditClients(role: AppRole) {
  return getPermissions(role).canEditClients;
}

export function canManageProjects(role: AppRole) {
  return getPermissions(role).canManageProjects;
}

export function canEditProjectDetails(role: AppRole) {
  return getPermissions(role).canEditProjectDetails;
}

export function canEditProjects(role: AppRole) {
  return getPermissions(role).canManageProjects;
}

export function canEditTasks(role: AppRole) {
  return getPermissions(role).canEditTasks;
}

export function canManageFinance(role: AppRole) {
  return getPermissions(role).canManageFinance;
}

export function canManageEmployees(role: AppRole) {
  return getPermissions(role).canManageEmployees;
}

export function canManageUsers(role: AppRole) {
  return getPermissions(role).canManageUsers;
}

export function canManageWorkspace(role: AppRole) {
  return getPermissions(role).canManageWorkspace;
}

export function canManageSystem(role: AppRole) {
  return getPermissions(role).canManageSystemSettings;
}

export function canViewAllTasks(role: AppRole) {
  return role === "owner" || role === "admin" || role === "manager";
}