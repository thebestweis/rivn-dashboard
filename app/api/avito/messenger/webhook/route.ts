import { createClient } from "@supabase/supabase-js";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";

export const dynamic = "force-dynamic";

type AvitoWebhookBody = {
  id?: string;
  payload?: {
    type?: string;
    value?: {
      id?: string;
      user_id?: number | string;
      author_id?: number | string;
      chat_id?: string;
      chat_type?: string;
      item_id?: number | string | null;
      type?: string;
      content?: {
        text?: string | null;
        link?: { text?: string | null; url?: string | null } | null;
        item?: { title?: string | null; item_url?: string | null } | null;
      };
      created?: number;
      published_at?: string;
    };
  };
  timestamp?: number;
  version?: string;
};

type ServiceSupabase = ReturnType<typeof getSupabase>;

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

function getInternalSecret() {
  return (
    process.env.CRM_WEBHOOK_SECRET ||
    process.env.CRON_SECRET ||
    process.env.VERCEL_CRON_SECRET
  );
}

function getMessageText(value: NonNullable<AvitoWebhookBody["payload"]>["value"]) {
  const content = value?.content;

  if (!content) {
    return value?.type ? `Новое сообщение Avito: ${value.type}` : "";
  }

  if (content.text) {
    return content.text;
  }

  if (content.link?.text || content.link?.url) {
    return [content.link.text, content.link.url].filter(Boolean).join("\n");
  }

  if (content.item?.title || content.item?.item_url) {
    return [content.item.title, content.item.item_url].filter(Boolean).join("\n");
  }

  return value?.type ? `Новое сообщение Avito: ${value.type}` : "";
}

function getLinkedClient(account: any) {
  return Array.isArray(account?.avito_report_clients)
    ? account.avito_report_clients[0]
    : account?.avito_report_clients;
}

async function getAvitoChatItem(params: {
  account: any;
  avitoUserId: string;
  chatId: string;
}) {
  if (!params.account?.avito_client_id || !params.account?.avito_client_secret) {
    return null;
  }

  try {
    const accessToken = await getAvitoAccessToken({
      clientId: params.account.avito_client_id,
      clientSecret: params.account.avito_client_secret,
    });

    const response = await fetch(
      `https://api.avito.ru/messenger/v2/accounts/${params.avitoUserId}/chats/${params.chatId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.warn("Avito chat details were not loaded:", data);
      return null;
    }

    const contextValue = data?.context?.value;

    return {
      id: contextValue?.id ? String(contextValue.id) : null,
      title: contextValue?.title ? String(contextValue.title) : null,
      url: contextValue?.url ? String(contextValue.url) : null,
    };
  } catch (error) {
    console.warn("Avito chat item lookup failed:", error);
    return null;
  }
}

async function findAvitoAccount(params: {
  supabase: ServiceSupabase;
  avitoUserId: string;
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
        avito_report_clients!inner (
          workspace_id,
          name
        )
      `
    )
    .eq("avito_user_id", params.avitoUserId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Avito account lookup failed: ${error.message}`);
  }

  return data;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as AvitoWebhookBody;
    const value = body.payload?.value;

    if (!value?.user_id || !value.chat_id || !value.id) {
      return Response.json({ ok: true, skipped: true });
    }

    const avitoUserId = String(value.user_id);
    const authorId = String(value.author_id ?? "");

    if (authorId && authorId === avitoUserId) {
      return Response.json({ ok: true, skipped: "outgoing_message" });
    }

    const text = getMessageText(value);

    if (!text) {
      return Response.json({ ok: true, skipped: "empty_message" });
    }

    const supabase = getSupabase();
    const account = await findAvitoAccount({ supabase, avitoUserId });
    const linkedClient = getLinkedClient(account);
    const chatItem = await getAvitoChatItem({
      account,
      avitoUserId,
      chatId: value.chat_id,
    });

    if (!linkedClient?.workspace_id) {
      return Response.json({ ok: true, skipped: "account_not_connected" });
    }

    const secret = getInternalSecret();

    if (!secret) {
      throw new Error("CRM webhook secret is not configured");
    }

    const clientName =
      linkedClient.name || account?.name || "Клиент Avito";
    const title = value.item_id
      ? `Avito: объявление ${value.item_id}`
      : `Avito: ${clientName}`;

    const sourceItemId = String(value.item_id ?? chatItem?.id ?? "");
    const sourceItemTitle =
      chatItem?.title || value.content?.item?.title || null;
    const sourceItemUrl =
      chatItem?.url || value.content?.item?.item_url || null;

    const crmResponse = await fetch(new URL("/api/crm/dialogs", request.url), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: linkedClient.workspace_id,
        channel: "avito",
        avitoUserId,
        externalDialogId: value.chat_id,
        externalMessageId: value.id,
        sourceKind: "avito",
        sourceName: "Avito",
        title,
        clientName,
        sourceItemId,
        sourceItemTitle,
        sourceItemUrl,
        body: text,
        senderType: "client",
        createdAt: value.published_at
          ? value.published_at
          : value.created
            ? new Date(value.created * 1000).toISOString()
            : new Date().toISOString(),
      }),
      cache: "no-store",
    });

    const crmResult = await crmResponse.json().catch(() => null);

    if (!crmResponse.ok || !crmResult?.ok) {
      throw new Error(
        `CRM dialog webhook failed: ${JSON.stringify(crmResult)}`
      );
    }

    return Response.json({ ok: true, crm: crmResult });
  } catch (error) {
    console.error("Avito messenger webhook failed:", error);

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Avito messenger webhook failed",
      },
      { status: 500 }
    );
  }
}
