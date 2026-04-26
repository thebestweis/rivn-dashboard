import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";

export const dynamic = "force-dynamic";

type MessagePayload = {
  conversation_id?: string;
  deal_id?: string | null;
  body?: string;
  attachment_url?: string | null;
  external_id?: string | null;
};

type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase env is missing");
  }

  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getErrorStatus(error: unknown) {
  return error instanceof HttpError ? error.status : 500;
}

function parseAvitoConversationExternalId(externalId: string | null) {
  const [avitoUserId, ...chatParts] = (externalId ?? "").split(":");
  const chatId = chatParts.join(":");

  if (!avitoUserId || !chatId) {
    throw new Error("Avito-диалог не привязан к аккаунту. Нужен формат avito_user_id:chat_id");
  }

  return { avitoUserId, chatId };
}

async function requireWorkspaceMembership(
  supabase: ServiceSupabase,
  workspaceId: string
) {
  const authSupabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    throw new HttpError("Пользователь не авторизован", 401);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Ошибка проверки доступа: ${membershipError.message}`);
  }

  if (!membership) {
    throw new HttpError("Нет доступа к этому кабинету", 403);
  }

  return membership;
}

async function sendAvitoTextMessage(params: {
  supabase: ServiceSupabase;
  workspaceId: string;
  avitoUserId: string;
  chatId: string;
  text: string;
}) {
  const { data: account, error: accountError } = await params.supabase
    .from("avito_report_accounts")
    .select(
      `
        id,
        avito_user_id,
        avito_client_id,
        avito_client_secret,
        avito_report_clients!inner (
          workspace_id
        )
      `
    )
    .eq("avito_user_id", params.avitoUserId)
    .eq("is_active", true)
    .eq("avito_report_clients.workspace_id", params.workspaceId)
    .maybeSingle();

  if (accountError) {
    throw new Error(`Ошибка поиска Avito-аккаунта: ${accountError.message}`);
  }

  if (!account) {
    throw new Error("Avito-аккаунт для этого диалога не найден в кабинете");
  }

  const accessToken = await getAvitoAccessToken({
    clientId: account.avito_client_id,
    clientSecret: account.avito_client_secret,
  });

  const response = await fetch(
    `https://api.avito.ru/messenger/v1/accounts/${params.avitoUserId}/chats/${params.chatId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        type: "text",
        message: {
          text: params.text.slice(0, 1000),
        },
      }),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Avito не принял сообщение: ${JSON.stringify(data)}`);
  }

  return data as { id?: string; created?: number };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as MessagePayload;
    const conversationId = payload.conversation_id?.trim();
    const body = payload.body?.trim();

    if (!conversationId) {
      throw new HttpError("conversation_id is required", 400);
    }

    if (!body) {
      throw new HttpError("Сообщение не может быть пустым", 400);
    }

    const supabase = getServiceSupabase();
    const { data: conversation, error: conversationError } = await supabase
      .from("crm_conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();

    if (conversationError) {
      throw new Error(`Ошибка поиска CRM-диалога: ${conversationError.message}`);
    }

    if (!conversation) {
      throw new HttpError("CRM-диалог не найден", 404);
    }

    const membership = await requireWorkspaceMembership(
      supabase,
      conversation.workspace_id
    );

    const dealId = payload.deal_id ?? conversation.deal_id ?? null;
    let externalMessageId = payload.external_id ?? null;
    let createdAt = new Date().toISOString();

    if (conversation.channel === "avito") {
      const { avitoUserId, chatId } = parseAvitoConversationExternalId(
        conversation.external_id
      );

      const avitoMessage = await sendAvitoTextMessage({
        supabase,
        workspaceId: conversation.workspace_id,
        avitoUserId,
        chatId,
        text: body,
      });

      externalMessageId = avitoMessage.id ?? externalMessageId;
      createdAt = avitoMessage.created
        ? new Date(avitoMessage.created * 1000).toISOString()
        : createdAt;
    }

    const { data: message, error: messageError } = await supabase
      .from("crm_messages")
      .insert({
        workspace_id: conversation.workspace_id,
        conversation_id: conversation.id,
        deal_id: dealId,
        sender_type: "manager",
        sender_member_id: membership.id,
        body,
        attachment_url: payload.attachment_url ?? null,
        external_id: externalMessageId,
        created_at: createdAt,
      })
      .select("*")
      .single();

    if (messageError || !message) {
      throw new Error(
        `Не удалось сохранить сообщение CRM: ${messageError?.message ?? "нет данных"}`
      );
    }

    await supabase
      .from("crm_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id)
      .eq("workspace_id", conversation.workspace_id);

    if (dealId) {
      await supabase.from("crm_deal_activities").insert({
        workspace_id: conversation.workspace_id,
        deal_id: dealId,
        actor_member_id: membership.id,
        action: "message_created",
        payload: {
          conversation_id: conversation.id,
          message_id: message.id,
          channel: conversation.channel,
        },
      });
    }

    return Response.json({ ok: true, message });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Не удалось отправить сообщение",
      },
      { status: getErrorStatus(error) }
    );
  }
}
