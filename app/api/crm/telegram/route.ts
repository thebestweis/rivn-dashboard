import { ApiAccessError } from "@/app/api/_guards";
import { readJsonWithLimit } from "@/app/api/_request";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

type TelegramMessage = {
  message_id: number;
  date?: number;
  text?: string;
  caption?: string;
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  from?: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  photo?: Array<{ file_id: string }>;
  document?: { file_id: string; file_name?: string };
};

function normalizeText(value: unknown) {
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value).trim();
  }

  return typeof value === "string" ? value.trim() : "";
}

function getPersonName(message: TelegramMessage) {
  const from = message.from;
  const chat = message.chat;

  return (
    [from?.first_name, from?.last_name].filter(Boolean).join(" ") ||
    from?.username ||
    [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
    chat.username ||
    chat.title ||
    `Telegram ${chat.id}`
  );
}

function getAttachmentUrl(message: TelegramMessage) {
  const fileId =
    message.document?.file_id ??
    message.photo?.[message.photo.length - 1]?.file_id ??
    null;

  return fileId ? `telegram:file:${fileId}` : null;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = normalizeText(url.searchParams.get("workspaceId"));
    const secret = normalizeText(url.searchParams.get("secret"));

    if (!workspaceId) {
      return Response.json(
        { ok: false, error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const update = await readJsonWithLimit<TelegramUpdate>(request, 256 * 1024);
    const message = update.message ?? update.edited_message ?? null;

    if (!message?.chat?.id) {
      return Response.json({ ok: true, skipped: true });
    }

    const body = normalizeText(message.text) || normalizeText(message.caption);
    const attachmentUrl = getAttachmentUrl(message);

    if (!body && !attachmentUrl) {
      return Response.json({ ok: true, skipped: true });
    }

    const externalDialogId = String(message.chat.id);
    const externalMessageId = String(message.message_id);
    const clientName = getPersonName(message);
    const telegramUsername =
      message.from?.username || message.chat.username
        ? `@${message.from?.username ?? message.chat.username}`
        : "";

    const dialogResponse = await fetch(
      new URL("/api/crm/dialogs", request.url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
          ...(request.headers.get("authorization")
            ? { Authorization: request.headers.get("authorization") as string }
            : {}),
          ...(request.headers.get("x-rivn-secret")
            ? {
                "x-rivn-secret": request.headers.get(
                  "x-rivn-secret"
                ) as string,
              }
            : {}),
        },
        body: JSON.stringify({
          workspaceId,
          channel: "telegram",
          externalDialogId,
          externalMessageId,
          sourceKind: "telegram",
          sourceName: "Telegram",
          title: `Диалог Telegram: ${clientName}`,
          clientName,
          telegram: telegramUsername,
          body: body || "Вложение",
          attachmentUrl,
          senderType: "client",
          createdAt: message.date
            ? new Date(message.date * 1000).toISOString()
            : new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );

    const result = await dialogResponse.json().catch(() => null);

    return Response.json(result ?? { ok: dialogResponse.ok }, {
      status: dialogResponse.status,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Telegram CRM webhook failed",
      },
      { status: error instanceof ApiAccessError ? error.status : 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    message: "CRM Telegram webhook is ready",
  });
}
