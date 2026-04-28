import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function parseTurboPageIds(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((item) => Number.isFinite(item));
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = String(url.searchParams.get("workspaceId") || "").trim();

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
      .select(
        "id, name, client_login, turbo_page_ids, is_active, last_synced_at, updated_at"
      )
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error) {
      throw new Error(`Не удалось загрузить интеграцию: ${error.message}`);
    }

    if (!integration) {
      return Response.json({
        ok: true,
        integration: null,
        importsCount: 0,
        lastImportAt: null,
        lastLeadSubmittedAt: null,
      });
    }

    const { count, error: countError } = await access.supabase
      .from("crm_yandex_direct_imports")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("integration_id", integration.id);

    if (countError) {
      throw new Error(`Не удалось посчитать заявки: ${countError.message}`);
    }

    const { data: latestImport, error: latestImportError } =
      await access.supabase
        .from("crm_yandex_direct_imports")
        .select("created_at, submitted_at")
        .eq("workspace_id", workspaceId)
        .eq("integration_id", integration.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestImportError) {
      throw new Error(
        `Не удалось загрузить последний импорт: ${latestImportError.message}`
      );
    }

    return Response.json({
      ok: true,
      integration,
      importsCount: count ?? 0,
      lastImportAt: latestImport?.created_at ?? null,
      lastLeadSubmittedAt: latestImport?.submitted_at ?? null,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось загрузить интеграцию Яндекс Директа",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = String(body.workspaceId || "").trim();
    const name = String(body.name || "Яндекс Директ").trim();
    const oauthToken = String(body.oauthToken || "").trim();
    const clientLogin = String(body.clientLogin || "").trim() || null;
    const turboPageIds = parseTurboPageIds(body.turboPageIds);

    if (!workspaceId) {
      return Response.json(
        { ok: false, error: "Не выбран кабинет RIVN OS" },
        { status: 400 }
      );
    }

    if (!oauthToken) {
      return Response.json(
        { ok: false, error: "Укажи OAuth-токен Яндекс Директа" },
        { status: 400 }
      );
    }

    if (turboPageIds.length === 0) {
      return Response.json(
        { ok: false, error: "Выбери хотя бы одну турбо-страницу" },
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

    const { data: existing } = await access.supabase
      .from("crm_yandex_direct_integrations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const payload = {
      workspace_id: workspaceId,
      name,
      oauth_token: oauthToken,
      client_login: clientLogin,
      turbo_page_ids: turboPageIds,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const query = existing?.id
      ? access.supabase
          .from("crm_yandex_direct_integrations")
          .update(payload)
          .eq("id", existing.id)
          .select("id, name, turbo_page_ids, last_synced_at, updated_at")
          .single()
      : access.supabase
          .from("crm_yandex_direct_integrations")
          .insert(payload)
          .select("id, name, turbo_page_ids, last_synced_at, updated_at")
          .single();

    const { data, error } = await query;

    if (error) {
      throw new Error(`Не удалось сохранить интеграцию: ${error.message}`);
    }

    return Response.json({
      ok: true,
      integration: data,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить интеграцию Яндекс Директа",
      },
      { status: 500 }
    );
  }
}
