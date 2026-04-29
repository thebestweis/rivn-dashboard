import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";
import { createReferralAttributionByCode } from "@/app/lib/referral-server";

export async function POST(request: Request) {
  try {
    const authSupabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Пользователь не авторизован" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const referralCode = String(body?.referralCode ?? "").trim();
    const referredUserId = String(body?.referredUserId ?? "").trim();

    if (!referralCode) {
      return NextResponse.json({ ok: true, created: false });
    }

    if (referredUserId !== user.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Можно создавать реферальную привязку только для себя",
        },
        { status: 403 }
      );
    }

    const result = await createReferralAttributionByCode({
      serviceSupabase: createServiceRoleClient(),
      referralCode,
      referredUserId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("POST /api/referrals/attribution error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось создать реферальную привязку",
      },
      { status: 500 }
    );
  }
}
