import { NextResponse } from "next/server";

const ALLOWED_EVENTS = new Set([
  "login_failed",
  "register_failed",
  "invite_failed",
  "app_context_failed",
]);

function sanitizeString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return undefined;
  return value.slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
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
      details:
        body?.details && typeof body.details === "object"
          ? body.details
          : undefined,
    };

    console.error("[auth-event]", payload);
  } catch (error) {
    console.error("[auth-event] failed to record event", error);
  }

  return NextResponse.json({ ok: true });
}
