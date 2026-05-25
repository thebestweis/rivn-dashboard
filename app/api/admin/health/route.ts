import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";
import { apiFailure, apiSuccess } from "@/app/lib/api/errors";
import { requireSuperAdminRoute } from "../_utils";

export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "warning" | "error";

async function checkWithTimeout<T>(fn: () => Promise<T>, timeoutMs = 6000) {
  return await Promise.race([
    fn(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), timeoutMs);
    }),
  ]);
}

function getStatus(ok: boolean, warning = false): HealthStatus {
  if (ok && !warning) return "ok";
  if (ok && warning) return "warning";
  return "error";
}

export async function GET() {
  try {
    const { serviceSupabase } = await requireSuperAdminRoute();

    const envChecks = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
      "CRON_SECRET",
      "AVITO_CLIENT_ID",
      "AVITO_CLIENT_SECRET",
      "NEXT_PUBLIC_APP_URL",
    ].map((name) => ({
      name,
      ok: Boolean(process.env[name]),
    }));

    const checks: Array<{
      key: string;
      label: string;
      status: HealthStatus;
      message: string;
    }> = [];

    try {
      const { error } = await serviceSupabase
        .from("profiles")
        .select("id", { count: "exact", head: true });

      checks.push({
        key: "supabase",
        label: "Supabase",
        status: getStatus(!error),
        message: error ? "База данных не ответила" : "База данных доступна",
      });
    } catch {
      checks.push({
        key: "supabase",
        label: "Supabase",
        status: "error",
        message: "База данных не ответила",
      });
    }

    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) throw new Error("token_missing");

      const response = await checkWithTimeout(() =>
        fetch(`https://api.telegram.org/bot${token}/getMe`, {
          cache: "no-store",
        })
      );
      const data = (await response.json().catch(() => null)) as { ok?: boolean } | null;

      checks.push({
        key: "telegram",
        label: "Telegram",
        status: getStatus(response.ok && Boolean(data?.ok)),
        message:
          response.ok && data?.ok
            ? "Бот отвечает"
            : "Telegram API вернул ошибку",
      });
    } catch {
      checks.push({
        key: "telegram",
        label: "Telegram",
        status: "warning",
        message: "Не удалось быстро проверить Telegram",
      });
    }

    try {
      await checkWithTimeout(() => getAvitoAccessToken(), 8000);
      checks.push({
        key: "avito",
        label: "Avito",
        status: "ok",
        message: "Avito token получается",
      });
    } catch {
      checks.push({
        key: "avito",
        label: "Avito",
        status: "warning",
        message: "Не удалось быстро получить Avito token",
      });
    }

    const missingEnv = envChecks.filter((item) => !item.ok);
    checks.push({
      key: "env",
      label: "Env-переменные",
      status: missingEnv.length === 0 ? "ok" : "warning",
      message:
        missingEnv.length === 0
          ? "Ключевые переменные заполнены"
          : `Не заполнено: ${missingEnv.map((item) => item.name).join(", ")}`,
    });

    const { data: latestLog } = await serviceSupabase
      .from("avito_report_logs")
      .select("created_at,status,error")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    checks.push({
      key: "cron",
      label: "Cron и отчёты",
      status: latestLog?.created_at ? "ok" : "warning",
      message: latestLog?.created_at
        ? `Последний лог отчёта: ${new Date(latestLog.created_at).toLocaleString("ru-RU")}`
        : "Логи отчётов пока не найдены",
    });

    const overallStatus: HealthStatus = checks.some((item) => item.status === "error")
      ? "error"
      : checks.some((item) => item.status === "warning")
      ? "warning"
      : "ok";

    return apiSuccess({
      overallStatus,
      checks,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/admin/health error:", error);
    return apiFailure({ error, code: "INTERNAL_ERROR" });
  }
}
