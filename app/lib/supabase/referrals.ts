import { getAppContext } from "./app-context";

export type ReferralLinkType = "personal_50" | "standard_25";

export type ReferralLinkItem = {
  id: string;
  owner_user_id: string;
  code: string;
  link_type: ReferralLinkType;
  reward_percent: number;
  label: string | null;
  created_by_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ReferralAttributionItem = {
  id: string;
  referral_link_id: string;
  referrer_user_id: string;
  referred_user_id: string;
  reward_percent: number;
  created_at: string;
};

export type ReferralRewardItem = {
  id: string;
  referral_attribution_id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referred_user_email: string | null;
  billing_transaction_id: string;
  payment_amount: number;
  reward_percent: number;
  reward_amount: number;
  status: "pending" | "approved" | "paid" | "canceled";
  created_at: string;
};

export type ReferralStats = {
  totalReferrals: number;
  totalApprovedRewards: number;
  totalPaidRewards: number;
  totalPendingRewards: number;
  totalRevenueFromReferrals: number;
};

type DbReferralLinkRow = {
  id: string;
  owner_user_id: string;
  code: string;
  link_type: ReferralLinkType;
  reward_percent: number | string;
  label: string | null;
  created_by_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DbReferralRewardRow = {
  id: string;
  referral_attribution_id: string;
  referrer_user_id: string;
  referred_user_id: string;
  billing_transaction_id: string;
  payment_amount: number | string;
  reward_percent: number | string;
  reward_amount: number | string;
  status: "pending" | "approved" | "paid" | "canceled";
  created_at: string;
  profiles:
    | {
        email: string | null;
      }
    | {
        email: string | null;
      }[]
    | null;
};

function mapReferralLink(row: DbReferralLinkRow): ReferralLinkItem {
  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    code: row.code,
    link_type: row.link_type,
    reward_percent: Number(row.reward_percent ?? 0),
    label: row.label ?? null,
    created_by_user_id: row.created_by_user_id ?? null,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapReferralReward(row: DbReferralRewardRow): ReferralRewardItem {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    id: row.id,
    referral_attribution_id: row.referral_attribution_id,
    referrer_user_id: row.referrer_user_id,
    referred_user_id: row.referred_user_id,
    referred_user_email: profile?.email ?? null,
    billing_transaction_id: row.billing_transaction_id,
    payment_amount: Number(row.payment_amount ?? 0),
    reward_percent: Number(row.reward_percent ?? 0),
    reward_amount: Number(row.reward_amount ?? 0),
    status: row.status,
    created_at: row.created_at,
  };
}

function generateReferralCode() {
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36).slice(-4);
  return `${random}${timestamp}`.toLowerCase();
}

async function logReferralAdminAction(params: {
  actionType: string;
  actionPayload?: Record<string, unknown>;
}) {
  const { supabase, user, isSuperAdmin } = await getAppContext();

  if (!isSuperAdmin) {
    return;
  }

  const { error } = await supabase.from("admin_action_logs").insert({
    admin_user_id: user.id,
    workspace_id: null,
    action_type: params.actionType,
    action_payload: params.actionPayload ?? {},
  });

  if (error) {
    console.error("Не удалось записать admin log по referral:", error.message);
  }
}

export async function getMyReferralLinks(): Promise<ReferralLinkItem[]> {
  const { supabase, user } = await getAppContext();

  const { data, error } = await supabase
    .from("referral_links")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить реферальные ссылки: ${error.message}`);
  }

  return ((data ?? []) as DbReferralLinkRow[]).map(mapReferralLink);
}

export async function ensureMyStandardReferralLink(): Promise<ReferralLinkItem> {
  const { supabase, user } = await getAppContext();

  const { data: existingRows, error: existingError } = await supabase
    .from("referral_links")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("link_type", "standard_25")
    .order("created_at", { ascending: true });

  if (existingError) {
    throw new Error(
      `Не удалось проверить стандартную реферальную ссылку: ${existingError.message}`
    );
  }

  if (existingRows && existingRows.length > 0) {
    return mapReferralLink(existingRows[0] as DbReferralLinkRow);
  }

  const payload = {
    owner_user_id: user.id,
    code: generateReferralCode(),
    link_type: "standard_25" as const,
    reward_percent: 25,
    label: "Основная ссылка",
    created_by_user_id: user.id,
    is_active: true,
  };

  const { data, error } = await supabase
    .from("referral_links")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось создать стандартную реферальную ссылку: ${
        error?.message ?? "unknown error"
      }`
    );
  }

  return mapReferralLink(data as DbReferralLinkRow);
}

export async function createPersonalReferralLink(params?: {
  rewardPercent?: number;
  label?: string;
}): Promise<ReferralLinkItem> {
  const { supabase, user, isSuperAdmin } = await getAppContext();

  if (!isSuperAdmin) {
    throw new Error(
      "Только super admin может создавать персональные реферальные ссылки"
    );
  }

  const rewardPercent = Number(params?.rewardPercent ?? 50);

  if (rewardPercent <= 0 || rewardPercent > 100) {
    throw new Error("Процент реферальной выплаты должен быть от 0 до 100");
  }

  const payload = {
    owner_user_id: user.id,
    code: generateReferralCode(),
    link_type: "personal_50" as const,
    reward_percent: rewardPercent,
    label: params?.label?.trim() || null,
    created_by_user_id: user.id,
    is_active: true,
  };

  const { data, error } = await supabase
    .from("referral_links")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось создать персональную ссылку: ${
        error?.message ?? "unknown error"
      }`
    );
  }

  await logReferralAdminAction({
    actionType: "create_personal_referral_link",
    actionPayload: {
      referral_link_id: data.id,
      code: data.code,
      reward_percent: data.reward_percent,
      label: data.label ?? "",
      is_active: data.is_active,
    },
  });

  return mapReferralLink(data as DbReferralLinkRow);
}

export async function setReferralLinkActiveState(params: {
  linkId: string;
  isActive: boolean;
}): Promise<ReferralLinkItem> {
  const { supabase, user, isSuperAdmin } = await getAppContext();

  const { data: existing, error: existingError } = await supabase
    .from("referral_links")
    .select("*")
    .eq("id", params.linkId)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Не удалось загрузить реферальную ссылку: ${existingError.message}`
    );
  }

  if (!existing) {
    throw new Error("Реферальная ссылка не найдена");
  }

  const canManage =
    existing.owner_user_id === user.id || Boolean(isSuperAdmin);

  if (!canManage) {
    throw new Error("Недостаточно прав для изменения реферальной ссылки");
  }

  const { data, error } = await supabase
    .from("referral_links")
    .update({
      is_active: params.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.linkId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось обновить реферальную ссылку: ${
        error?.message ?? "unknown error"
      }`
    );
  }

  if (isSuperAdmin && data.link_type === "personal_50") {
    await logReferralAdminAction({
      actionType: "toggle_personal_referral_link",
      actionPayload: {
        referral_link_id: data.id,
        code: data.code,
        is_active: data.is_active,
        label: data.label ?? "",
      },
    });
  }

  return mapReferralLink(data as DbReferralLinkRow);
}

export async function getMyReferralRewards(): Promise<ReferralRewardItem[]> {
  const { supabase, user } = await getAppContext();

  const { data, error } = await supabase
    .from("referral_rewards")
    .select(
      `
      *,
      profiles:referred_user_id (
        email
      )
    `
    )
    .eq("referrer_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить реферальные начисления: ${error.message}`);
  }

  return ((data ?? []) as DbReferralRewardRow[]).map(mapReferralReward);
}

export async function getMyReferralStats(): Promise<ReferralStats> {
  const { supabase, user } = await getAppContext();

  const [
    { count: referralsCount, error: referralsError },
    { data: rewards, error: rewardsError },
  ] = await Promise.all([
    supabase
      .from("referral_attributions")
      .select("*", { count: "exact", head: true })
      .eq("referrer_user_id", user.id),
    supabase
      .from("referral_rewards")
      .select("*")
      .eq("referrer_user_id", user.id),
  ]);

  if (referralsError) {
    throw new Error(
      `Не удалось загрузить количество приглашённых пользователей: ${referralsError.message}`
    );
  }

  if (rewardsError) {
    throw new Error(
      `Не удалось загрузить статистику реферальных выплат: ${rewardsError.message}`
    );
  }

  const safeRewards = ((rewards ?? []) as DbReferralRewardRow[]).map(
    mapReferralReward
  );

  return {
    totalReferrals: referralsCount ?? 0,
    totalApprovedRewards: safeRewards
      .filter((item) => item.status === "approved")
      .reduce((sum, item) => sum + item.reward_amount, 0),
    totalPaidRewards: safeRewards
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + item.reward_amount, 0),
    totalPendingRewards: safeRewards
      .filter((item) => item.status === "pending")
      .reduce((sum, item) => sum + item.reward_amount, 0),
    totalRevenueFromReferrals: safeRewards.reduce(
      (sum, item) => sum + item.payment_amount,
      0
    ),
  };
}

export async function storeReferralCodeInBrowser(code: string) {
  if (typeof window === "undefined") return;

  const normalizedCode = code.trim().toLowerCase();

  if (!normalizedCode) return;

  window.localStorage.setItem("rivn_ref_code", normalizedCode);
}

export async function getStoredReferralCodeFromBrowser(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem("rivn_ref_code");
  return value?.trim().toLowerCase() || null;
}

export async function clearStoredReferralCodeFromBrowser() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem("rivn_ref_code");
}

export async function createReferralAttributionForUser(
  referredUserId: string
): Promise<void> {
  const { supabase, user } = await getAppContext();

  if (user.id !== referredUserId) {
    throw new Error(
      "Можно создавать реферальную привязку только для текущего пользователя"
    );
  }

  const referralCode = await getStoredReferralCodeFromBrowser();

  if (!referralCode) {
    return;
  }

  const { data: existingAttribution, error: existingAttributionError } =
    await supabase
      .from("referral_attributions")
      .select("id")
      .eq("referred_user_id", referredUserId)
      .maybeSingle();

  if (existingAttributionError) {
    throw new Error(
      `Не удалось проверить существующую реферальную привязку: ${existingAttributionError.message}`
    );
  }

  if (existingAttribution) {
    await clearStoredReferralCodeFromBrowser();
    return;
  }

  const { data: referralLink, error: referralLinkError } = await supabase
    .from("referral_links")
    .select("*")
    .eq("code", referralCode)
    .eq("is_active", true)
    .maybeSingle();

  if (referralLinkError) {
    throw new Error(
      `Не удалось загрузить реферальную ссылку: ${referralLinkError.message}`
    );
  }

  if (!referralLink) {
    await clearStoredReferralCodeFromBrowser();
    return;
  }

  const typedReferralLink = mapReferralLink(referralLink as DbReferralLinkRow);

  if (typedReferralLink.owner_user_id === referredUserId) {
    await clearStoredReferralCodeFromBrowser();
    return;
  }

  const payload = {
    referral_link_id: typedReferralLink.id,
    referrer_user_id: typedReferralLink.owner_user_id,
    referred_user_id: referredUserId,
    reward_percent: typedReferralLink.reward_percent,
  };

  const { error: insertError } = await supabase
    .from("referral_attributions")
    .insert(payload);

  if (insertError) {
    throw new Error(
      `Не удалось создать реферальную привязку: ${insertError.message}`
    );
  }

  await clearStoredReferralCodeFromBrowser();
}

export async function createReferralRewardFromBillingTransaction(params: {
  referredUserId: string;
  billingTransactionId: string;
  paymentAmount: number;
}): Promise<void> {
  const { supabase } = await getAppContext();

  if (!params.referredUserId) {
    return;
  }

  if (!params.billingTransactionId) {
    return;
  }

  const normalizedPaymentAmount = Number(params.paymentAmount ?? 0);

  if (!Number.isFinite(normalizedPaymentAmount) || normalizedPaymentAmount <= 0) {
    return;
  }

  const { data: attribution, error: attributionError } = await supabase
    .from("referral_attributions")
    .select("*")
    .eq("referred_user_id", params.referredUserId)
    .maybeSingle();

  if (attributionError) {
    throw new Error(
      `Не удалось загрузить реферальную привязку: ${attributionError.message}`
    );
  }

  if (!attribution) {
    return;
  }

  const typedAttribution = attribution as ReferralAttributionItem;

  if (typedAttribution.referrer_user_id === typedAttribution.referred_user_id) {
    return;
  }

  const { data: existingReward, error: existingRewardError } = await supabase
    .from("referral_rewards")
    .select("id")
    .eq("billing_transaction_id", params.billingTransactionId)
    .maybeSingle();

  if (existingRewardError) {
    throw new Error(
      `Не удалось проверить существующее реферальное начисление: ${existingRewardError.message}`
    );
  }

  if (existingReward) {
    return;
  }

  const rewardPercent = Number(typedAttribution.reward_percent ?? 0);
  const rewardAmount = Number(
    ((normalizedPaymentAmount * rewardPercent) / 100).toFixed(2)
  );

  if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
    return;
  }

  const payload = {
    referral_attribution_id: typedAttribution.id,
    referrer_user_id: typedAttribution.referrer_user_id,
    referred_user_id: typedAttribution.referred_user_id,
    billing_transaction_id: params.billingTransactionId,
    payment_amount: normalizedPaymentAmount,
    reward_percent: rewardPercent,
    reward_amount: rewardAmount,
    status: "approved" as const,
  };

  const { error: insertError } = await supabase
    .from("referral_rewards")
    .insert(payload);

  if (insertError) {
    throw new Error(
      `Не удалось создать реферальное начисление: ${insertError.message}`
    );
  }
}

export async function markReferralRewardAsPaid(rewardId: string): Promise<void> {
  const { supabase, isSuperAdmin } = await getAppContext();

  if (!isSuperAdmin) {
    throw new Error(
      "Только super admin может отмечать реферальные выплаты как оплаченные"
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("id", rewardId)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Не удалось загрузить реферальное начисление: ${existingError.message}`
    );
  }

  if (!existing) {
    throw new Error("Реферальное начисление не найдено");
  }

  const { error } = await supabase
    .from("referral_rewards")
    .update({
      status: "paid",
    })
    .eq("id", rewardId);

  if (error) {
    throw new Error(
      `Не удалось отметить начисление как выплаченное: ${error.message}`
    );
  }

  await logReferralAdminAction({
    actionType: "mark_referral_reward_paid",
    actionPayload: {
      referral_reward_id: rewardId,
      reward_amount: existing.reward_amount,
      referrer_user_id: existing.referrer_user_id,
      referred_user_id: existing.referred_user_id,
    },
  });
}