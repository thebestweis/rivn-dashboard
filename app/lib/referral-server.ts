import { createServiceRoleClient } from "./supabase/service-role";

type ServiceSupabase = ReturnType<typeof createServiceRoleClient>;

type ReferralLinkRow = {
  id: string;
  owner_user_id: string;
  code: string;
  reward_percent: number | string;
  is_active: boolean;
};

function generateReferralCode() {
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36).slice(-4);
  return `${random}${timestamp}`.toLowerCase();
}

async function generateUniqueReferralCode(serviceSupabase: ServiceSupabase) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateReferralCode();

    const { data, error } = await serviceSupabase
      .from("referral_links")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      throw new Error(`Не удалось проверить referral code: ${error.message}`);
    }

    if (!data) {
      return code;
    }
  }

  throw new Error("Не удалось сгенерировать уникальный referral code");
}

export async function ensureStandardReferralLinkForUser(params: {
  serviceSupabase: ServiceSupabase;
  userId: string;
  createdByUserId?: string | null;
}) {
  const { serviceSupabase, userId, createdByUserId = userId } = params;

  const { data: existingRows, error: existingError } = await serviceSupabase
    .from("referral_links")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("link_type", "standard_25")
    .order("created_at", { ascending: true });

  if (existingError) {
    throw new Error(
      `Не удалось проверить стандартную реферальную ссылку: ${existingError.message}`
    );
  }

  if (existingRows && existingRows.length > 0) {
    return existingRows[0] as ReferralLinkRow;
  }

  const { data, error } = await serviceSupabase
    .from("referral_links")
    .insert({
      owner_user_id: userId,
      code: await generateUniqueReferralCode(serviceSupabase),
      link_type: "standard_25",
      reward_percent: 25,
      label: "Основная ссылка",
      created_by_user_id: createdByUserId,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось создать стандартную реферальную ссылку: ${
        error?.message ?? "unknown error"
      }`
    );
  }

  return data as ReferralLinkRow;
}

export async function createReferralAttributionByCode(params: {
  serviceSupabase: ServiceSupabase;
  referralCode: string;
  referredUserId: string;
  replaceExisting?: boolean;
}) {
  const {
    serviceSupabase,
    referralCode,
    referredUserId,
    replaceExisting = false,
  } = params;

  const normalizedCode = referralCode.trim().toLowerCase();

  if (!normalizedCode || !referredUserId) {
    return { created: false, skippedReason: "empty_input" };
  }

  const { data: referralLink, error: referralLinkError } = await serviceSupabase
    .from("referral_links")
    .select("*")
    .eq("code", normalizedCode)
    .eq("is_active", true)
    .maybeSingle();

  if (referralLinkError) {
    throw new Error(
      `Не удалось загрузить реферальную ссылку: ${referralLinkError.message}`
    );
  }

  if (!referralLink) {
    return { created: false, skippedReason: "referral_link_not_found" };
  }

  const typedReferralLink = referralLink as ReferralLinkRow;

  if (typedReferralLink.owner_user_id === referredUserId) {
    return { created: false, skippedReason: "self_referral" };
  }

  const { data: existingAttribution, error: existingAttributionError } =
    await serviceSupabase
      .from("referral_attributions")
      .select("id, referrer_user_id, referred_user_id")
      .eq("referred_user_id", referredUserId)
      .maybeSingle();

  if (existingAttributionError) {
    throw new Error(
      `Не удалось проверить существующую реферальную привязку: ${existingAttributionError.message}`
    );
  }

  if (existingAttribution) {
    if (!replaceExisting) {
      return { created: false, skippedReason: "already_attributed" };
    }

    const { data: existingReward, error: existingRewardError } =
      await serviceSupabase
        .from("referral_rewards")
        .select("id")
        .eq("referral_attribution_id", existingAttribution.id)
        .limit(1)
        .maybeSingle();

    if (existingRewardError) {
      throw new Error(
        `Не удалось проверить начисления по рефералке: ${existingRewardError.message}`
      );
    }

    if (existingReward) {
      return { created: false, skippedReason: "has_rewards" };
    }

    const { error: deleteError } = await serviceSupabase
      .from("referral_attributions")
      .delete()
      .eq("id", existingAttribution.id);

    if (deleteError) {
      throw new Error(
        `Не удалось удалить старую реферальную привязку: ${deleteError.message}`
      );
    }
  }

  const { error: insertError } = await serviceSupabase
    .from("referral_attributions")
    .insert({
      referral_link_id: typedReferralLink.id,
      referrer_user_id: typedReferralLink.owner_user_id,
      referred_user_id: referredUserId,
      reward_percent: Number(typedReferralLink.reward_percent ?? 0),
    });

  if (insertError) {
    throw new Error(
      `Не удалось создать реферальную привязку: ${insertError.message}`
    );
  }

  return {
    created: true,
    referrerUserId: typedReferralLink.owner_user_id,
    referralLinkId: typedReferralLink.id,
    rewardPercent: Number(typedReferralLink.reward_percent ?? 0),
  };
}

export async function createReferralRewardForBillingTransaction(params: {
  serviceSupabase: ServiceSupabase;
  referredUserId: string;
  billingTransactionId: string;
  paymentAmount: number;
}) {
  const {
    serviceSupabase,
    referredUserId,
    billingTransactionId,
    paymentAmount,
  } = params;

  if (!referredUserId || !billingTransactionId) {
    return { created: false, skippedReason: "empty_input" };
  }

  const normalizedPaymentAmount = Number(paymentAmount ?? 0);

  if (!Number.isFinite(normalizedPaymentAmount) || normalizedPaymentAmount <= 0) {
    return { created: false, skippedReason: "invalid_amount" };
  }

  const { data: attribution, error: attributionError } = await serviceSupabase
    .from("referral_attributions")
    .select("*")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (attributionError) {
    throw new Error(
      `Не удалось загрузить реферальную привязку: ${attributionError.message}`
    );
  }

  if (!attribution) {
    return { created: false, skippedReason: "no_attribution" };
  }

  if (attribution.referrer_user_id === attribution.referred_user_id) {
    return { created: false, skippedReason: "self_referral" };
  }

  const { data: existingReward, error: existingRewardError } =
    await serviceSupabase
      .from("referral_rewards")
      .select("id")
      .eq("billing_transaction_id", billingTransactionId)
      .maybeSingle();

  if (existingRewardError) {
    throw new Error(
      `Не удалось проверить существующее реферальное начисление: ${existingRewardError.message}`
    );
  }

  if (existingReward) {
    return { created: false, skippedReason: "already_rewarded" };
  }

  const rewardPercent = Number(attribution.reward_percent ?? 0);
  const rewardAmount = Number(
    ((normalizedPaymentAmount * rewardPercent) / 100).toFixed(2)
  );

  if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
    return { created: false, skippedReason: "invalid_reward" };
  }

  const { error: insertError } = await serviceSupabase
    .from("referral_rewards")
    .insert({
      referral_attribution_id: attribution.id,
      referrer_user_id: attribution.referrer_user_id,
      referred_user_id: attribution.referred_user_id,
      billing_transaction_id: billingTransactionId,
      payment_amount: normalizedPaymentAmount,
      reward_percent: rewardPercent,
      reward_amount: rewardAmount,
      status: "approved",
    });

  if (insertError) {
    throw new Error(
      `Не удалось создать реферальное начисление: ${insertError.message}`
    );
  }

  return {
    created: true,
    rewardAmount,
    rewardPercent,
    referrerUserId: attribution.referrer_user_id,
  };
}
