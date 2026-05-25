import { apiFailure, apiSuccess } from "@/app/lib/api/errors";
import { requireSuperAdminRoute } from "../../_utils";

export const dynamic = "force-dynamic";

type RewardStatus = "all" | "pending" | "approved" | "paid" | "canceled";

type ReferralLinkRow = {
  id: string;
  owner_user_id: string;
  code: string;
  link_type: string;
  reward_percent: number | string;
  label: string | null;
  comment: string | null;
  is_active: boolean;
  created_at: string;
};

type ReferralAttributionRow = {
  id: string;
  referral_link_id: string | null;
};

type ReferralRewardRow = {
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
  profiles?: { email: string | null } | { email: string | null }[] | null;
};

function normalizeDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function getProfileEmail(row: ReferralRewardRow) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return profile?.email ?? null;
}

export async function GET(request: Request) {
  try {
    const { serviceSupabase } = await requireSuperAdminRoute();
    const url = new URL(request.url);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fromDate = normalizeDateParam(url.searchParams.get("from"), startOfMonth);
    const toDate = normalizeDateParam(url.searchParams.get("to"), now);
    const status = (url.searchParams.get("status") || "all") as RewardStatus;
    const linkId = url.searchParams.get("linkId") || "all";

    const [
      { data: links, error: linksError },
      { data: rewards, error: rewardsError },
    ] = await Promise.all([
      serviceSupabase
        .from("referral_links")
        .select("id,owner_user_id,code,link_type,reward_percent,label,comment,is_active,created_at")
        .order("created_at", { ascending: false }),
      serviceSupabase
        .from("referral_rewards")
        .select(
          `
          id,
          referral_attribution_id,
          referrer_user_id,
          referred_user_id,
          billing_transaction_id,
          payment_amount,
          reward_percent,
          reward_amount,
          status,
          created_at,
          profiles:referred_user_id (
            email
          )
        `
        )
        .gte("created_at", fromDate.toISOString())
        .lte("created_at", toDate.toISOString())
        .order("created_at", { ascending: false }),
    ]);

    if (linksError) throw new Error(linksError.message);
    if (rewardsError) throw new Error(rewardsError.message);

    const rewardRows = (rewards ?? []) as ReferralRewardRow[];
    const attributionIds = Array.from(
      new Set(rewardRows.map((item) => item.referral_attribution_id).filter(Boolean))
    );

    const { data: attributions, error: attributionsError } =
      attributionIds.length > 0
        ? await serviceSupabase
            .from("referral_attributions")
            .select("id,referral_link_id")
            .in("id", attributionIds)
        : { data: [], error: null };

    if (attributionsError) throw new Error(attributionsError.message);

    const linkById = new Map(
      ((links ?? []) as ReferralLinkRow[]).map((link) => [link.id, link])
    );
    const linkIdByAttributionId = new Map(
      ((attributions ?? []) as ReferralAttributionRow[]).map((item) => [
        item.id,
        item.referral_link_id,
      ])
    );

    const filteredRewards = rewardRows
      .map((reward) => {
        const rewardLinkId = linkIdByAttributionId.get(reward.referral_attribution_id) ?? null;
        const link = rewardLinkId ? linkById.get(rewardLinkId) ?? null : null;

        return {
          id: reward.id,
          referralLinkId: rewardLinkId,
          linkCode: link?.code ?? "unknown",
          partner: link?.label || link?.code || "Без названия",
          source: link?.comment || link?.link_type || "Реферальная ссылка",
          referrerUserId: reward.referrer_user_id,
          referredUserId: reward.referred_user_id,
          referredUserEmail: getProfileEmail(reward),
          billingTransactionId: reward.billing_transaction_id,
          paymentAmount: Number(reward.payment_amount ?? 0),
          rewardPercent: Number(reward.reward_percent ?? 0),
          rewardAmount: Number(reward.reward_amount ?? 0),
          status: reward.status,
          createdAt: reward.created_at,
        };
      })
      .filter((reward) => (status === "all" ? true : reward.status === status))
      .filter((reward) => (linkId === "all" ? true : reward.referralLinkId === linkId));

    const summaryByLink = new Map<
      string,
      {
        referralLinkId: string | null;
        partner: string;
        source: string;
        rewardsCount: number;
        paymentAmount: number;
        rewardAmount: number;
        paidAmount: number;
        unpaidAmount: number;
      }
    >();

    for (const reward of filteredRewards) {
      const key = reward.referralLinkId ?? "unknown";
      const current =
        summaryByLink.get(key) ??
        {
          referralLinkId: reward.referralLinkId,
          partner: reward.partner,
          source: reward.source,
          rewardsCount: 0,
          paymentAmount: 0,
          rewardAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
        };

      current.rewardsCount += 1;
      current.paymentAmount += reward.paymentAmount;
      current.rewardAmount += reward.rewardAmount;
      if (reward.status === "paid") {
        current.paidAmount += reward.rewardAmount;
      } else {
        current.unpaidAmount += reward.rewardAmount;
      }

      summaryByLink.set(key, current);
    }

    const totals = filteredRewards.reduce(
      (acc, reward) => {
        acc.rewardsCount += 1;
        acc.paymentAmount += reward.paymentAmount;
        acc.rewardAmount += reward.rewardAmount;
        if (reward.status === "paid") acc.paidAmount += reward.rewardAmount;
        else acc.unpaidAmount += reward.rewardAmount;
        return acc;
      },
      {
        rewardsCount: 0,
        paymentAmount: 0,
        rewardAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
      }
    );

    return apiSuccess({
      period: {
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
      },
      links: (links ?? []).map((link) => ({
        id: link.id,
        code: link.code,
        label: link.label,
        comment: link.comment,
        rewardPercent: Number(link.reward_percent ?? 0),
        isActive: link.is_active,
      })),
      totals,
      summaryByLink: Array.from(summaryByLink.values()),
      rewards: filteredRewards,
    });
  } catch (error) {
    console.error("GET /api/admin/referrals/summary error:", error);
    return apiFailure({ error, code: "DATABASE_ERROR" });
  }
}
