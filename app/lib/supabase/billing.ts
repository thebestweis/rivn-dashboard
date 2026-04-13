import { createClient } from "./client";
import { getAppContext } from "./app-context";

export type BillingPlanCode = "trial" | "base" | "team" | "strategy";
export type BillingPeriod = "monthly" | "yearly";
export type BillingStatus =
  | "trial"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export type BillingTransactionType =
  | "deposit"
  | "subscription_charge"
  | "manual_adjustment"
  | "refund";

export type BillingTransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "canceled";

export interface BillingPlan {
  code: BillingPlanCode;
  name: string;
  monthly_price: number;
  yearly_price: number;
  included_members: number;
  max_members: number | null;
  extra_member_price_monthly: number;
  extra_member_price_yearly: number;
  team_enabled: boolean;
  ai_enabled: boolean;
  is_active: boolean;
  created_at: string;
}

export interface WorkspaceBilling {
  id: string;
  workspace_id: string;
  plan_code: BillingPlanCode;
  billing_period: BillingPeriod;
  subscription_status: BillingStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  auto_renew: boolean;
  included_members: number;
  extra_members: number;
  max_members: number | null;
  team_enabled: boolean;
  ai_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingTransaction {
  id: string;
  workspace_id: string;
  amount: number;
  currency: "RUB";
  transaction_type: BillingTransactionType;
  status: BillingTransactionStatus;
  description: string | null;
  meta: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
}

export interface BillingPriceCalculation {
  basePrice: number;
  includedMembers: number;
  extraMembers: number;
  extraMemberPrice: number;
  extraMembersTotal: number;
  totalPrice: number;
  maxMembers: number | null;
}

function normalizePlan(row: any): BillingPlan {
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

function normalizeBillingTransaction(row: any): BillingTransaction {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    amount: Number(row.amount ?? 0),
    currency: "RUB",
    transaction_type: row.transaction_type,
    status: row.status,
    description: row.description ?? null,
    meta:
      row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
        ? row.meta
        : {},
    created_by_user_id: row.created_by_user_id ?? null,
    created_at: row.created_at,
  };
}

export async function getBillingPlans(): Promise<BillingPlan[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("billing_plans")
    .select("*")
    .eq("is_active", true)
    .order("monthly_price", { ascending: true });

  if (error) {
    throw new Error(`Не удалось загрузить тарифы: ${error.message}`);
  }

  return (data ?? []).map(normalizePlan);
}

export async function getBillingPlanByCode(
  code: BillingPlanCode
): Promise<BillingPlan | null> {
  const plans = await getBillingPlans();
  return plans.find((plan) => plan.code === code) ?? null;
}

export async function getWorkspaceBilling(): Promise<WorkspaceBilling | null> {
  const { workspace } = await getAppContext();

  if (!workspace?.id) {
    throw new Error("Не удалось определить workspace для billing");
  }

  return getWorkspaceBillingByWorkspaceId(workspace.id);
}

export async function getWorkspaceBillingByWorkspaceId(
  workspaceId: string
): Promise<WorkspaceBilling | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workspace_billing")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось загрузить billing workspace: ${error.message}`);
  }

  return data ? normalizeWorkspaceBilling(data) : null;
}

export async function getBillingTransactions(
  limit = 100
): Promise<BillingTransaction[]> {
  const { workspace } = await getAppContext();

  if (!workspace?.id) {
    throw new Error("Не удалось определить workspace для billing");
  }

  return getBillingTransactionsByWorkspaceId(workspace.id, limit);
}

export async function getBillingTransactionsByWorkspaceId(
  workspaceId: string,
  limit = 100
): Promise<BillingTransaction[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("billing_transactions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Не удалось загрузить billing транзакции: ${error.message}`);
  }

  return (data ?? []).map(normalizeBillingTransaction);
}

export async function getWorkspaceBalance(): Promise<number> {
  const transactions = await getBillingTransactions();
  return calculateBalanceFromTransactions(transactions);
}

export function calculateBalanceFromTransactions(
  transactions: BillingTransaction[]
): number {
  return transactions
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
}

export function calculatePlanPrice(params: {
  plan: BillingPlan;
  billingPeriod: BillingPeriod;
  extraMembers?: number;
}): BillingPriceCalculation {
  const { plan, billingPeriod } = params;
  const extraMembers = Math.max(0, Number(params.extraMembers ?? 0));

  const basePrice =
    billingPeriod === "yearly" ? plan.yearly_price : plan.monthly_price;

  const extraMemberPrice =
    billingPeriod === "yearly"
      ? plan.extra_member_price_yearly
      : plan.extra_member_price_monthly;

  const extraMembersTotal = extraMembers * extraMemberPrice;
  const totalPrice = basePrice + extraMembersTotal;

  return {
    basePrice,
    includedMembers: plan.included_members,
    extraMembers,
    extraMemberPrice,
    extraMembersTotal,
    totalPrice,
    maxMembers: plan.max_members,
  };
}

export function getTotalMembersAllowed(params: {
  includedMembers: number;
  extraMembers: number;
  maxMembers: number | null;
}): number {
  const includedMembers = Math.max(0, Number(params.includedMembers ?? 0));
  const extraMembers = Math.max(0, Number(params.extraMembers ?? 0));
  const rawTotal = includedMembers + extraMembers;

  if (params.maxMembers === null) {
    return rawTotal;
  }

  return Math.min(rawTotal, params.maxMembers);
}

export function canAddExtraMembers(params: {
  includedMembers: number;
  extraMembers: number;
  maxMembers: number | null;
}): boolean {
  const totalAllowed = getTotalMembersAllowed(params);

  if (params.maxMembers === null) {
    return true;
  }

  return totalAllowed < params.maxMembers;
}

export function getBillingPhase(billing: WorkspaceBilling | null): {
  isTrial: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  isExpired: boolean;
  isReadOnly: boolean;
} {
  if (!billing) {
    return {
      isTrial: false,
      isActive: false,
      isPastDue: false,
      isCanceled: false,
      isExpired: false,
      isReadOnly: true,
    };
  }

  return {
    isTrial: billing.subscription_status === "trial",
    isActive: billing.subscription_status === "active",
    isPastDue: billing.subscription_status === "past_due",
    isCanceled: billing.subscription_status === "canceled",
    isExpired: billing.subscription_status === "expired",
    isReadOnly:
      billing.subscription_status === "past_due" ||
      billing.subscription_status === "canceled" ||
      billing.subscription_status === "expired",
  };
}

export function getBillingEndDate(
  billing: WorkspaceBilling | null
): string | null {
  if (!billing) return null;

  if (billing.subscription_status === "trial") {
    return billing.trial_ends_at;
  }

  return billing.subscription_ends_at;
}

export function isBillingExpired(
  billing: WorkspaceBilling | null,
  now = new Date()
): boolean {
  if (!billing) return true;

  const endDate = getBillingEndDate(billing);
  if (!endDate) return false;

  return new Date(endDate).getTime() <= now.getTime();
}

export async function createBillingTransaction(params: {
  workspaceId: string;
  amount: number;
  transactionType: BillingTransactionType;
  description?: string;
  meta?: Record<string, unknown>;
}): Promise<BillingTransaction> {
  const supabase = createClient();

  const { data, error } = await supabase
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

  return normalizeBillingTransaction(data);
}

export async function getWorkspaceBalanceByWorkspaceId(
  workspaceId: string
): Promise<number> {
  const transactions = await getBillingTransactionsByWorkspaceId(workspaceId);
  return calculateBalanceFromTransactions(transactions);
}

export async function getCurrentWorkspaceId(): Promise<string> {
  const { workspace } = await getAppContext();

  if (!workspace?.id) {
    throw new Error("Не удалось определить workspace");
  }

  return workspace.id;
}