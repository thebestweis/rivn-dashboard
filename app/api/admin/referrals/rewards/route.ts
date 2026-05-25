import { apiFailure, apiSuccess } from "@/app/lib/api/errors";
import { requireSuperAdminRoute } from "../../_utils";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["pending", "approved", "paid", "canceled"]);

export async function PATCH(request: Request) {
  try {
    const { user, serviceSupabase } = await requireSuperAdminRoute();
    const body = await request.json().catch(() => ({}));
    const rewardId = String(body?.rewardId ?? "").trim();
    const status = String(body?.status ?? "").trim();

    if (!rewardId) {
      return apiFailure({
        error: "Не выбрано реферальное начисление",
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    if (!allowedStatuses.has(status)) {
      return apiFailure({
        error: "Некорректный статус выплаты",
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const { data: currentReward, error: currentError } = await serviceSupabase
      .from("referral_rewards")
      .select("*")
      .eq("id", rewardId)
      .maybeSingle();

    if (currentError) throw new Error(currentError.message);
    if (!currentReward) {
      return apiFailure({
        error: "Реферальное начисление не найдено",
        status: 404,
        code: "NOT_FOUND",
      });
    }

    const { error: updateError } = await serviceSupabase
      .from("referral_rewards")
      .update({ status })
      .eq("id", rewardId);

    if (updateError) throw new Error(updateError.message);

    await serviceSupabase.from("admin_action_logs").insert({
      admin_user_id: user.id,
      workspace_id: null,
      action_type: "update_referral_reward_status",
      action_payload: {
        referral_reward_id: rewardId,
        previousStatus: currentReward.status,
        nextStatus: status,
        rewardAmount: currentReward.reward_amount,
        referrerUserId: currentReward.referrer_user_id,
        referredUserId: currentReward.referred_user_id,
      },
    });

    return apiSuccess({ status });
  } catch (error) {
    console.error("PATCH /api/admin/referrals/rewards error:", error);
    return apiFailure({ error, code: "DATABASE_ERROR" });
  }
}
