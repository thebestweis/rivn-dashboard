import { createAdminClient } from "./admin-server";
import { createClient as createServerClient } from "./server";

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  created_at: string;
  billing: {
    plan_code: string | null;
    subscription_status: string | null;
    billing_period: "monthly" | "yearly" | null;
  } | null;
  balance: {
    balance: number;
  };
};

type DbWorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string | null;
  created_at: string;
};

type DbWorkspaceBillingRow = {
  workspace_id: string;
  plan_code: string | null;
  subscription_status: string | null;
  billing_period: "monthly" | "yearly" | null;
};

type DbTransactionRow = {
  workspace_id: string;
  amount: number | string | null;
  status?: string | null;
};

type DbProfileRoleRow = {
  id?: string;
  email?: string | null;
  platform_role: string | null;
};

export type AdminActionLogRow = {
  id: string;
  admin_user_id: string;
  workspace_id: string | null;
  action_type: string;
  action_payload: Record<string, unknown>;
  created_at: string;
};

type DbAdminActionLogRow = {
  id: string;
  admin_user_id: string;
  workspace_id: string | null;
  action_type: string;
  action_payload: Record<string, unknown> | null;
  created_at: string;
};

async function requireSuperAdmin() {
  const serverClient = await createServerClient();

  const {
    data: { user },
    error: userError,
  } = await serverClient.auth.getUser();

  if (userError || !user) {
    throw new Error("Пользователь не авторизован");
  }

  const admin = createAdminClient();

  const { data, error: profileError } = await admin
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !data) {
    throw new Error("Профиль не найден");
  }

  const profile = data as DbProfileRoleRow;

  if (profile.platform_role !== "super_admin") {
    throw new Error("Нет доступа");
  }

  return { admin, user };
}

export async function getAllWorkspaces(): Promise<AdminWorkspaceRow[]> {
  const { admin } = await requireSuperAdmin();

  const [
    { data: workspaces, error: workspacesError },
    { data: billing, error: billingError },
    { data: transactions, error: transactionsError },
    { data: ownerProfiles, error: ownerProfilesError },
  ] = await Promise.all([
    admin.from("workspaces").select("id, name, slug, owner_user_id, created_at"),
    admin
      .from("workspace_billing")
      .select("workspace_id, plan_code, subscription_status, billing_period"),
    admin
      .from("billing_transactions")
      .select("workspace_id, amount, status"),
    admin.from("profiles").select("id, email"),
  ]);

  if (workspacesError) {
    throw new Error(workspacesError.message);
  }

  if (billingError) {
    throw new Error(billingError.message);
  }

  if (transactionsError) {
    throw new Error(transactionsError.message);
  }

  if (ownerProfilesError) {
    throw new Error(ownerProfilesError.message);
  }

  const billingMap = new Map<string, DbWorkspaceBillingRow>();
  const balanceMap = new Map<string, number>();
  const profileEmailMap = new Map<string, string | null>();

  ((billing ?? []) as DbWorkspaceBillingRow[]).forEach((b) => {
    billingMap.set(b.workspace_id, b);
  });

  ((transactions ?? []) as DbTransactionRow[]).forEach((t) => {
    if (t.status && t.status !== "completed") return;

    const current = balanceMap.get(t.workspace_id) ?? 0;
    balanceMap.set(t.workspace_id, current + Number(t.amount ?? 0));
  });

  ((ownerProfiles ?? []) as DbProfileRoleRow[]).forEach((profile) => {
    if (!profile.id) return;
    profileEmailMap.set(profile.id, profile.email ?? null);
  });

  return ((workspaces ?? []) as DbWorkspaceRow[]).map((ws) => {
    const b = billingMap.get(ws.id);

    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      owner_user_id: ws.owner_user_id ?? null,
      owner_email: ws.owner_user_id
        ? profileEmailMap.get(ws.owner_user_id) ?? null
        : null,
      created_at: ws.created_at,
      billing: b
        ? {
            plan_code: b.plan_code,
            subscription_status: b.subscription_status,
            billing_period: b.billing_period,
          }
        : null,
      balance: {
        balance: balanceMap.get(ws.id) ?? 0,
      },
    };
  });
}

export async function getAdminActionLogs(
  limit = 50
): Promise<AdminActionLogRow[]> {
  const { admin } = await requireSuperAdmin();

  const { data, error } = await admin
    .from("admin_action_logs")
    .select(
      "id, admin_user_id, workspace_id, action_type, action_payload, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbAdminActionLogRow[]).map((item) => ({
    id: item.id,
    admin_user_id: item.admin_user_id,
    workspace_id: item.workspace_id,
    action_type: item.action_type,
    action_payload:
      item.action_payload &&
      typeof item.action_payload === "object" &&
      !Array.isArray(item.action_payload)
        ? item.action_payload
        : {},
    created_at: item.created_at,
  }));
}

export async function getAdminOverview(): Promise<{
  workspaces: AdminWorkspaceRow[];
  logs: AdminActionLogRow[];
}> {
  const [workspaces, logs] = await Promise.all([
    getAllWorkspaces(),
    getAdminActionLogs(30),
  ]);

  return {
    workspaces,
    logs,
  };
}
