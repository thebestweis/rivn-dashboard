import { NextResponse } from "next/server";
import { requireSuperAdminRoute, getErrorMessage } from "../../_utils";

export const dynamic = "force-dynamic";

type BroadcastBody = {
  title?: string;
  body?: string;
  linkUrl?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const { user, serviceSupabase } = await requireSuperAdminRoute();
    const body = (await request.json().catch(() => ({}))) as BroadcastBody;

    const title = normalizeText(body.title);
    const message = normalizeText(body.body);
    const linkUrl = normalizeText(body.linkUrl) || null;

    if (title.length < 3) {
      return NextResponse.json(
        { ok: false, error: "Напиши понятный заголовок уведомления" },
        { status: 400 }
      );
    }

    if (message.length < 5) {
      return NextResponse.json(
        { ok: false, error: "Напиши текст уведомления для клиентов" },
        { status: 400 }
      );
    }

    const { data: members, error: membersError } = await serviceSupabase
      .from("workspace_members")
      .select("workspace_id,user_id,status")
      .eq("status", "active");

    if (membersError) {
      throw new Error(membersError.message);
    }

    const uniqueRecipients = new Map<string, { userId: string }>();

    for (const member of members ?? []) {
      const userId = String(member.user_id ?? "");
      if (!userId) continue;

      uniqueRecipients.set(userId, { userId });
    }

    const rows = Array.from(uniqueRecipients.values()).map((recipient) => ({
      workspace_id: null,
      recipient_user_id: recipient.userId,
      title,
      body: message,
      kind: "marketing",
      link_url: linkUrl,
      source: "admin_broadcast",
      created_by: user.id,
      metadata: {
        sentFromAdmin: true,
      },
    }));

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Нет активных пользователей для рассылки" },
        { status: 400 }
      );
    }

    const { error: insertError } = await serviceSupabase
      .from("app_notifications")
      .insert(rows);

    if (insertError) {
      throw new Error(insertError.message);
    }

    await serviceSupabase.from("admin_action_logs").insert({
      admin_user_id: user.id,
      workspace_id: null,
      action_type: "broadcast_notification",
      action_payload: {
        title,
        body: message,
        linkUrl,
        recipientsCount: rows.length,
      },
    });

    return NextResponse.json({
      ok: true,
      recipientsCount: rows.length,
      error: "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        recipientsCount: 0,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
