import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SOURCE_KINDS = ["avito", "tilda", "telegram", "yandex_direct"] as const;

type SourceKind = (typeof SOURCE_KINDS)[number];

function getServiceSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env is missing");
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

function getErrorStatus(error: unknown) {
  return error instanceof HttpError ? error.status : 500;
}

function isSourceKind(value: string): value is SourceKind {
  return SOURCE_KINDS.includes(value as SourceKind);
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId")?.trim();

    if (!workspaceId) {
      throw new HttpError("workspaceId is required", 400);
    }

    const supabase = getServiceSupabase();
    await requireWorkspaceAccess(supabase, workspaceId);

    const { data, error } = await supabase
      .from("crm_integration_settings")
      .select("source_kind, is_lead_ingestion_enabled")
      .eq("workspace_id", workspaceId);

    if (error) {
      throw new Error(`Ошибка загрузки настроек интеграций: ${error.message}`);
    }

    const settings = Object.fromEntries(
      SOURCE_KINDS.map((sourceKind) => [sourceKind, true])
    ) as Record<SourceKind, boolean>;

    for (const item of data ?? []) {
      if (isSourceKind(String(item.source_kind))) {
        settings[item.source_kind as SourceKind] =
          item.is_lead_ingestion_enabled !== false;
      }
    }

    return Response.json({ ok: true, settings });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось загрузить настройки интеграций",
      },
      { status: getErrorStatus(error) }
    );
  }
}

export async function PATCH(request: Request) {
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

    if (typeof body.isLeadIngestionEnabled !== "boolean") {
      throw new HttpError("isLeadIngestionEnabled is required", 400);
    }

    const supabase = getServiceSupabase();
    await requireWorkspaceAccess(supabase, workspaceId);

    const { error } = await supabase
      .from("crm_integration_settings")
      .upsert(
        {
          workspace_id: workspaceId,
          source_kind: sourceKind,
          is_lead_ingestion_enabled: body.isLeadIngestionEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,source_kind" }
      );

    if (error) {
      throw new Error(`Ошибка сохранения настройки: ${error.message}`);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить настройку интеграции",
      },
      { status: getErrorStatus(error) }
    );
  }
}
