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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const clientId = url.searchParams.get("clientId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!workspaceId || !clientId || !from || !to) {
      return Response.json(
        {
          ok: false,
          error: "Не переданы workspaceId, clientId или период",
        },
        { status: 400 }
      );
    }

    const authSupabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      return Response.json(
        { ok: false, error: "Пользователь не авторизован" },
        { status: 401 }
      );
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
      return Response.json(
        { ok: false, error: "Нет доступа к этому кабинету" },
        { status: 403 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("avito_report_clients")
      .select("id")
      .eq("id", clientId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (clientError) {
      throw new Error(`Ошибка проверки Avito-проекта: ${clientError.message}`);
    }

    if (!client) {
      return Response.json(
        { ok: false, error: "Avito-проект не найден в текущем кабинете" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("avito_report_metrics")
      .select("*")
      .eq("client_id", clientId)
      .is("account_id", null)
      .eq("report_type", "daily")
      .gte("period_start", from)
      .lte("period_end", to)
      .order("period_start", { ascending: true });

    if (error) {
      throw new Error(`Ошибка загрузки метрик: ${error.message}`);
    }

    return Response.json({
      ok: true,
      metrics: data ?? [],
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка загрузки Avito-метрик",
      },
      { status: 500 }
    );
  }
}
