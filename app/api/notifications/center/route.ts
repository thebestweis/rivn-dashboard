import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";
import { getFriendlyNotificationError } from "@/app/lib/notifications/center";

export const dynamic = "force-dynamic";

async function getRequestContext() {
  const authSupabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Пользователь не авторизован");
  }

  const serviceSupabase = createServiceRoleClient();

  const { data: profile, error: profileError } = await serviceSupabase
    .from("profiles")
    .select("id,last_active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const activeWorkspaceId = profile?.last_active_workspace_id ?? null;

  if (activeWorkspaceId) {
    const { data: membership, error: membershipError } = await serviceSupabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", activeWorkspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    if (!membership) {
      return { user, serviceSupabase, activeWorkspaceId: null };
    }
  }

  return { user, serviceSupabase, activeWorkspaceId };
}

export async function GET() {
  try {
    const { user, serviceSupabase, activeWorkspaceId } =
      await getRequestContext();

    let query = serviceSupabase
      .from("app_notifications")
      .select(
        "id,workspace_id,recipient_user_id,title,body,kind,link_url,source,created_at,read_at"
      )
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);

    if (activeWorkspaceId) {
      query = query.or(
        `workspace_id.eq.${activeWorkspaceId},workspace_id.is.null`
      );
    } else {
      query = query.is("workspace_id", null);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const notifications = data ?? [];
    const unreadCount = notifications.filter((item) => !item.read_at).length;

    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
      error: "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        notifications: [],
        unreadCount: 0,
        error: getFriendlyNotificationError(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, serviceSupabase, activeWorkspaceId } =
      await getRequestContext();
    const body = (await request.json().catch(() => ({}))) as {
      notificationId?: string;
      markAll?: boolean;
    };

    if (body.markAll) {
      let query = serviceSupabase
        .from("app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_user_id", user.id)
        .is("read_at", null);

      if (activeWorkspaceId) {
        query = query.or(
          `workspace_id.eq.${activeWorkspaceId},workspace_id.is.null`
        );
      } else {
        query = query.is("workspace_id", null);
      }

      const { error } = await query;

      if (error) throw new Error(error.message);

      return NextResponse.json({ ok: true, error: "" });
    }

    if (!body.notificationId) {
      return NextResponse.json(
        { ok: false, error: "Не выбрано уведомление" },
        { status: 400 }
      );
    }

    const { error } = await serviceSupabase
      .from("app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", body.notificationId)
      .eq("recipient_user_id", user.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, error: "" });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getFriendlyNotificationError(error),
      },
      { status: 500 }
    );
  }
}
