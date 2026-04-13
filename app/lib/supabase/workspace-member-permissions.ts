import { getAppContext } from "./app-context";

export type WorkspacePermissionSection =
  | "dashboard"
  | "clients"
  | "projects"
  | "tasks"
  | "payments"
  | "expenses"
  | "payroll"
  | "analytics"
  | "settings";

export type WorkspaceMemberPermissionItem = {
  id: string;
  workspace_id: string;
  member_id: string;
  section: WorkspacePermissionSection;
  can_view: boolean;
  can_manage: boolean;
  created_at: string;
  updated_at: string;
};

type DbWorkspaceMemberPermissionRow = {
  id: string;
  workspace_id: string;
  member_id: string;
  section: WorkspacePermissionSection;
  can_view: boolean;
  can_manage: boolean;
  created_at: string;
  updated_at: string;
};

function mapPermission(
  row: DbWorkspaceMemberPermissionRow
): WorkspaceMemberPermissionItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    section: row.section,
    can_view: row.can_view,
    can_manage: row.can_manage,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getWorkspaceMemberPermissions(
  memberId: string
): Promise<WorkspaceMemberPermissionItem[]> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("workspace_member_permissions")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("member_id", memberId)
    .order("section", { ascending: true });

  if (error) {
    throw new Error(`Не удалось загрузить права участника: ${error.message}`);
  }

  return ((data ?? []) as DbWorkspaceMemberPermissionRow[]).map(mapPermission);
}

export async function upsertWorkspaceMemberPermission(params: {
  memberId: string;
  section: WorkspacePermissionSection;
  canView: boolean;
  canManage: boolean;
}): Promise<WorkspaceMemberPermissionItem> {
  const { supabase, workspace } = await getAppContext();

  const payload = {
    workspace_id: workspace.id,
    member_id: params.memberId,
    section: params.section,
    can_view: params.canView,
    can_manage: params.canManage,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("workspace_member_permissions")
    .upsert(payload, {
      onConflict: "member_id,section",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось сохранить право: ${error.message}`);
  }

  return mapPermission(data as DbWorkspaceMemberPermissionRow);
}