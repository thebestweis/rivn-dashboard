import { getAppContext } from "./app-context";

export type WorkspaceRole = "owner" | "admin" | "manager" | "analyst" | "employee";
export type WorkspaceMemberStatus = "active" | "invited" | "suspended" | "removed";

export type AccessibleWorkspace = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  type: "agency" | "freelancer" | "digital_specialist" | "team" | "other";
  monthly_revenue_range?: string | null;
  target_monthly_revenue?: number | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  membership_role: WorkspaceRole;
  membership_status: WorkspaceMemberStatus;
};

type DbAccessibleWorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  type: "agency" | "freelancer" | "digital_specialist" | "team" | "other";
  monthly_revenue_range?: string | null;
  target_monthly_revenue?: number | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  workspace_members: Array<{
    role: WorkspaceRole;
    status: WorkspaceMemberStatus;
  }>;
};

function mapAccessibleWorkspace(row: DbAccessibleWorkspaceRow): AccessibleWorkspace {
  const membership = row.workspace_members?.[0];

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    owner_user_id: row.owner_user_id,
    type: row.type,
    monthly_revenue_range: row.monthly_revenue_range ?? null,
    target_monthly_revenue:
      row.target_monthly_revenue !== null && row.target_monthly_revenue !== undefined
        ? Number(row.target_monthly_revenue)
        : null,
    onboarding_completed: Boolean(row.onboarding_completed),
    created_at: row.created_at,
    updated_at: row.updated_at,
    membership_role: membership?.role ?? "employee",
    membership_status: membership?.status ?? "active",
  };
}

export type CreateWorkspaceInput = {
  name: string;
  slug: string;
  type: "agency" | "freelancer" | "digital_specialist" | "team" | "other";
  monthlyRevenueRange?: string;
  targetMonthlyRevenue?: number | null;
};

export type UpdateWorkspaceInput = {
  workspaceId: string;
  name: string;
  slug: string;
  type: "agency" | "freelancer" | "digital_specialist" | "team" | "other";
  monthlyRevenueRange?: string;
  targetMonthlyRevenue?: number | null;
};

export async function getAccessibleWorkspaces(): Promise<AccessibleWorkspace[]> {
  const { supabase, user } = await getAppContext();

  const { data, error } = await supabase
    .from("workspaces")
    .select(`
      id,
      name,
      slug,
      owner_user_id,
      type,
      monthly_revenue_range,
      target_monthly_revenue,
      onboarding_completed,
      created_at,
      updated_at,
      workspace_members!inner (
        role,
        status
      )
    `)
    .eq("workspace_members.user_id", user.id)
    .eq("workspace_members.status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Не удалось загрузить workspace: ${error.message}`);
  }

  return ((data ?? []) as DbAccessibleWorkspaceRow[]).map(mapAccessibleWorkspace);
}

export async function setActiveWorkspace(workspaceId: string): Promise<void> {
  const { supabase, profile, user } = await getAppContext();

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("id, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Не удалось проверить доступ к workspace: ${membershipError.message}`);
  }

  if (!membership) {
    throw new Error("У пользователя нет доступа к выбранному workspace");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      last_active_workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) {
    throw new Error(`Не удалось переключить workspace: ${error.message}`);
  }
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  const { supabase } = await getAppContext();

  const { data, error } = await supabase.rpc("create_workspace_for_current_user", {
    p_name: input.name,
    p_slug: input.slug,
    p_type: input.type,
    p_monthly_revenue_range: input.monthlyRevenueRange ?? null,
    p_target_monthly_revenue: input.targetMonthlyRevenue ?? null,
  });

  if (error) {
    throw new Error(`Не удалось создать кабинет: ${error.message}`);
  }

  return data;
}

export async function updateWorkspace(input: UpdateWorkspaceInput) {
  const { supabase } = await getAppContext();

  const { data, error } = await supabase
    .from("workspaces")
    .update({
      name: input.name,
      slug: input.slug,
      type: input.type,
      monthly_revenue_range: input.monthlyRevenueRange ?? null,
      target_monthly_revenue: input.targetMonthlyRevenue ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.workspaceId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось обновить кабинет: ${error.message}`);
  }

  return data;
}