import { createClient } from "./client";

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  slug: string | null;
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
  amount: number;
};

export async function getAllWorkspaces(): Promise<AdminWorkspaceRow[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Нет пользователя");

  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .single();

  if (profile?.platform_role !== "super_admin") {
    throw new Error("Нет доступа");
  }

  const [
    { data: workspaces },
    { data: billing },
    { data: transactions },
  ] = await Promise.all([
    supabase.from("workspaces").select("*"),
    supabase.from("workspace_billing").select("*"),
    supabase.from("billing_transactions").select("workspace_id, amount"),
  ]);

  const billingMap = new Map<string, DbWorkspaceBillingRow>();
  const balanceMap = new Map<string, number>();

  (billing ?? []).forEach((b: DbWorkspaceBillingRow) => {
    billingMap.set(b.workspace_id, b);
  });

  (transactions ?? []).forEach((t: DbTransactionRow) => {
    const current = balanceMap.get(t.workspace_id) || 0;
    balanceMap.set(t.workspace_id, current + t.amount);
  });

  return (workspaces ?? []).map((ws: DbWorkspaceRow) => {
    const b = billingMap.get(ws.id);

    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      created_at: ws.created_at,
      billing: b
        ? {
            plan_code: b.plan_code,
            subscription_status: b.subscription_status,
            billing_period: b.billing_period,
          }
        : null,
      balance: {
        balance: balanceMap.get(ws.id) || 0,
      },
    };
  });
}

export type AdminActionLogRow = {
  id: string;
  admin_user_id: string;
  workspace_id: string | null;
  action_type: string;
  action_payload: Record<string, unknown>;
  created_at: string;
};

export async function getAdminActionLogs(limit = 50): Promise<AdminActionLogRow[]> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Пользователь не авторизован");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Профиль не найден");
  }

  if (profile.platform_role !== "super_admin") {
    throw new Error("Нет доступа");
  }

  const { data, error } = await supabase
    .from("admin_action_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AdminActionLogRow[];
}

type DbAdminActionLogRow = {
  id: string;
  admin_user_id: string;
  workspace_id: string | null;
  action_type: string;
  action_payload: Record<string, unknown> | null;
  created_at: string;
};