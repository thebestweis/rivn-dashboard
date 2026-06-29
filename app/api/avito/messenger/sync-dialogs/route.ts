import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";
import { POST as saveCrmDialog } from "@/app/api/crm/dialogs/route";

export const dynamic = "force-dynamic";

type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

type AvitoChat = {
  id: string;
  created?: number;
  updated?: number;
  created_at?: number;
  updated_at?: number;
  last_message?: {
    created?: number;
    created_at?: number;
  };
  context?: {
    value?: {
      id?: number | string;
      title?: string;
      url?: string;
    };
  };
  users?: {
    id?: number | string;
    name?: string;
  }[];
};

type AvitoMessage = {
  id: string;
  author_id?: number | string;
  direction?: "in" | "out";
  created?: number;
  type?: string;
  content?: {
    text?: string | null;
    link?: { text?: string | null; url?: string | null } | null;
    item?: { title?: string | null; item_url?: string | null } | null;
    voice?: { voice_id?: string | null } | null;
    image?: { sizes?: Record<string, string> | null } | null;
  };
};

type LinkedAvitoAccount = {
  avito_report_clients?: unknown[] | unknown;
};

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

function formatAvitoMessengerError(
  data: unknown,
  status: number,
  action: string
) {
  const payload =
    data && typeof data === "object"
      ? (data as { code?: number | string; message?: string })
      : null;
  const message =
    typeof payload?.message === "string"
      ? payload.message
      : typeof data === "string"
        ? data
        : "";

  if (status === 402 || payload?.code === 402 || payload?.code === "402") {
    return `Avito Messenger API недоступен для этого аккаунта. Avito ответил: ${
      message || "нужна подписка на API мессенджера"
    }`;
  }

  return `Avito не отдал ${action}. Статус: ${status}. Ответ: ${
    message || JSON.stringify(data) || "пустой ответ"
  }`;
}

function getInternalSecret() {
  return (
    process.env.CRM_WEBHOOK_SECRET ||
    process.env.CRON_SECRET ||
    process.env.VERCEL_CRON_SECRET
  );
}

function getLinkedClient(account: LinkedAvitoAccount) {
  return Array.isArray(account?.avito_report_clients)
    ? account.avito_report_clients[0]
    : account?.avito_report_clients;
}

function getMessageBody(message: AvitoMessage) {
  const content = message.content;

  if (content?.text) {
    return content.text;
  }

  if (content?.link?.text || content?.link?.url) {
    return [content.link.text, content.link.url].filter(Boolean).join("\n");
  }

  if (content?.item?.title || content?.item?.item_url) {
    return [content.item.title, content.item.item_url].filter(Boolean).join("\n");
  }

  if (content?.voice?.voice_id) {
    return `Голосовое сообщение Avito (${content.voice.voice_id})`;
  }

  if (content?.image?.sizes) {
    return "Изображение Avito";
  }

  return message.type ? `Сообщение Avito: ${message.type}` : "";
}

function getImageUrl(message: AvitoMessage) {
  const sizes = message.content?.image?.sizes;
  if (!sizes) return null;

  return (
    sizes["1280x960"] ||
    sizes["640x480"] ||
    sizes["320x240"] ||
    Object.values(sizes).find(Boolean) ||
    null
  );
}

function getChatTimestamp(chat: AvitoChat) {
  return Number(
    chat.updated ||
      chat.updated_at ||
      chat.last_message?.created ||
      chat.last_message?.created_at ||
      chat.created ||
      chat.created_at ||
      0
  );
}

function normalizeAvitoChats(data: unknown): AvitoChat[] {
  if (Array.isArray(data)) {
    return data as AvitoChat[];
  }

  const payload = data as {
    chats?: unknown;
    result?: { chats?: unknown };
  };

  if (Array.isArray(payload.chats)) {
    return payload.chats as AvitoChat[];
  }

  if (Array.isArray(payload.result?.chats)) {
    return payload.result.chats as AvitoChat[];
  }

  return [];
}

function normalizeAvitoMessages(data: unknown): AvitoMessage[] {
  if (Array.isArray(data)) {
    return data as AvitoMessage[];
  }

  const payload = data as {
    messages?: unknown;
    result?: { messages?: unknown };
    0?: { messages?: unknown };
  };

  if (Array.isArray(payload.messages)) {
    return payload.messages as AvitoMessage[];
  }

  if (Array.isArray(payload.result?.messages)) {
    return payload.result.messages as AvitoMessage[];
  }

  if (Array.isArray(payload[0]?.messages)) {
    return payload[0].messages as AvitoMessage[];
  }

  return [];
}

async function requireWorkspaceAccess(
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
}

async function getAccount(params: {
  supabase: ServiceSupabase;
  workspaceId: string;
  accountId: string;
}) {
  const { data, error } = await params.supabase
    .from("avito_report_accounts")
    .select(
      `
        id,
        name,
        avito_user_id,
        avito_client_id,
        avito_client_secret,
        is_active,
        crm_dialogs_enabled,
        avito_report_clients!inner (
          workspace_id,
          name
        )
      `
    )
    .eq("id", params.accountId)
    .eq("avito_report_clients.workspace_id", params.workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Ошибка поиска Avito-аккаунта: ${error.message}`);
  }

  if (!data) {
    throw new HttpError("Avito-аккаунт не найден в этом кабинете", 404);
  }

  if (!data.is_active) {
    throw new HttpError("Сначала включи Avito-аккаунт", 400);
  }

  if (data.crm_dialogs_enabled === false) {
    throw new HttpError(
      "Приём заявок и диалогов в CRM выключен для этого Avito-аккаунта",
      400
    );
  }

  if (!data.avito_user_id || !data.avito_client_id || !data.avito_client_secret) {
    throw new HttpError(
      "В аккаунте не заполнены Avito user_id, client_id или client_secret",
      400
    );
  }

  return data;
}

async function fetchChats(params: {
  accessToken: string;
  avitoUserId: string;
  sinceUnix: number;
  maxChats: number;
}) {
  const chats: AvitoChat[] = [];
  const limit = 50;
  let offset = 0;

  while (chats.length < params.maxChats && offset <= 1000) {
    const response = await fetch(
      `https://api.avito.ru/messenger/v2/accounts/${params.avitoUserId}/chats?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        formatAvitoMessengerError(data, response.status, "список чатов")
      );
    }

    if (!response.ok) {
      throw new Error(`Avito не отдал список чатов: ${JSON.stringify(data)}`);
    }

    const batch = normalizeAvitoChats(data);
    const relevant = batch.filter((chat) => getChatTimestamp(chat) >= params.sinceUnix);

    chats.push(...relevant);

    if (batch.length < limit) break;

    const oldestUpdated = Math.min(...batch.map((chat) => getChatTimestamp(chat)));

    if (oldestUpdated < params.sinceUnix) break;

    offset += limit;
  }

  return chats.slice(0, params.maxChats);
}

async function fetchMessages(params: {
  accessToken: string;
  avitoUserId: string;
  chatId: string;
}) {
  const response = await fetch(
    `https://api.avito.ru/messenger/v3/accounts/${params.avitoUserId}/chats/${params.chatId}/messages/?limit=100`,
    {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      formatAvitoMessengerError(data, response.status, "сообщения")
    );
  }

  if (!response.ok) {
    throw new Error(`Avito не отдал сообщения: ${JSON.stringify(data)}`);
  }

  return normalizeAvitoMessages(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = String(body.workspaceId || "").trim();
    const accountId = String(body.accountId || "").trim();
    const days = Math.min(Math.max(Number(body.days || 14), 1), 90);
    const maxChats = Math.min(Math.max(Number(body.maxChats || 30), 1), 100);

    if (!workspaceId) {
      throw new HttpError("workspaceId is required", 400);
    }

    if (!accountId) {
      throw new HttpError("accountId is required", 400);
    }

    const secret = getInternalSecret();

    if (!secret) {
      throw new Error("CRM webhook secret is not configured");
    }

    const supabase = getServiceSupabase();
    await requireWorkspaceAccess(supabase, workspaceId);

    const account = await getAccount({ supabase, workspaceId, accountId });
    const linkedClient = getLinkedClient(account);
    const avitoUserId = String(account.avito_user_id);
    const accessToken = await getAvitoAccessToken({
      clientId: account.avito_client_id,
      clientSecret: account.avito_client_secret,
    });
    const sinceUnix = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
    const chats = await fetchChats({
      accessToken,
      avitoUserId,
      sinceUnix,
      maxChats,
    });

    let syncedMessages = 0;
    let createdOrTouchedDeals = 0;
    let messagesChecked = 0;
    let emptyMessages = 0;
    let duplicateMessages = 0;
    let incomingMessages = 0;
    let outgoingMessages = 0;
    const emptyChatIds: string[] = [];
    const sampleMessageIds: string[] = [];

    for (const chat of chats) {
      const messages = await fetchMessages({
        accessToken,
        avitoUserId,
        chatId: chat.id,
      });

      if (messages.length === 0 && emptyChatIds.length < 5) {
        emptyChatIds.push(chat.id);
      }

      const sourceItemId = chat.context?.value?.id
        ? String(chat.context.value.id)
        : "";
      const sourceItemTitle = chat.context?.value?.title ?? null;
      const sourceItemUrl = chat.context?.value?.url ?? null;
      const clientName =
        chat.users?.find((user) => String(user.id) !== avitoUserId)?.name ||
        linkedClient?.name ||
        account.name ||
        "Клиент Avito";
      const title = sourceItemTitle
        ? `Avito: ${sourceItemTitle}`
        : `Avito: ${clientName}`;

      for (const message of [...messages].sort(
        (a, b) => Number(a.created || 0) - Number(b.created || 0)
      )) {
        if (!message.id) continue;

        messagesChecked += 1;
        if (sampleMessageIds.length < 5) {
          sampleMessageIds.push(message.id);
        }

        const messageBody = getMessageBody(message);
        if (!messageBody) {
          emptyMessages += 1;
          continue;
        }

        const senderType =
          message.direction === "out" || String(message.author_id ?? "") === avitoUserId
            ? "manager"
            : "client";

        if (senderType === "manager") {
          outgoingMessages += 1;
        } else {
          incomingMessages += 1;
        }

        const crmResponse = await saveCrmDialog(new Request("http://rivn.local/api/crm/dialogs", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workspaceId,
            channel: "avito",
            avitoUserId,
            externalDialogId: chat.id,
            externalMessageId: message.id,
            sourceKind: "avito",
            sourceName: "Avito",
            title,
            clientName,
            sourceItemId,
            sourceItemTitle,
            sourceItemUrl,
            body: messageBody,
            attachmentUrl: getImageUrl(message),
            senderType,
            createdAt: message.created
              ? new Date(message.created * 1000).toISOString()
              : new Date().toISOString(),
          }),
        }));

        const crmResult = await crmResponse.json().catch(() => null);

        if (!crmResponse.ok || !crmResult?.ok) {
          throw new Error(
            `CRM не сохранила диалог: ${JSON.stringify(crmResult)}`
          );
        }

        syncedMessages += crmResult.duplicate ? 0 : 1;
        createdOrTouchedDeals += crmResult.duplicate ? 0 : 1;
        duplicateMessages += crmResult.duplicate ? 1 : 0;
      }
    }

    return Response.json({
      ok: true,
      accountId: account.id,
      chatsChecked: chats.length,
      messagesChecked,
      messagesSynced: syncedMessages,
      dealsTouched: createdOrTouchedDeals,
      duplicateMessages,
      emptyMessages,
      incomingMessages,
      outgoingMessages,
      emptyChatIds,
      sampleMessageIds,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось загрузить Avito-диалоги",
      },
      { status: getErrorStatus(error) }
    );
  }
}
