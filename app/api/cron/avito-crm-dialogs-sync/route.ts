import { createClient } from "@supabase/supabase-js";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";
import { POST as saveCrmDialog } from "@/app/api/crm/dialogs/route";
import { verifyCronSecret } from "../verify-cron-secret";

export const dynamic = "force-dynamic";

type ServiceSupabase = ReturnType<typeof getSupabase>;

type AvitoAccount = {
  id: string;
  name: string | null;
  avito_user_id: string | null;
  avito_client_id: string | null;
  avito_client_secret: string | null;
  avito_report_clients?:
    | {
        workspace_id?: string | null;
        name?: string | null;
      }
    | {
        workspace_id?: string | null;
        name?: string | null;
      }[]
    | null;
};

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase env is missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isLocalUrl(value: string) {
  return (
    value.includes("localhost") ||
    value.includes("127.0.0.1") ||
    value.includes("0.0.0.0")
  );
}

function normalizeAppUrl(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const candidates = [
    process.env.AVITO_MESSENGER_WEBHOOK_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    requestOrigin,
    "https://rivnos.ru",
  ].filter((value): value is string => Boolean(value));

  const baseUrl =
    candidates.find(
      (value) => value.startsWith("https://") && !isLocalUrl(value)
    ) ??
    candidates.find((value) => !isLocalUrl(value)) ??
    candidates[candidates.length - 1];

  return baseUrl.replace(/\/$/, "");
}

function getInternalSecret() {
  return (
    process.env.CRM_WEBHOOK_SECRET ||
    process.env.CRON_SECRET ||
    process.env.VERCEL_CRON_SECRET
  );
}

function getLinkedClient(account: AvitoAccount) {
  return Array.isArray(account.avito_report_clients)
    ? account.avito_report_clients[0]
    : account.avito_report_clients;
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

async function readAvitoResponse(response: Response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function loadAccounts(supabase: ServiceSupabase, limit: number) {
  const { data, error } = await supabase
    .from("avito_report_accounts")
    .select(
      `
        id,
        name,
        avito_user_id,
        avito_client_id,
        avito_client_secret,
        avito_report_clients!inner (
          workspace_id,
          name
        )
      `
    )
    .eq("is_active", true)
    .or("crm_dialogs_enabled.is.null,crm_dialogs_enabled.eq.true")
    .not("avito_user_id", "is", null)
    .not("avito_client_id", "is", null)
    .not("avito_client_secret", "is", null)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Avito CRM accounts lookup failed: ${error.message}`);
  }

  return (data ?? []) as AvitoAccount[];
}

async function registerWebhook(params: {
  accessToken: string;
  webhookUrl: string;
}) {
  const response = await fetch("https://api.avito.ru/messenger/v3/webhook", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      url: params.webhookUrl,
    }),
    cache: "no-store",
  });

  const data = await readAvitoResponse(response);

  if (!response.ok) {
    throw new Error(
      `Avito webhook reconnect failed (${response.status}): ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }
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
        `Avito chats fetch failed (${response.status}): ${JSON.stringify(data)}`
      );
    }

    const batch = normalizeAvitoChats(data);
    const relevant = batch.filter(
      (chat) => getChatTimestamp(chat) >= params.sinceUnix
    );

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
      `Avito messages fetch failed (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return normalizeAvitoMessages(data);
}

async function syncAccountDialogs(params: {
  account: AvitoAccount;
  accessToken: string;
  days: number;
  maxChats: number;
  secret: string;
}) {
  const linkedClient = getLinkedClient(params.account);
  const workspaceId = linkedClient?.workspace_id;
  const avitoUserId = String(params.account.avito_user_id ?? "");

  if (!workspaceId || !avitoUserId) {
    return {
      chatsChecked: 0,
      messagesChecked: 0,
      messagesSynced: 0,
      duplicateMessages: 0,
      skipped: "not_linked",
    };
  }

  const sinceUnix = Math.floor(Date.now() / 1000) - params.days * 24 * 60 * 60;
  const chats = await fetchChats({
    accessToken: params.accessToken,
    avitoUserId,
    sinceUnix,
    maxChats: params.maxChats,
  });

  let messagesChecked = 0;
  let messagesSynced = 0;
  let duplicateMessages = 0;

  for (const chat of chats) {
    const messages = await fetchMessages({
      accessToken: params.accessToken,
      avitoUserId,
      chatId: chat.id,
    });
    const sourceItemId = chat.context?.value?.id
      ? String(chat.context.value.id)
      : "";
    const sourceItemTitle = chat.context?.value?.title ?? null;
    const sourceItemUrl = chat.context?.value?.url ?? null;
    const clientName =
      chat.users?.find((user) => String(user.id) !== avitoUserId)?.name ||
      linkedClient?.name ||
      params.account.name ||
      "Клиент Avito";
    const title = sourceItemTitle
      ? `Avito: ${sourceItemTitle}`
      : `Avito: ${clientName}`;

    for (const message of [...messages].sort(
      (left, right) => Number(left.created || 0) - Number(right.created || 0)
    )) {
      if (!message.id) continue;

      messagesChecked += 1;

      const body = getMessageBody(message);
      if (!body) continue;

      const senderType =
        message.direction === "out" ||
        String(message.author_id ?? "") === avitoUserId
          ? "manager"
          : "client";

      const crmResponse = await saveCrmDialog(
        new Request("http://rivn.local/api/crm/dialogs", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.secret}`,
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
            body,
            attachmentUrl: getImageUrl(message),
            senderType,
            createdAt: message.created
              ? new Date(message.created * 1000).toISOString()
              : new Date().toISOString(),
          }),
        })
      );
      const crmResult = await crmResponse.json().catch(() => null);

      if (!crmResponse.ok || !crmResult?.ok) {
        throw new Error(`CRM dialog save failed: ${JSON.stringify(crmResult)}`);
      }

      if (crmResult.duplicate) {
        duplicateMessages += 1;
      } else {
        messagesSynced += 1;
      }
    }
  }

  return {
    chatsChecked: chats.length,
    messagesChecked,
    messagesSynced,
    duplicateMessages,
  };
}

export async function GET(request: Request) {
  try {
    if (!verifyCronSecret(request)) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") || 50), 1),
      200
    );
    const days = Math.min(
      Math.max(Number(url.searchParams.get("days") || 2), 1),
      14
    );
    const maxChats = Math.min(
      Math.max(Number(url.searchParams.get("maxChats") || 20), 1),
      100
    );
    const webhookUrl = `${normalizeAppUrl(request)}/api/avito/messenger/webhook`;
    const secret = getInternalSecret();

    if (!secret) {
      throw new Error("CRM webhook secret is not configured");
    }

    const supabase = getSupabase();
    const accounts = await loadAccounts(supabase, limit);
    const results = [];

    for (const account of accounts) {
      try {
        const accessToken = await getAvitoAccessToken({
          clientId: String(account.avito_client_id),
          clientSecret: String(account.avito_client_secret),
        });

        await registerWebhook({ accessToken, webhookUrl });

        const syncResult = await syncAccountDialogs({
          account,
          accessToken,
          days,
          maxChats,
          secret,
        });

        results.push({
          accountId: account.id,
          avitoUserId: account.avito_user_id,
          status: "success",
          webhook: "connected",
          ...syncResult,
        });
      } catch (error) {
        results.push({
          accountId: account.id,
          avitoUserId: account.avito_user_id,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return Response.json({
      ok: true,
      webhookUrl,
      accountsChecked: accounts.length,
      results,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Avito CRM dialogs sync failed",
      },
      { status: 500 }
    );
  }
}
