import { NextResponse } from "next/server";
import { readJsonWithLimit } from "@/app/api/_request";

const ALLOWED_EVENTS = new Set([
  "login_failed",
  "register_failed",
  "invite_failed",
  "app_context_failed",
]);

const ALERT_TTL_MS = 5 * 60 * 1000;
const MAX_AUTH_EVENT_BYTES = 8 * 1024;
const alertCache = new Map<string, number>();

function sanitizeString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return undefined;
  return value.slice(0, maxLength);
}

function env(name: string, fallbacks: string[] = []) {
  return process.env[name] || fallbacks.map((fallback) => process.env[fallback]).find(Boolean) || "";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getEventLabel(event: string) {
  if (event === "login_failed") return "Ошибка входа";
  if (event === "register_failed") return "Ошибка регистрации";
  if (event === "invite_failed") return "Ошибка приглашения";
  if (event === "app_context_failed") return "Ошибка загрузки кабинета";
  return event;
}

function shouldSendAlert(event: string, email?: string, message?: string) {
  const key = `${event}:${email || "no-email"}:${message || "no-message"}`;
  const now = Date.now();
  const lastSentAt = alertCache.get(key) ?? 0;

  if (now - lastSentAt < ALERT_TTL_MS) return false;

  alertCache.set(key, now);
  return true;
}

async function sendAuthAlert(payload: {
  event: string;
  email?: string;
  path?: string;
  message?: string;
  timestamp?: string;
  userAgent?: string;
}) {
  const telegramBotToken = env("AUTH_ALERT_BOT_TOKEN", [
    "RIVNOS_ALERT_BOT_TOKEN",
    "RIVN_LEADS_ALERT_BOT_TOKEN",
    "TELEGRAM_BOT_TOKEN",
  ]);
  const alertChatId = env("AUTH_ALERT_CHAT_ID", [
    "RIVNOS_ALERT_CHAT_ID",
    "RIVN_LEADS_ALERT_CHAT_ID",
    "CRON_ERROR_CHAT_ID",
  ]);

  if (!telegramBotToken || !alertChatId) return;
  if (!shouldSendAlert(payload.event, payload.email, payload.message)) return;

  const lines = [
    `[RIVN OS] <b>${escapeHtml(getEventLabel(payload.event))}</b>`,
    "",
    `Email: <code>${escapeHtml(payload.email || "не указан")}</code>`,
    `Страница: <code>${escapeHtml(payload.path || "не указана")}</code>`,
    `Ошибка: ${escapeHtml(payload.message || "без текста")}`,
    `Время: ${escapeHtml(payload.timestamp || new Date().toISOString())}`,
    "",
    `<i>${escapeHtml(payload.userAgent || "userAgent не передан")}</i>`,
  ];

  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: alertChatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram auth alert failed: ${response.status} ${body}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonWithLimit<Record<string, unknown>>(
      request,
      MAX_AUTH_EVENT_BYTES
    ).catch(() => null);
    const event = sanitizeString(body?.event, 80);

    if (!event || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ ok: true });
    }

    const payload = {
      event,
      email: sanitizeString(body?.email, 160),
      path: sanitizeString(body?.path, 200),
      message: sanitizeString(body?.message, 500),
      timestamp: sanitizeString(body?.timestamp, 60),
      userAgent: sanitizeString(body?.userAgent, 300),
    };

    console.error("[auth-event]", {
      event: payload.event,
      path: payload.path,
      message: payload.message,
      hasEmail: Boolean(payload.email),
      hasUserAgent: Boolean(payload.userAgent),
    });
    await sendAuthAlert(payload).catch((alertError) => {
      console.error("[auth-event] failed to send alert", alertError);
    });
  } catch (error) {
    console.error("[auth-event] failed to record event", error);
  }

  return NextResponse.json({ ok: true });
}
