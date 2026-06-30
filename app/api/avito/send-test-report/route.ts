import { createClient as createServiceClient } from "@supabase/supabase-js";
import { GET as sendAvitoTestReport } from "@/app/api/avito/test-report/route";
import { createClient as createServerClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createServiceClient(supabaseUrl, supabaseKey);
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: text.slice(0, 500),
    };
  }
}

type AvitoTestReportItem = {
  status?: string;
  error?: string;
};

type AvitoTestReportResult = {
  success?: number;
  failed?: number;
  skipped?: number;
  deliveryMode?: string;
  results?: AvitoTestReportItem[];
};

function getReportDeliveryError(result: AvitoTestReportResult | null) {
  const success = Number(result?.success ?? 0);
  const failed = Number(result?.failed ?? 0);
  const skipped = Number(result?.skipped ?? 0);
  const firstProblem = Array.isArray(result?.results)
    ? result.results.find((item) => item?.status !== "success")
    : null;

  if (success > 0 && failed === 0) {
    return null;
  }

  if (firstProblem?.error) {
    return firstProblem.error;
  }

  if (failed > 0) {
    return "Отчёт сформировался, но Telegram не подтвердил доставку.";
  }

  if (skipped > 0) {
    return "Отчёт был пропущен: активные Avito-аккаунты или данные для отправки не найдены.";
  }

  return "Отчёт не был отправлен в Telegram.";
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let body: { workspaceId?: string; clientId?: string };

    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return Response.json(
        {
          ok: false,
          error:
            "Сервер получил некорректный JSON. Проверь, что запрос отправляет workspaceId и clientId в формате JSON.",
          received: rawBody.slice(0, 200),
        },
        { status: 400 }
      );
    }

    const workspaceId = body.workspaceId;
    const clientId = body.clientId;

    if (!workspaceId || !clientId) {
      return Response.json(
        { ok: false, error: "Не переданы workspaceId или clientId" },
        { status: 400 }
      );
    }

    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

    if (!cronSecret) {
      throw new Error("Cron secret недоступен на сервере");
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
      .select("id, client_code, telegram_chat_id")
      .eq("id", clientId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (clientError) {
      throw new Error(`Ошибка проверки проекта: ${clientError.message}`);
    }

    if (!client?.client_code) {
      return Response.json(
        { ok: false, error: "У проекта нет кода привязки Telegram" },
        { status: 404 }
      );
    }

    if (!client.telegram_chat_id) {
      return Response.json(
        { ok: false, error: "Сначала привяжи Telegram-беседу к проекту" },
        { status: 400 }
      );
    }

    const url = new URL("/api/avito/test-report", "http://rivn-internal.local");
    url.searchParams.set("clientCode", client.client_code);

    const response = await sendAvitoTestReport(
      new Request(url, {
        headers: {
          authorization: `Bearer ${cronSecret}`,
        },
      })
    );
    const result = await readJsonResponse(response);

    if (!response.ok || !result?.ok) {
      throw new Error(
        result?.error ||
          `Avito test report failed with empty response (${response.status}).`
      );
    }

    const deliveryError = getReportDeliveryError(result);

    if (deliveryError) {
      throw new Error(deliveryError);
    }

    return Response.json({
      ok: true,
      mode: "sync",
      message:
        result.deliveryMode === "queue"
          ? "Тестовый отчёт сформирован и поставлен в очередь отправки в Telegram."
          : "Тестовый отчёт отправлен в Telegram.",
      avitoTestReport: result,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка отправки тестового отчёта",
      },
      { status: 500 }
    );
  }
}
