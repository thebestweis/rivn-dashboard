import { NextResponse } from "next/server";

type TelegramGetMeResponse = {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  description?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    date?: number;
    text?: string;
    chat?: {
      id: number;
      type: "private" | "group" | "supergroup" | "channel";
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
};

type TelegramGetUpdatesResponse = {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
};

function buildTelegramApiUrl(botToken: string, method: string) {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

function buildChatTitle(chat: {
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}) {
  if (chat.title?.trim()) {
    return chat.title.trim();
  }

  const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  if (chat.username?.trim()) {
    return `@${chat.username.trim()}`;
  }

  return "Неизвестный чат";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const botToken = String(body?.botToken ?? "").trim();

    if (!botToken) {
      return NextResponse.json(
        { error: "Укажи bot token" },
        { status: 400 }
      );
    }

    const meResponse = await fetch(buildTelegramApiUrl(botToken, "getMe"), {
      method: "GET",
      cache: "no-store",
    });

    const meData = (await meResponse.json()) as TelegramGetMeResponse;

    if (!meResponse.ok || !meData.ok || !meData.result) {
      return NextResponse.json(
        {
          error:
            meData.description ||
            "Не удалось проверить bot token. Проверь, что токен указан корректно.",
        },
        { status: 400 }
      );
    }

    const botUsername = meData.result.username ?? "";
    const botName = meData.result.first_name ?? "Telegram Bot";
    const botLink = botUsername ? `https://t.me/${botUsername}` : "";

    const updatesResponse = await fetch(
      buildTelegramApiUrl(botToken, "getUpdates"),
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const updatesData = (await updatesResponse.json()) as TelegramGetUpdatesResponse;

    if (!updatesResponse.ok || !updatesData.ok) {
      return NextResponse.json(
        {
          error:
            updatesData.description || "Не удалось получить сообщения бота.",
          botUsername,
          botName,
          botLink,
          tokenValid: true,
        },
        { status: 400 }
      );
    }

    const updates = Array.isArray(updatesData.result) ? updatesData.result : [];

    const candidateUpdates = updates
      .filter((item) => item.message?.chat?.id)
      .sort((a, b) => (b.update_id ?? 0) - (a.update_id ?? 0));

    if (candidateUpdates.length === 0) {
      return NextResponse.json(
        {
          error:
            "Сообщения для этого бота пока не найдены. Открой бота в Telegram, нажми Start или отправь любое сообщение, затем попробуй снова.",
          tokenValid: true,
          botUsername,
          botName,
          botLink,
        },
        { status: 404 }
      );
    }

    const latest = candidateUpdates[0];
    const chat = latest.message!.chat!;

    return NextResponse.json({
      success: true,
      tokenValid: true,
      botUsername,
      botName,
      botLink,
      chatId: String(chat.id),
      chatType: chat.type,
      chatTitle: buildChatTitle(chat),
      lastMessageText: latest.message?.text ?? "",
      lastMessageDate: latest.message?.date
        ? new Date(latest.message.date * 1000).toISOString()
        : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}