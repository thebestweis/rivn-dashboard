import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

type SourceKind = "tilda" | "telegram" | "yandex_direct";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env is missing");
  }

  return createServiceClient(supabaseUrl, supabaseKey);
}

function getInternalSecret() {
  return (
    process.env.CRM_WEBHOOK_SECRET ||
    process.env.CRON_SECRET ||
    process.env.VERCEL_CRON_SECRET
  );
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

function isSourceKind(value: string): value is SourceKind {
  return ["tilda", "telegram", "yandex_direct"].includes(value);
}

async function requireWorkspaceAccess(
  supabase: ReturnType<typeof getServiceSupabase>,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = String(body.workspaceId || "").trim();
    const sourceKind = String(body.sourceKind || "").trim();

    if (!workspaceId) {
      throw new HttpError("workspaceId is required", 400);
    }

    if (!isSourceKind(sourceKind)) {
      throw new HttpError("sourceKind is invalid", 400);
    }

    const secret = getInternalSecret();

    if (!secret) {
      throw new Error("CRM webhook secret is not configured");
    }

    const supabase = getServiceSupabase();
    await requireWorkspaceAccess(supabase, workspaceId);

    const baseUrl = new URL(request.url);
    const now = new Date().toISOString();

    if (sourceKind === "telegram") {
      const response = await fetch(new URL("/api/crm/dialogs", baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          channel: "telegram",
          externalDialogId: `test-telegram-${Date.now()}`,
          externalMessageId: `test-message-${Date.now()}`,
          sourceKind: "telegram",
          sourceName: "Telegram",
          title: "Тестовый диалог Telegram",
          clientName: "Тестовый клиент Telegram",
          telegram: "@test_client",
          body: "Это тестовая заявка Telegram. Если она появилась в CRM, интеграция работает.",
          senderType: "client",
          createdAt: now,
        }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);

      return Response.json(result ?? { ok: response.ok }, {
        status: response.status,
      });
    }

    const isYandex = sourceKind === "yandex_direct";
    const response = await fetch(new URL("/api/crm/leads", baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceId,
        sourceKind,
        sourceName: isYandex ? "Яндекс Директ" : "Tilda",
        title: isYandex
          ? "Тестовая заявка Яндекс Директ"
          : "Тестовая заявка Tilda",
        clientName: isYandex ? "Тестовый клиент Яндекс" : "Тестовый клиент Tilda",
        phone: "+7 999 000-00-00",
        telegram: "@test_client",
        serviceAmount: 50000,
        budget: 100000,
        description: isYandex
          ? "Тестовая заявка из Яндекс Директа. Если она появилась в CRM, интеграция работает."
          : "Тестовая заявка с формы Tilda. Если она появилась в CRM, интеграция работает.",
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);

    return Response.json(result ?? { ok: response.ok }, {
      status: response.status,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось проверить интеграцию",
      },
      { status: getErrorStatus(error) }
    );
  }
}
