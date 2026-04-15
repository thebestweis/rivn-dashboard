import {
  calculatePlanPrice,
  type BillingPeriod,
  type BillingPlan,
  type BillingPlanCode,
  type WorkspaceBilling,
} from "./supabase/billing";
import { createAdminClient } from "./supabase/admin-server";
import { createClient as createServerClient } from "./supabase/server";

type ActivatePlanParams = {
  workspaceId: string;
  planCode: Exclude<BillingPlanCode, "trial">;
  billingPeriod: BillingPeriod;
  extraMembers?: number;
  description?: string;
};

type DbProfileRoleRow = {
  platform_role: string | null;
};

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function normalizeBillingPlan(row: any): BillingPlan {
  return {
    code: row.code,
    name: row.name,
    monthly_price: Number(row.monthly_price ?? 0),
    yearly_price: Number(row.yearly_price ?? 0),
    included_members: Number(row.included_members ?? 0),
    max_members:
      row.max_members === null || row.max_members === undefined
        ? null
        : Number(row.max_members),
    extra_member_price_monthly: Number(row.extra_member_price_monthly ?? 0),
    extra_member_price_yearly: Number(row.extra_member_price_yearly ?? 0),
    team_enabled: Boolean(row.team_enabled),
    ai_enabled: Boolean(row.ai_enabled),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  };
}

function normalizeWorkspaceBilling(row: any): WorkspaceBilling {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    plan_code: row.plan_code,
    billing_period: row.billing_period,
    subscription_status: row.subscription_status,
    trial_started_at: row.trial_started_at,
    trial_ends_at: row.trial_ends_at,
    subscription_started_at: row.subscription_started_at,
    subscription_ends_at: row.subscription_ends_at,
    auto_renew: Boolean(row.auto_renew),
    included_members: Number(row.included_members ?? 0),
    extra_members: Number(row.extra_members ?? 0),
    max_members:
      row.max_members === null || row.max_members === undefined
        ? null
        : Number(row.max_members),
    team_enabled: Boolean(row.team_enabled),
    ai_enabled: Boolean(row.ai_enabled),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

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

  const { data, error: profileError } = await (admin as any)
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .single();

  if (profileError || !data) {
    throw new Error("Профиль не найден");
  }

  const profile = data as DbProfileRoleRow;

  if (profile.platform_role !== "super_admin") {
    throw new Error("Недостаточно прав для выполнения финансовой операции");
  }

  return { admin, user };
}

async function logAdminAction(params: {
  adminUserId: string;
  workspaceId?: string | null;
  actionType: string;
  actionPayload?: Record<string, unknown>;
}) {
  const admin = createAdminClient();

  const { error } = await (admin as any).from("admin_action_logs").insert({
    admin_user_id: params.adminUserId,
    workspace_id: params.workspaceId ?? null,
    action_type: params.actionType,
    action_payload: params.actionPayload ?? {},
  });

  if (error) {
    throw new Error(`Не удалось записать admin log: ${error.message}`);
  }
}

async function getBillingPlanByCodeAdmin(
  code: BillingPlanCode
): Promise<BillingPlan | null> {
  const admin = createAdminClient();

  const { data, error } = await (admin as any)
    .from("billing_plans")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось загрузить тариф: ${error.message}`);
  }

  if (!data) return null;

  return normalizeBillingPlan(data);
}

async function getWorkspaceBillingByWorkspaceIdAdmin(
  workspaceId: string
): Promise<WorkspaceBilling | null> {
  const admin = createAdminClient();

  const { data, error } = await (admin as any)
    .from("workspace_billing")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось загрузить billing workspace: ${error.message}`);
  }

  return data ? normalizeWorkspaceBilling(data) : null;
}

async function getWorkspaceBalanceByWorkspaceIdAdmin(
  workspaceId: string
): Promise<number> {
  const admin = createAdminClient();

  const { data, error } = await (admin as any)
    .from("billing_transactions")
    .select("amount, status")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Не удалось загрузить billing транзакции: ${error.message}`);
  }

  return (data ?? []).reduce((sum: number, item: any) => {
    if (item.status && item.status !== "completed") {
      return sum;
    }

    return sum + Number(item.amount ?? 0);
  }, 0);
}

async function createBillingTransactionAdmin(params: {
  workspaceId: string;
  amount: number;
  transactionType:
    | "deposit"
    | "subscription_charge"
    | "manual_adjustment"
    | "refund";
  description?: string;
  meta?: Record<string, unknown>;
  createdByUserId?: string | null;
}) {
  const admin = createAdminClient();

  const { data, error } = await (admin as any)
    .from("billing_transactions")
    .insert({
      workspace_id: params.workspaceId,
      amount: params.amount,
      currency: "RUB",
      transaction_type: params.transactionType,
      status: "completed",
      description: params.description ?? null,
      meta: params.meta ?? {},
      created_by_user_id: params.createdByUserId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось создать billing транзакцию: ${error.message}`);
  }

  return data;
}

async function updateWorkspaceBillingByWorkspaceIdAdmin(
  workspaceId: string,
  patch: Partial<WorkspaceBilling>
): Promise<WorkspaceBilling> {
  const admin = createAdminClient();

  const { data, error } = await (admin as any)
    .from("workspace_billing")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось обновить billing workspace: ${error?.message ?? "unknown error"}`
    );
  }

  return normalizeWorkspaceBilling(data);
}

async function ensureWorkspaceBillingRecord(
  workspaceId: string
): Promise<WorkspaceBilling> {
  const existing = await getWorkspaceBillingByWorkspaceIdAdmin(workspaceId);

  if (existing) {
    return existing;
  }

  const admin = createAdminClient();
  const now = new Date();
  const trialPlan = await getBillingPlanByCodeAdmin("trial");

  const { data, error } = await (admin as any)
    .from("workspace_billing")
    .insert({
      workspace_id: workspaceId,
      plan_code: "trial",
      billing_period: "monthly",
      subscription_status: "trial",
      trial_started_at: now.toISOString(),
      trial_ends_at: addMonths(now, 1).toISOString(),
      subscription_started_at: null,
      subscription_ends_at: null,
      auto_renew: false,
      included_members: trialPlan?.included_members ?? 10,
      extra_members: 0,
      max_members: trialPlan?.max_members ?? 25,
      team_enabled: trialPlan?.team_enabled ?? true,
      ai_enabled: trialPlan?.ai_enabled ?? false,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось создать billing для workspace: ${error?.message ?? "unknown error"}`
    );
  }

  return normalizeWorkspaceBilling(data);
}

function getPlanFeatures(plan: BillingPlan, extraMembers = 0) {
  const safeExtraMembers = Math.max(0, Number(extraMembers ?? 0));
  const maxMembers =
    plan.max_members === null || plan.max_members === undefined
      ? null
      : Number(plan.max_members);

  const rawTotal = Number(plan.included_members) + safeExtraMembers;
  const totalAllowedMembers =
    maxMembers === null ? rawTotal : Math.min(rawTotal, maxMembers);

  return {
    includedMembers: Number(plan.included_members),
    extraMembers: safeExtraMembers,
    totalAllowedMembers,
    maxMembers,
    teamEnabled: Boolean(plan.team_enabled),
    aiEnabled: Boolean(plan.ai_enabled),
  };
}

export async function addManualBalanceAdjustment(params: {
  workspaceId: string;
  amount: number;
  description?: string;
}) {
  const { user } = await requireSuperAdmin();

  if (!Number.isFinite(params.amount) || params.amount === 0) {
    throw new Error("Сумма корректировки должна быть больше 0 или меньше 0");
  }

  const transaction = await createBillingTransactionAdmin({
    workspaceId: params.workspaceId,
    amount: params.amount,
    transactionType: params.amount > 0 ? "deposit" : "manual_adjustment",
    description:
      params.description?.trim() ||
      (params.amount > 0
        ? "Ручное пополнение баланса"
        : "Ручное списание с баланса"),
    meta: {
      source: "admin_billing_action",
    },
    createdByUserId: user.id,
  });

  await logAdminAction({
    adminUserId: user.id,
    workspaceId: params.workspaceId,
    actionType: "manual_balance_adjustment",
    actionPayload: {
      amount: params.amount,
      description: params.description ?? "",
    },
  });

  return transaction;
}

export async function activatePlanFromBalance(
  params: ActivatePlanParams
): Promise<{
  billing: WorkspaceBilling;
  chargedAmount: number;
}> {
  const { user } = await requireSuperAdmin();

  const { workspaceId, planCode, billingPeriod } = params;
  const extraMembers = Math.max(0, Number(params.extraMembers ?? 0));

  await ensureWorkspaceBillingRecord(workspaceId);

  const plan = await getBillingPlanByCodeAdmin(planCode);

  if (!plan) {
    throw new Error("Тариф не найден");
  }

  const price = calculatePlanPrice({
    plan,
    billingPeriod,
    extraMembers,
  });

  const balance = await getWorkspaceBalanceByWorkspaceIdAdmin(workspaceId);

  if (balance < price.totalPrice) {
    throw new Error(
      `Недостаточно средств на балансе. Нужно ${price.totalPrice} ₽`
    );
  }

  await createBillingTransactionAdmin({
    workspaceId,
    amount: -price.totalPrice,
    transactionType: "subscription_charge",
    description:
      billingPeriod === "yearly"
        ? `Покупка тарифа ${plan.name} на 1 год`
        : `Покупка тарифа ${plan.name} на 1 месяц`,
    meta: {
      plan_code: planCode,
      billing_period: billingPeriod,
      extra_members: extraMembers,
      source: "manual_activation",
    },
    createdByUserId: user.id,
  });

  const now = new Date();
  const endDate =
    billingPeriod === "yearly" ? addYears(now, 1) : addMonths(now, 1);

  const features = getPlanFeatures(plan, extraMembers);

  const updatedBilling = await updateWorkspaceBillingByWorkspaceIdAdmin(
    workspaceId,
    {
      plan_code: planCode,
      billing_period: billingPeriod,
      subscription_status: "active",
      subscription_started_at: now.toISOString(),
      subscription_ends_at: endDate.toISOString(),
      included_members: features.includedMembers,
      extra_members: features.extraMembers,
      max_members: features.maxMembers,
      team_enabled: features.teamEnabled,
      ai_enabled: features.aiEnabled,
    }
  );

  await logAdminAction({
    adminUserId: user.id,
    workspaceId,
    actionType: "activate_plan_from_balance",
    actionPayload: {
      planCode,
      billingPeriod,
      extraMembers,
      description: params.description ?? "",
      chargedAmount: price.totalPrice,
    },
  });

  return {
    billing: updatedBilling,
    chargedAmount: price.totalPrice,
  };
}

export async function forceSetWorkspaceBillingStatus(params: {
  workspaceId: string;
  nextStatus: "trial" | "active" | "past_due" | "expired" | "canceled";
  description?: string;
}) {
  const { user } = await requireSuperAdmin();

  const currentBilling = await ensureWorkspaceBillingRecord(params.workspaceId);
  const nowIso = new Date().toISOString();

  const patch: Partial<WorkspaceBilling> = {
    subscription_status: params.nextStatus,
  };

  if (params.nextStatus === "active") {
    if (!currentBilling.subscription_started_at) {
      patch.subscription_started_at = nowIso;
    }

    if (!currentBilling.subscription_ends_at) {
      const endDate =
        currentBilling.billing_period === "yearly"
          ? addYears(new Date(), 1)
          : addMonths(new Date(), 1);

      patch.subscription_ends_at = endDate.toISOString();
    }
  }

  if (params.nextStatus === "expired") {
    patch.subscription_ends_at = currentBilling.subscription_ends_at ?? nowIso;
  }

  const updatedBilling = await updateWorkspaceBillingByWorkspaceIdAdmin(
    params.workspaceId,
    patch
  );

  await logAdminAction({
    adminUserId: user.id,
    workspaceId: params.workspaceId,
    actionType: "force_billing_status",
    actionPayload: {
      previousStatus: currentBilling.subscription_status,
      nextStatus: params.nextStatus,
      description: params.description ?? "",
    },
  });

  return updatedBilling;
}