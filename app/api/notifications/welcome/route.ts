import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";

export const dynamic = "force-dynamic";

const WELCOME_NOTIFICATION_SOURCE = "welcome_registration";

const WELCOME_NOTIFICATION_TITLE =
  "Добро пожаловать в RIVN OS! Вот инструкция по использованию 👇";

const WELCOME_NOTIFICATION_BODY = [
  "Поздравляем с регистрацией! Чтобы быстрее разобраться в системе, начни с короткого гайда: открой раздел “Инструкция” и посмотри видео с обзором платформы.",
  "",
  "Если хочешь разобраться сам, то вот тебе быстрый гайд:",
  "1) Заполни настройки кабинета. Постарайся заполнить максимум параметров.",
  "2) Если есть сотрудники - пригласи их.",
  "3) Добавь своих клиентов.",
  "4) Под клиентов создай проекты.",
  "5) Поставь первые задачи.",
  "6) Зафиксируй оплаты/расходы.",
  "",
  "Будем рады помочь развивать и улучшать твой бизнес!",
  "",
  "С заботой, команда RIVN OS ❤️",
].join("\n");

export async function POST() {
  try {
    const authSupabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Сессия закончилась. Войди заново." },
        { status: 401 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    const { data: profile, error: profileError } = await serviceSupabase
      .from("profiles")
      .select("last_active_workspace_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    const workspaceId = profile?.last_active_workspace_id ?? null;

    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Кабинет ещё не создан." },
        { status: 400 }
      );
    }

    const { data: membership, error: membershipError } = await serviceSupabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "Нет доступа к кабинету." },
        { status: 403 }
      );
    }

    const { data: existingNotification, error: existingError } =
      await serviceSupabase
        .from("app_notifications")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("recipient_user_id", user.id)
        .eq("source", WELCOME_NOTIFICATION_SOURCE)
        .limit(1)
        .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingNotification) {
      return NextResponse.json({ ok: true, created: false, error: "" });
    }

    const { error: insertError } = await serviceSupabase
      .from("app_notifications")
      .insert({
        workspace_id: workspaceId,
        recipient_user_id: user.id,
        title: WELCOME_NOTIFICATION_TITLE,
        body: WELCOME_NOTIFICATION_BODY,
        kind: "marketing",
        link_url: "/guide",
        source: WELCOME_NOTIFICATION_SOURCE,
        metadata: {
          event_key: WELCOME_NOTIFICATION_SOURCE,
          guide_url: "https://rivnos.ru/guide",
        },
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({ ok: true, created: true, error: "" });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось создать приветственное уведомление.",
      },
      { status: 500 }
    );
  }
}
