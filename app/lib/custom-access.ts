import {
  canAccessSection,
  canManageFinance,
  canEditClients,
  canEditProjectDetails,
  canEditProjects,
  canEditTasks,
  isAppRole,
  type AppRole,
  type AppSection,
} from "./permissions";
import type { WorkspaceMemberPermissionItem } from "./supabase/workspace-member-permissions";

function getPermissionItem(
  permissions: WorkspaceMemberPermissionItem[],
  section: AppSection
) {
  return permissions.find((item) => item.section === section) ?? null;
}

export function canAccessSectionWithCustomPermissions(params: {
  role: AppRole | null;
  section: AppSection;
  permissions: WorkspaceMemberPermissionItem[];
}) {
  const { role, section, permissions } = params;

  const customPermission = getPermissionItem(permissions, section);

  if (customPermission) {
    return customPermission.can_view;
  }

  if (!role || !isAppRole(role)) {
    return false;
  }

  return canAccessSection(role, section);
}

export function canManageSectionWithCustomPermissions(params: {
  role: AppRole | null;
  section: AppSection;
  permissions: WorkspaceMemberPermissionItem[];
}) {
  const { role, section, permissions } = params;

  if (!role || !isAppRole(role)) {
    return false;
  }

  if (role === "owner" || role === "admin") {
    return true;
  }

  const customPermission = getPermissionItem(permissions, section);

  if (customPermission) {
    return customPermission.can_manage;
  }

  switch (section) {
    case "payments":
    case "expenses":
    case "payroll":
      return canManageFinance(role);

    case "clients":
      return canEditClients(role);

    case "projects":
      return canEditProjects(role);

    case "tasks":
      return canEditTasks(role);

    case "dashboard":
    case "analytics":
    case "settings":
      return false;

    default:
      return false;
  }
}

export function canEditProjectDetailsWithCustomPermissions(params: {
  role: AppRole | null;
  permissions: WorkspaceMemberPermissionItem[];
}) {
  const { role, permissions } = params;

  if (!role || !isAppRole(role)) {
    return false;
  }

  if (role === "owner" || role === "admin") {
    return true;
  }

  const customPermission = getPermissionItem(permissions, "projects");

  if (customPermission) {
    return customPermission.can_manage;
  }

  return canEditProjectDetails(role);
}