import { NextResponse } from "next/server";
import { requireSuperAdminRoute, getErrorMessage } from "../../_utils";
import {
  createReferralAttributionByCode,
  ensureStandardReferralLinkForUser,
} from "@/app/lib/referral-server";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const { user, serviceSupabase } = await requireSuperAdminRoute();
    const body = await request.json().catch(() => ({}));

    const workspaceId = String(body?.workspaceId ?? "").trim();
    const referredUserIdFromBody = String(body?.referredUserId ?? "").trim();
    const referrerInput = String(body?.referrer ?? "").trim();
    const replaceExisting = Boolean(body?.replaceExisting);

    if (!workspaceId && !referredUserIdFromBody) {
      return NextResponse.json(
        { ok: false, error: "Выбери кабинет или пользователя" },
        { status: 400 }
      );
    }

    if (!referrerInput) {
      return NextResponse.json(
        { ok: false, error: "Укажи email реферала или referral code" },
        { status: 400 }
      );
    }

    let referredUserId = referredUserIdFromBody;
    let logWorkspaceId: string | null = workspaceId || null;

    if (!referredUserId && workspaceId) {
      const { data: workspace, error: workspaceError } = await serviceSupabase
        .from("workspaces")
        .select("id, owner_user_id")
        .eq("id", workspaceId)
        .maybeSingle();

      if (workspaceError) {
        throw new Error(`Не удалось загрузить workspace: ${workspaceError.message}`);
      }

      if (!workspace?.owner_user_id) {
        throw new Error("У кабинета не найден владелец");
      }

      referredUserId = workspace.owner_user_id;
      logWorkspaceId = workspace.id;
    }

    let referralCode = referrerInput;
    let referrerUserId: string | null = null;

    if (referrerInput.includes("@")) {
      const email = normalizeEmail(referrerInput);
      const { data: referrerProfile, error: profileError } =
        await serviceSupabase
          .from("profiles")
          .select("id, email")
          .ilike("email", email)
          .maybeSingle();

      if (profileError) {
        throw new Error(
          `Не удалось найти пользователя-реферала: ${profileError.message}`
        );
      }

      if (!referrerProfile?.id) {
        throw new Error("Пользователь-реферал с таким email не найден");
      }

      referrerUserId = referrerProfile.id;

      const standardLink = await ensureStandardReferralLinkForUser({
        serviceSupabase,
        userId: referrerProfile.id,
        createdByUserId: user.id,
      });

      referralCode = standardLink.code;
    }

    const result = await createReferralAttributionByCode({
      serviceSupabase,
      referralCode,
      referredUserId,
      replaceExisting,
    });

    if (!result.created) {
      const reasonMap: Record<string, string> = {
        empty_input: "Не хватает данных для привязки",
        referral_link_not_found: "Активная реферальная ссылка не найдена",
        self_referral: "Нельзя привязать пользователя к самому себе",
        already_attributed:
          "У пользователя уже есть реферальная привязка. Включи замену, если нужно перезаписать.",
        has_rewards:
          "У старой привязки уже есть начисления. Автоматически заменять её опасно.",
      };

      return NextResponse.json(
        {
          ok: false,
          error:
            reasonMap[String(result.skippedReason)] ||
            "Реферальная привязка не создана",
          skippedReason: result.skippedReason,
        },
        { status: 400 }
      );
    }

    const { error: logError } = await serviceSupabase
      .from("admin_action_logs")
      .insert({
        admin_user_id: user.id,
        workspace_id: logWorkspaceId,
        action_type: "assign_referral_attribution",
        action_payload: {
          referredUserId,
          referrerUserId: result.referrerUserId ?? referrerUserId,
          referralCode,
          referralLinkId: result.referralLinkId,
          rewardPercent: result.rewardPercent,
          replaceExisting,
        },
      });

    if (logError) {
      throw new Error(`Не удалось записать admin log: ${logError.message}`);
    }

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error("POST /api/admin/referrals/assign error:", error);

    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
