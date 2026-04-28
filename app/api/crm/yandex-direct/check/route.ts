import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type DirectIntegration = {
  id: string;
  workspace_id: string;
  oauth_token: string;
  client_login: string | null;
  turbo_page_ids: Array<number | string> | null;
  is_active: boolean;
};

function getServiceSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env is missing");
  }

  return createServiceClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function toDirectDate(value: Date) {
  return value.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function getYandexError(data: any) {
  return (
    data?.error?.error_detail ||
    data?.error?.error_string ||
    data?.error?.message ||
    "Яндекс не принял запрос"
  );
}

async function requireWorkspaceAccess(workspaceId: string) {
  const authSupabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: "Пользователь не авторизован",
    };
  }

  const supabase = getServiceSupabase();
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
    return {
      ok: false as const,
      status: 403,
      error: "Нет доступа к этому кабинету",
    };
  }

  return { ok: true as const, supabase };
}

async function checkYandexLeadsAccess(integration: DirectIntegration) {
  const turboPageIds = (integration.turbo_page_ids ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));

  if (!integration.is_active) {
    throw new Error("Интеграция выключена");
  }

  if (turboPageIds.length === 0) {
    throw new Error("В интеграции нет турбо-страниц для проверки");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${integration.oauth_token}`,
    "Content-Type": "application/json; charset=utf-8",
    Accept: "application/json",
  };

  if (integration.client_login) {
    headers["Client-Login"] = integration.client_login;
  }

  const now = new Date();
  const response = await fetch("https://api.direct.yandex.com/json/v5/leads", {
    method: "POST",
    headers,
    body: JSON.stringify({
      method: "get",
      params: {
        SelectionCriteria: {
          TurboPageIds: turboPageIds,
          DateTimeFrom: toDirectDate(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
          DateTimeTo: toDirectDate(now),
        },
        FieldNames: ["Id", "SubmittedAt", "TurboPageId", "TurboPageName"],
        Page: {
          Limit: 1,
          Offset: 0,
        },
      },
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.error) {
    throw new Error(getYandexError(data));
  }

  return {
    leadsPreviewCount: Array.isArray(data?.result?.Leads)
      ? data.result.Leads.length
      : 0,
    turboPageIds,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = String(body.workspaceId || "").trim();

    if (!workspaceId) {
      return Response.json(
        { ok: false, error: "Не выбран кабинет RIVN OS" },
        { status: 400 }
      );
    }

    const access = await requireWorkspaceAccess(workspaceId);

    if (!access.ok) {
      return Response.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const { data: integration, error } = await access.supabase
      .from("crm_yandex_direct_integrations")
      .select("id, workspace_id, oauth_token, client_login, turbo_page_ids, is_active")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error) {
      throw new Error(`Не удалось загрузить интеграцию: ${error.message}`);
    }

    if (!integration) {
      return Response.json(
        { ok: false, error: "Сначала сохрани подключение Яндекс Директа" },
        { status: 404 }
      );
    }

    const check = await checkYandexLeadsAccess(integration as DirectIntegration);

    return Response.json({
      ok: true,
      message: "Подключение Яндекс Директа работает",
      checkedAt: new Date().toISOString(),
      ...check,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось проверить Яндекс Директ",
      },
      { status: 500 }
    );
  }
}
