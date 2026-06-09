import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAllowed(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expected =
    process.env.CRON_SECRET ||
    process.env.VERCEL_CRON_SECRET ||
    process.env.TELEGRAM_WEBHOOK_SECRET;

  return Boolean(secret && expected && secret === expected);
}

async function setTelegramWebhook(request: Request) {
  try {
    if (!isAllowed(request)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unauthorized. Проверь, что в ссылке указан актуальный CRON_SECRET.",
        },
        { status: 401 }
      );
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "TELEGRAM_BOT_TOKEN is missing on server" },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const webhookUrl =
      url.searchParams.get("url") ||
      `${url.protocol}//${url.host}/api/telegram/webhook`;
    const dropPendingUpdates = url.searchParams.get("drop") === "1";
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          drop_pending_updates: dropPendingUpdates,
          allowed_updates: ["message", "my_chat_member"],
          ...(secretToken ? { secret_token: secretToken } : {}),
        }),
      }
    );
    const data = await telegramResponse.json().catch(() => null);

    return NextResponse.json(
      {
        ok: telegramResponse.ok && data?.ok !== false,
        webhookUrl,
        telegram: data,
      },
      { status: telegramResponse.ok ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Telegram webhook setup error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return setTelegramWebhook(request);
}

export async function POST(request: Request) {
  return setTelegramWebhook(request);
}
