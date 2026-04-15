import "server-only";
import {
  calculatePlanPrice,
  getBillingPlanByCode,
  type BillingPeriod,
  type BillingPlanCode,
} from "../supabase/billing";
import { createReferralRewardFromBillingTransaction } from "../supabase/referrals";
import { requireSuperAdminServer } from "./require-super-admin";

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

async function logAdminAction(params: {
  adminUserId: string;
  workspaceId?: string | null;
  actionType: string;
  actionPayload?: Record<string, unknown>;
}) {
  const { adminSupabase } = await requireSuperAdminServer();

  const { error } = await adminSupabase.from("admin_action_logs").insert({
    admin_user_id: params.adminUserId,
    workspace_id: params.workspaceId ?? null,
    action_type: params.actionType,
    action_payload: params.actionPayload ?? {},
  });

  if (error) {
    throw new Error(`Не удалось записать admin log: ${error.message}`);
  }
}

async function getWorkspaceBillingByWorkspaceIdServer(workspaceId: string) {
  const { adminSupabase } = await requireSuperAdminServer();

  const { data, error } = await adminSupabase
    .from("workspace_billing")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось загрузить billing workspace: ${error.message}`);
  }

  return data;
}

async function getWorkspaceBalanceByWorkspaceIdServer(workspaceId: string) {
  const { adminSupabase } = await requireSuperAdminServer();

  const { data, error } = await adminSupabase
    .from("billing_transactions")
    .select("amount, status")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Не удалось загрузить транзакции: ${error.message}`);
  }

  return (data ?? [])
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
}

async function createBillingTransactionServer(params: {
  workspaceId: string;
  amount: number;
  transactionType: "deposit" | "subscription_charge" | "manual_adjustment" | "refund";
  description?: string;
  meta?: Record<string, unknown>;
}) {
  const { adminSupabase } = await requireSuperAdminServer();

  const { data, error } = await adminSupabase
    .from("billing_transactions")
    .insert({
      workspace_id: params.workspaceId,
      amount: params.amount,
      currency: "RUB",
      transaction_type: params.transactionType,
      status: "completed",
      description: params.description ?? null,
      meta: params.meta ?? {},
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось создать billing транзакцию: ${error.message}`);
  }

  return data;
}

export async function addManualBalanceAdjustmentServer(params: {
  workspaceId: string;
  amount: number;
  description?: string;
}) {
  const { user } = await requireSuperAdminServer();

  if (!Number.isFinite(params.amount) || params.amount === 0) {
    throw new Error("Сумма корректировки должна быть больше 0 или меньше 0");
  }

  const transaction = await createBillingTransactionServer({
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

export async function activatePlanFromBalanceServer(params: {
  workspaceId: string;
  planCode: Exclude<BillingPlanCode, "trial">;
  billingPeriod: BillingPeriod;
  extraMembers?: number;
  description?: string;
}) {
  const { user, adminSupabase } = await requireSuperAdminServer();

  const plan = await getBillingPlanByCode(params.planCode);

  if (!plan) {
    throw new Error("Тариф не найден");
  }

  const currentBilling = await getWorkspaceBillingByWorkspaceIdServer(params.workspaceId);

  if (!currentBilling) {
    throw new Error("Billing для workspace не найден");
  }

  const extraMembers = Math.max(0, Number(params.extraMembers ?? 0));

  const price = calculatePlanPrice({
    plan,
    billingPeriod: params.billingPeriod,
    extraMembers,
  });

  const balance = await getWorkspaceBalanceByWorkspaceIdServer(params.workspaceId);

  if (balance < price.totalPrice) {
    throw new Error(`Недостаточно средств на балансе. Нужно ${price.totalPrice} ₽`);
  }

  const transaction = await createBillingTransactionServer({
    workspaceId: params.workspaceId,
    amount: -price.totalPrice,
    transactionType: "subscription_charge",
    description:
      params.billingPeriod === "yearly"
        ? `Покупка тарифа ${plan.name} на 1 год`
        : `Покупка тарифа ${plan.name} на 1 месяц`,
    meta: {
      plan_code: params.planCode,
      billing_period: params.billingPeriod,
      extra_members: extraMembers,
      source: "manual_activation",
    },
  });

  const now = new Date();
  const endDate =
    params.billingPeriod === "yearly" ? addYears(now, 1) : addMonths(now, 1);

  const rawTotal = Number(plan.included_members) + extraMembers;
  const totalAllowedMembers =
    plan.max_members === null ? rawTotal : Math.min(rawTotal, Number(plan.max_members));

  const { data: updatedBilling, error: updateError } = await adminSupabase
    .from("workspace_billing")
    .update({
      plan_code: params.planCode,
      billing_period: params.billingPeriod,
      subscription_status: "active",
      subscription_started_at: now.toISOString(),
      subscription_ends_at: endDate.toISOString(),
      included_members: Number(plan.included_members),
      extra_members: extraMembers,
      max_members: plan.max_members,
      team_enabled: Boolean(plan.team_enabled),
      ai_enabled: Boolean(plan.ai_enabled),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", params.workspaceId)
    .select("*")
    .single();

  if (updateError || !updatedBilling) {
    throw new Error(
      `Не удалось обновить billing workspace: ${updateError?.message ?? "unknown error"}`
    );
  }

  const { data: workspaceRecord } = await adminSupabase
    .from("workspaces")
    .select("owner_user_id")
    .eq("id", params.workspaceId)
    .maybeSingle();

  if (workspaceRecord?.owner_user_id && transaction?.id) {
    try {
      await createReferralRewardFromBillingTransaction({
        referredUserId: workspaceRecord.owner_user_id,
        billingTransactionId: transaction.id,
        paymentAmount: price.totalPrice,
      });
    } catch (error) {
      console.error("Ошибка создания referral reward:", error);
    }
  }

  await logAdminAction({
    adminUserId: user.id,
    workspaceId: params.workspaceId,
    actionType: "activate_plan_from_balance",
    actionPayload: {
      planCode: params.planCode,
      billingPeriod: params.billingPeriod,
      extraMembers,
      description: params.description ?? "",
      chargedAmount: price.totalPrice,
      totalAllowedMembers,
    },
  });

  return {
    billing: updatedBilling,
    chargedAmount: price.totalPrice,
  };
}

export async function forceSetWorkspaceBillingStatusServer(params: {
  workspaceId: string;
  nextStatus: "trial" | "active" | "past_due" | "expired" | "canceled";
  description?: string;
}) {
  const { user, adminSupabase } = await requireSuperAdminServer();

  const currentBilling = await getWorkspaceBillingByWorkspaceIdServer(params.workspaceId);

  if (!currentBilling) {
    throw new Error("Billing для workspace не найден");
  }

  const nowIso = new Date().toISOString();

  const patch: Record<string, unknown> = {
    subscription_status: params.nextStatus,
    updated_at: nowIso,
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

  const { data: updatedBilling, error } = await adminSupabase
    .from("workspace_billing")
    .update(patch)
    .eq("workspace_id", params.workspaceId)
    .select("*")
    .single();

  if (error || !updatedBilling) {
    throw new Error(
      `Не удалось обновить статус подписки: ${error?.message ?? "unknown error"}`
    );
  }

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