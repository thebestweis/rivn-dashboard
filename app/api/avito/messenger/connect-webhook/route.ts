import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";

export const dynamic = "force-dynamic";

type ServiceSupabase = ReturnType<typeof getServiceSupabase>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase env is missing");
  }

  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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

function normalizeAppUrl(request: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  const baseUrl = envUrl || new URL(request.url).origin;

  return baseUrl.replace(/\/$/, "");
}

async function requireWorkspaceAccess(
  supabase: ServiceSupabase,
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

async function getAccount(params: {
  supabase: ServiceSupabase;
  workspaceId: string;
  accountId: string;
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
        is_active,
        avito_report_clients!inner (
          workspace_id
        )
      `
    )
    .eq("id", params.accountId)
    .eq("avito_report_clients.workspace_id", params.workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Ошибка поиска Avito-аккаунта: ${error.message}`);
  }

  if (!data) {
    throw new HttpError("Avito-аккаунт не найден в этом кабинете", 404);
  }

  if (!data.is_active) {
    throw new HttpError("Сначала включи Avito-аккаунт", 400);
  }

  if (!data.avito_user_id || !data.avito_client_id || !data.avito_client_secret) {
    throw new HttpError(
      "В аккаунте не заполнены Avito user_id, client_id или client_secret",
      400
    );
  }

  return data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = String(body.workspaceId || "").trim();
    const accountId = String(body.accountId || "").trim();

    if (!workspaceId) {
      throw new HttpError("workspaceId is required", 400);
    }

    if (!accountId) {
      throw new HttpError("accountId is required", 400);
    }

    const supabase = getServiceSupabase();
    await requireWorkspaceAccess(supabase, workspaceId);

    const account = await getAccount({ supabase, workspaceId, accountId });
    const accessToken = await getAvitoAccessToken({
      clientId: account.avito_client_id,
      clientSecret: account.avito_client_secret,
    });
    const webhookUrl = `${normalizeAppUrl(request)}/api/avito/messenger/webhook`;

    const response = await fetch("https://api.avito.ru/messenger/v3/webhook", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
      }),
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new HttpError(
        `Avito не подключил webhook: ${JSON.stringify(result)}`,
        400
      );
    }

    return Response.json({
      ok: true,
      accountId: account.id,
      avitoUserId: account.avito_user_id,
      webhookUrl,
      result,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось подключить Avito-диалоги",
      },
      { status: getErrorStatus(error) }
    );
  }
}
