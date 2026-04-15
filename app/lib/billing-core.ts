import {
  calculatePlanPrice,
  createBillingTransaction,
  getBillingPlanByCode,
  getBillingPhase,
  getWorkspaceBalanceByWorkspaceId,
  getWorkspaceBilling,
  getWorkspaceBillingByWorkspaceId,
  getBillingEndDate,
  isBillingExpired,
  type BillingPeriod,
  type BillingPlan,
  type BillingPlanCode,
  type WorkspaceBilling,
} from "./supabase/billing";
import { createClient } from "./supabase/client";

import { createReferralRewardFromBillingTransaction } from "./supabase/referrals";

async function requireSuperAdmin() {
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
    throw new Error("Недостаточно прав для выполнения финансовой операции");
  }

  return {
    supabase,
    user,
    profile,
  };
}

async function logAdminAction(params: {
  adminUserId: string;
  workspaceId?: string | null;
  actionType: string;
  actionPayload?: Record<string, unknown>;
}) {
  const supabase = createClient();

  const { error } = await supabase.from("admin_action_logs").insert({
    admin_user_id: params.adminUserId,
    workspace_id: params.workspaceId ?? null,
    action_type: params.actionType,
    action_payload: params.actionPayload ?? {},
  });

  if (error) {
    throw new Error(`Не удалось записать admin log: ${error.message}`);
  }
}

export type BillingAccessState = {
  hasBilling: boolean;
  isTrial: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  isExpired: boolean;
  isReadOnly: boolean;
  currentPlanCode: BillingPlanCode | null;
  billingPeriod: BillingPeriod | null;
  endDate: string | null;
  teamEnabled: boolean;
  aiEnabled: boolean;
  includedMembers: number;
  extraMembers: number;
  totalAllowedMembers: number;
  maxMembers: number | null;
};

export type RenewalResult =
  | {
      success: true;
      status: "renewed";
      newBilling: WorkspaceBilling;
      chargedAmount: number;
    }
  | {
      success: true;
      status: "no_action";
      billing: WorkspaceBilling | null;
      reason:
        | "billing_not_found"
        | "not_expired"
        | "auto_renew_disabled"
        | "trial_without_plan"
        | "plan_not_found";
    }
  | {
      success: false;
      status: "past_due";
      billing: WorkspaceBilling;
      requiredAmount: number;
      currentBalance: number;
    };

export type ActivatePlanParams = {
  workspaceId: string;
  planCode: Exclude<BillingPlanCode, "trial">;
  billingPeriod: BillingPeriod;
  extraMembers?: number;
  description?: string;
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

async function updateWorkspaceBillingByWorkspaceId(
  workspaceId: string,
  patch: Partial<WorkspaceBilling>
): Promise<WorkspaceBilling> {
  const supabase = createClient();

  const { data, error } = await supabase
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

  return data as WorkspaceBilling;
}

export async function getBillingAccessState(): Promise<BillingAccessState> {
  const billing = await getWorkspaceBilling();
  return buildBillingAccessState(billing);
}

export function buildBillingAccessState(
  billing: WorkspaceBilling | null
): BillingAccessState {
  if (!billing) {
    return {
      hasBilling: false,
      isTrial: false,
      isActive: false,
      isPastDue: false,
      isCanceled: false,
      isExpired: false,
      isReadOnly: true,
      currentPlanCode: null,
      billingPeriod: null,
      endDate: null,
      teamEnabled: false,
      aiEnabled: false,
      includedMembers: 0,
      extraMembers: 0,
      totalAllowedMembers: 0,
      maxMembers: null,
    };
  }

  const phase = getBillingPhase(billing);
  const includedMembers = Number(billing.included_members ?? 0);
  const extraMembers = Number(billing.extra_members ?? 0);
  const rawTotal = includedMembers + extraMembers;
  const totalAllowedMembers =
    billing.max_members === null
      ? rawTotal
      : Math.min(rawTotal, Number(billing.max_members));

  return {
    hasBilling: true,
    isTrial: phase.isTrial,
    isActive: phase.isActive,
    isPastDue: phase.isPastDue,
    isCanceled: phase.isCanceled,
    isExpired: phase.isExpired,
    isReadOnly: phase.isReadOnly,
    currentPlanCode: billing.plan_code,
    billingPeriod: billing.billing_period,
    endDate: getBillingEndDate(billing),
    teamEnabled: Boolean(billing.team_enabled),
    aiEnabled: Boolean(billing.ai_enabled),
    includedMembers,
    extraMembers,
    totalAllowedMembers,
    maxMembers: billing.max_members,
  };
}

export async function markWorkspaceBillingPastDue(
  workspaceId: string
): Promise<WorkspaceBilling> {
  return updateWorkspaceBillingByWorkspaceId(workspaceId, {
    subscription_status: "past_due",
  });
}

export async function processWorkspaceBilling(
  workspaceId: string
): Promise<RenewalResult> {
  const billing = await getWorkspaceBillingByWorkspaceId(workspaceId);

  if (!billing) {
    return {
      success: true,
      status: "no_action",
      billing: null,
      reason: "billing_not_found",
    };
  }

  if (!isBillingExpired(billing)) {
    return {
      success: true,
      status: "no_action",
      billing,
      reason: "not_expired",
    };
  }

  if (!billing.auto_renew) {
    const updated = await markWorkspaceBillingPastDue(workspaceId);

    return {
      success: false,
      status: "past_due",
      billing: updated,
      requiredAmount: 0,
      currentBalance: await getWorkspaceBalanceByWorkspaceId(workspaceId),
    };
  }

  const nextPlanCode: Exclude<BillingPlanCode, "trial"> =
    billing.plan_code === "trial"
      ? "team"
      : (billing.plan_code as Exclude<BillingPlanCode, "trial">);

  const plan = await getBillingPlanByCode(nextPlanCode);

  if (!plan) {
    return {
      success: true,
      status: "no_action",
      billing,
      reason:
        billing.plan_code === "trial" ? "trial_without_plan" : "plan_not_found",
    };
  }

  const extraMembers = Number(billing.extra_members ?? 0);
  const price = calculatePlanPrice({
    plan,
    billingPeriod: billing.billing_period,
    extraMembers,
  });

  const balance = await getWorkspaceBalanceByWorkspaceId(workspaceId);

  if (balance < price.totalPrice) {
    const updated = await markWorkspaceBillingPastDue(workspaceId);

    return {
      success: false,
      status: "past_due",
      billing: updated,
      requiredAmount: price.totalPrice,
      currentBalance: balance,
    };
  }

    const transaction = await createBillingTransaction({
    workspaceId,
    amount: -price.totalPrice,
    transactionType: "subscription_charge",
    description:
      billing.billing_period === "yearly"
        ? `Продление тарифа ${plan.name} на 1 год`
        : `Продление тарифа ${plan.name} на 1 месяц`,
    meta: {
      plan_code: nextPlanCode,
      billing_period: billing.billing_period,
      extra_members: extraMembers,
      source: "auto_renew",
    },
  });

  try {
    const supabase = createClient();

    const { data: workspaceRecord, error: workspaceError } = await supabase
      .from("workspaces")
      .select("owner_user_id")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!workspaceError && workspaceRecord?.owner_user_id && transaction?.id) {
      await createReferralRewardFromBillingTransaction({
        referredUserId: workspaceRecord.owner_user_id,
        billingTransactionId: transaction.id,
        paymentAmount: price.totalPrice,
      });
    }
  } catch (referralError) {
    console.error("Ошибка создания referral reward:", referralError);
  }

  const now = new Date();
  const nextEndDate =
    billing.billing_period === "yearly"
      ? addYears(now, 1)
      : addMonths(now, 1);

  const features = getPlanFeatures(plan, extraMembers);

  const updatedBilling = await updateWorkspaceBillingByWorkspaceId(workspaceId, {
    plan_code: nextPlanCode,
    subscription_status: "active",
    subscription_started_at: now.toISOString(),
    subscription_ends_at: nextEndDate.toISOString(),
    trial_started_at: billing.trial_started_at,
    trial_ends_at: billing.trial_ends_at,
    included_members: features.includedMembers,
    extra_members: features.extraMembers,
    max_members: features.maxMembers,
    team_enabled: features.teamEnabled,
    ai_enabled: features.aiEnabled,
  });

  return {
    success: true,
    status: "renewed",
    newBilling: updatedBilling,
    chargedAmount: price.totalPrice,
  };
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

  const plan = await getBillingPlanByCode(planCode);

  if (!plan) {
    throw new Error("Тариф не найден");
  }

  const price = calculatePlanPrice({
    plan,
    billingPeriod,
    extraMembers,
  });

  const balance = await getWorkspaceBalanceByWorkspaceId(workspaceId);

  if (balance < price.totalPrice) {
    throw new Error(
      `Недостаточно средств на балансе. Нужно ${price.totalPrice} ₽`
    );
  }

    const transaction = await createBillingTransaction({
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
  });

  try {
    const { supabase } = await requireSuperAdmin();

    const { data: workspaceRecord, error: workspaceError } = await supabase
      .from("workspaces")
      .select("owner_user_id")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!workspaceError && workspaceRecord?.owner_user_id && transaction?.id) {
      await createReferralRewardFromBillingTransaction({
        referredUserId: workspaceRecord.owner_user_id,
        billingTransactionId: transaction.id,
        paymentAmount: price.totalPrice,
      });
    }
  } catch (referralError) {
    console.error("Ошибка создания referral reward:", referralError);
  }

  const now = new Date();
  const endDate =
    billingPeriod === "yearly" ? addYears(now, 1) : addMonths(now, 1);

  const features = getPlanFeatures(plan, extraMembers);

  const updatedBilling = await updateWorkspaceBillingByWorkspaceId(workspaceId, {
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
  });

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

export async function moveExpiredTrialToPastDue(
  workspaceId: string
): Promise<WorkspaceBilling | null> {
  const billing = await getWorkspaceBillingByWorkspaceId(workspaceId);

  if (!billing) return null;
  if (billing.subscription_status !== "trial") return billing;
  if (!isBillingExpired(billing)) return billing;

  return updateWorkspaceBillingByWorkspaceId(workspaceId, {
    subscription_status: "past_due",
  });
}

export async function ensureBillingUpToDate(
  workspaceId: string
): Promise<WorkspaceBilling | null> {
  const billing = await getWorkspaceBillingByWorkspaceId(workspaceId);

  if (!billing) return null;

  if (!isBillingExpired(billing)) {
    return billing;
  }

  const result = await processWorkspaceBilling(workspaceId);

  if (result.success && result.status === "renewed") {
    return result.newBilling;
  }

  if (result.status === "past_due") {
    return result.billing;
  }

  if (result.status === "no_action") {
    return result.billing;
  }

  return billing;
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

  const transaction = await createBillingTransaction({
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

export async function forceSetWorkspaceBillingStatus(params: {
  workspaceId: string;
  nextStatus: "trial" | "active" | "past_due" | "expired" | "canceled";
  description?: string;
}) {
  const { user } = await requireSuperAdmin();

  let currentBilling = await getWorkspaceBillingByWorkspaceId(
    params.workspaceId
  );

  if (!currentBilling) {
    const { supabase } = await requireSuperAdmin();

    const { data: createdBilling, error: createBillingError } = await supabase
      .from("workspace_billing")
      .insert({
        workspace_id: params.workspaceId,
        plan_code: "trial",
        billing_period: "monthly",
        subscription_status: "trial",
        trial_started_at: new Date().toISOString(),
        trial_ends_at: addMonths(new Date(), 1).toISOString(),
        auto_renew: false,
        included_members: 1,
        extra_members: 0,
        max_members: 1,
        team_enabled: false,
        ai_enabled: false,
      })
      .select("*")
      .single();

    if (createBillingError || !createdBilling) {
      throw new Error(
        `Не удалось создать billing для workspace: ${
          createBillingError?.message ?? "unknown error"
        }`
      );
    }

    currentBilling = createdBilling as WorkspaceBilling;
  }

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

  const updatedBilling = await updateWorkspaceBillingByWorkspaceId(
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