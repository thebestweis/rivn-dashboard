import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createServiceClient(supabaseUrl, supabaseKey);
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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

function getErrorStatus(error: unknown) {
  return error instanceof HttpError ? error.status : 500;
}

function buildTelegramPrivateLink(clientCode: string) {
  return `https://t.me/stat_rivnos_bot?start=${encodeURIComponent(clientCode)}`;
}

function buildTelegramGroupLink(clientCode: string) {
  return `https://t.me/stat_rivnos_bot?startgroup=${encodeURIComponent(
    clientCode
  )}`;
}

function generateClientCode() {
  return `rivn-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

async function generateUniqueClientCode(
  supabase: ReturnType<typeof getServiceSupabase>
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const clientCode = generateClientCode();

    const { data, error } = await supabase
      .from("avito_report_clients")
      .select("id")
      .eq("client_code", clientCode)
      .maybeSingle();

    if (error) {
      throw new Error(`Ошибка проверки кода Telegram: ${error.message}`);
    }

    if (!data) {
      return clientCode;
    }
  }

  throw new Error("Не удалось создать уникальный код Telegram");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");

    if (!workspaceId) {
      throw new Error("Не передан workspaceId");
    }

    const supabase = getServiceSupabase();
    await requireWorkspaceAccess(supabase, workspaceId);

    const [
      { data: projects, error: projectsError },
      { data: integrations, error: integrationsError },
    ] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, created_at, workspace_id")
        .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
        .order("created_at", { ascending: false }),

      supabase
        .from("avito_report_clients")
        .select(`
          id,
          name,
          client_code,
          project_id,
          telegram_chat_id,
          is_active,
          daily_reports_enabled,
          weekly_reports_enabled,
          avito_report_accounts (
            id,
            name,
            avito_user_id,
            avito_client_id,
            is_active
          )
        `)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
    ]);

    if (projectsError) {
      throw new Error(`Ошибка загрузки проектов: ${projectsError.message}`);
    }

    if (integrationsError) {
      throw new Error(`Ошибка загрузки интеграций: ${integrationsError.message}`);
    }

    return Response.json({
      ok: true,
      workspaceId,
      projects: (projects ?? []).map((project) => ({
        id: project.id,
        name: project.name || "Без названия",
      })),
      integrations: integrations ?? [],
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка загрузки проектов",
      },
      { status: getErrorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const workspaceId = body.workspaceId;

    if (!workspaceId) {
      throw new Error("Не передан workspaceId");
    }

    const supabase = getServiceSupabase();
    await requireWorkspaceAccess(supabase, workspaceId);

    if (!body.projectId) {
      throw new Error("Выбери проект");
    }

    if (!Array.isArray(body.accounts) || body.accounts.length === 0) {
      throw new Error("Добавь хотя бы один Avito-аккаунт");
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, workspace_id")
      .eq("id", body.projectId)
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .maybeSingle();

    if (projectError) {
      throw new Error(`Ошибка проверки проекта: ${projectError.message}`);
    }

    if (!project) {
      throw new Error("Проект не найден в текущем кабинете");
    }

    const clientCode = await generateUniqueClientCode(supabase);

    const { data: client, error: clientError } = await supabase
      .from("avito_report_clients")
      .insert({
        workspace_id: workspaceId,
        project_id: project.id,
        name: project.name || body.projectName || "Без названия",
        client_code: clientCode,
        telegram_chat_id: body.telegramChatId?.trim() || null,
        is_active: body.isActive ?? true,
        daily_reports_enabled: body.dailyEnabled ?? true,
        weekly_reports_enabled: body.weeklyEnabled ?? true,
      })
      .select("id")
      .single();

    if (clientError) {
      throw new Error(`Ошибка создания клиента: ${clientError.message}`);
    }

    const accountsPayload = body.accounts.map((account: any, index: number) => {
      if (!account.avitoUserId) {
        throw new Error(`Укажи Avito user_id для аккаунта №${index + 1}`);
      }

      if (!account.avitoClientId || !account.avitoClientSecret) {
        throw new Error(
          `Укажи Avito client_id и client_secret для аккаунта №${index + 1}`
        );
      }

      return {
        client_id: client.id,
        name: account.accountName || `Avito аккаунт ${index + 1}`,
        avito_user_id: account.avitoUserId,
        avito_client_id: account.avitoClientId,
        avito_client_secret: account.avitoClientSecret,
        is_active: account.isActive ?? true,
      };
    });

    const { error: accountError } = await supabase
      .from("avito_report_accounts")
      .insert(accountsPayload);

    if (accountError) {
      throw new Error(`Ошибка создания аккаунтов Avito: ${accountError.message}`);
    }

    return Response.json({
      ok: true,
      clientId: client.id,
      clientCode,
      telegramBotLink: buildTelegramGroupLink(clientCode),
      telegramGroupLink: buildTelegramGroupLink(clientCode),
      telegramPrivateLink: buildTelegramPrivateLink(clientCode),
      accountsCount: accountsPayload.length,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка создания интеграции",
      },
      { status: getErrorStatus(error) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId;
    const integrationId = body.integrationId;
    const accountId = body.accountId;
    const patch = body.patch ?? {};

    if (!workspaceId) {
      throw new Error("Не передан workspaceId");
    }

    if (!integrationId && !accountId) {
      throw new Error("Не передан проект или Avito-аккаунт для обновления");
    }

    const supabase = getServiceSupabase();
    await requireWorkspaceAccess(supabase, workspaceId);

    if (integrationId) {
      const { data: integration, error: integrationError } = await supabase
        .from("avito_report_clients")
        .select("id")
        .eq("id", integrationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (integrationError) {
        throw new Error(
          `Ошибка проверки проекта: ${integrationError.message}`
        );
      }

      if (!integration) {
        throw new Error("Проект не найден в текущем кабинете");
      }

      const updatePayload: Record<string, boolean | string | null> = {};

      if (typeof patch.isActive === "boolean") {
        updatePayload.is_active = patch.isActive;
      }

      if (typeof patch.dailyEnabled === "boolean") {
        updatePayload.daily_reports_enabled = patch.dailyEnabled;
      }

      if (typeof patch.weeklyEnabled === "boolean") {
        updatePayload.weekly_reports_enabled = patch.weeklyEnabled;
      }

      if (typeof patch.telegramChatId === "string") {
        updatePayload.telegram_chat_id = patch.telegramChatId.trim() || null;
      }

      if (Object.keys(updatePayload).length === 0) {
        throw new Error("Нет разрешённых полей для обновления проекта");
      }

      const { error: updateError } = await supabase
        .from("avito_report_clients")
        .update(updatePayload)
        .eq("id", integrationId)
        .eq("workspace_id", workspaceId);

      if (updateError) {
        throw new Error(`Ошибка обновления проекта: ${updateError.message}`);
      }

      return Response.json({ ok: true });
    }

    const { data: account, error: accountError } = await supabase
      .from("avito_report_accounts")
      .select("id, client_id")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError) {
      throw new Error(`Ошибка проверки аккаунта: ${accountError.message}`);
    }

    if (!account) {
      throw new Error("Avito-аккаунт не найден");
    }

    const { data: integration, error: integrationError } = await supabase
      .from("avito_report_clients")
      .select("id")
      .eq("id", account.client_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (integrationError) {
      throw new Error(`Ошибка проверки проекта: ${integrationError.message}`);
    }

    if (!integration) {
      throw new Error("Avito-аккаунт не относится к текущему кабинету");
    }

    const accountUpdatePayload: Record<string, boolean | string> = {};

    if (typeof patch.isActive === "boolean") {
      accountUpdatePayload.is_active = patch.isActive;
    }

    if (typeof patch.accountName === "string" && patch.accountName.trim()) {
      accountUpdatePayload.name = patch.accountName.trim();
    }

    if (typeof patch.avitoUserId === "string" && patch.avitoUserId.trim()) {
      accountUpdatePayload.avito_user_id = patch.avitoUserId.trim();
    }

    if (typeof patch.avitoClientId === "string" && patch.avitoClientId.trim()) {
      accountUpdatePayload.avito_client_id = patch.avitoClientId.trim();
    }

    if (
      typeof patch.avitoClientSecret === "string" &&
      patch.avitoClientSecret.trim()
    ) {
      accountUpdatePayload.avito_client_secret =
        patch.avitoClientSecret.trim();
    }

    if (Object.keys(accountUpdatePayload).length === 0) {
      throw new Error("Нет разрешённых полей для обновления аккаунта");
    }

    const { error: updateError } = await supabase
      .from("avito_report_accounts")
      .update(accountUpdatePayload)
      .eq("id", accountId);

    if (updateError) {
      throw new Error(`Ошибка обновления аккаунта: ${updateError.message}`);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка обновления Avito-интеграции",
      },
      { status: getErrorStatus(error) }
    );
  }
}
