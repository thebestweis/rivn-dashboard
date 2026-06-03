import { createClient } from "@supabase/supabase-js";
import { fetchAvitoSpendings } from "@/app/api/avito/fetch-avito-spendings";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";
import {
  getAvitoAggregateStatsForPeriod,
  getFriendlyAvitoErrorMessage,
} from "@/app/api/avito/avito-api-helpers";
import { parseAvitoSpendings } from "@/app/api/avito/parse-avito-spendings";
import {
  enqueueAvitoReportRetryJob,
  loadAvitoReportSnapshot,
  upsertAvitoReportSnapshot,
} from "@/app/api/avito/report-reliability";
import { verifyCronSecret } from "../verify-cron-secret";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AVITO_REPORT_CRON_DISABLED = true;

type AvitoAccount = {
  id: string;
  name: string;
  client_id: string;
  access_token: string | null;
  avito_user_id: string | null;
  avito_client_id: string | null;
  avito_client_secret: string | null;
};

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function getMoscowDate(daysAgo: number) {
  const now = new Date();
  const moscowNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Moscow" })
  );

  moscowNow.setDate(moscowNow.getDate() - daysAgo);

  const year = moscowNow.getFullYear();
  const month = String(moscowNow.getMonth() + 1).padStart(2, "0");
  const day = String(moscowNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function resolveAvitoAccessToken(account: AvitoAccount) {
  if (account.avito_client_id && account.avito_client_secret) {
    return getAvitoAccessToken({
      clientId: account.avito_client_id,
      clientSecret: account.avito_client_secret,
    });
  }

  if (account.access_token) {
    return account.access_token;
  }

  return getAvitoAccessToken();
}

function buildStats(params: {
  views: number;
  contacts: number;
  favorites: number;
  expenses?: number;
}) {
  const expenses = params.expenses || 0;

  return {
    views: params.views,
    contacts: params.contacts,
    favorites: params.favorites,
    expenses,
    conversion: params.views > 0 ? (params.contacts / params.views) * 100 : 0,
    costPerContact: params.contacts > 0 ? expenses / params.contacts : 0,
  };
}

async function getPendingRetryJob(params: {
  supabase: ReturnType<typeof getSupabase>;
  accountId: string;
  periodStart: string;
  periodEnd: string;
}) {
  const { data, error } = await params.supabase
    .from("avito_report_sync_jobs")
    .select("id, status, next_run_at")
    .eq("account_id", params.accountId)
    .eq("report_type", "daily")
    .eq("period_start", params.periodStart)
    .eq("period_end", params.periodEnd)
    .in("status", ["pending", "running"])
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !data?.[0]) {
    return null;
  }

  return data[0] as {
    id: string;
    status: "pending" | "running";
    next_run_at: string | null;
  };
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (AVITO_REPORT_CRON_DISABLED) {
    console.log("[cron:avito-cache-warmup] skipped because Avito report cron is temporarily disabled");

    return Response.json({
      ok: true,
      disabled: true,
      message: "Avito report cache warmup is temporarily disabled",
    });
  }

  try {
    const supabase = getSupabase();
    const yesterday = getMoscowDate(1);
    const beforeYesterday = getMoscowDate(2);

    const { data: clients, error: clientsError } = await supabase
      .from("avito_report_clients")
      .select("id")
      .eq("is_active", true)
      .eq("daily_reports_enabled", true)
      .not("telegram_chat_id", "is", null);

    if (clientsError) {
      throw new Error(`Ошибка получения клиентов: ${clientsError.message}`);
    }

    const clientIds = (clients ?? []).map((client) => client.id);

    if (clientIds.length === 0) {
      return Response.json({
        ok: true,
        message: "Нет активных Avito-клиентов для прогрева кеша",
        accounts: [],
      });
    }

    const { data: accounts, error: accountsError } = await supabase
      .from("avito_report_accounts")
      .select(
        "id, name, client_id, access_token, avito_user_id, avito_client_id, avito_client_secret"
      )
      .in("client_id", clientIds)
      .eq("is_active", true);

    if (accountsError) {
      throw new Error(`Ошибка получения аккаунтов: ${accountsError.message}`);
    }

    const results: Array<{
      accountId: string;
      accountName: string;
      status: "warmed" | "skipped" | "failed";
      error?: string;
    }> = [];

    for (const account of (accounts ?? []) as AvitoAccount[]) {
      try {
        if (!account.avito_user_id) {
          results.push({
            accountId: account.id,
            accountName: account.name,
            status: "skipped",
            error: "Нет avito_user_id",
          });
          continue;
        }

        const existingSnapshot = await loadAvitoReportSnapshot({
          supabase,
          accountId: account.id,
          reportType: "daily",
          periodStart: yesterday,
          periodEnd: yesterday,
        });

        if (existingSnapshot?.qualityStatus === "ok") {
          results.push({
            accountId: account.id,
            accountName: account.name,
            status: "skipped",
            error: "Данные уже собраны",
          });
          continue;
        }

        const pendingRetryJob = await getPendingRetryJob({
          supabase,
          accountId: account.id,
          periodStart: yesterday,
          periodEnd: yesterday,
        });
        const retryAt = pendingRetryJob?.next_run_at
          ? new Date(pendingRetryJob.next_run_at).getTime()
          : 0;
        const isRetryWaiting =
          pendingRetryJob?.status === "running" ||
          (pendingRetryJob?.status === "pending" &&
            Number.isFinite(retryAt) &&
            retryAt > Date.now());

        if (isRetryWaiting) {
          results.push({
            accountId: account.id,
            accountName: account.name,
            status: "skipped",
            error: "РџРѕРІС‚РѕСЂРЅС‹Р№ СЃР±РѕСЂ СѓР¶Рµ Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅ",
          });
          continue;
        }

        const existingPreviousSnapshot = await loadAvitoReportSnapshot({
          supabase,
          accountId: account.id,
          reportType: "daily",
          periodStart: beforeYesterday,
          periodEnd: beforeYesterday,
        });
        const accessToken = await resolveAvitoAccessToken(account);
        const currentStatsRaw = await getAvitoAggregateStatsForPeriod({
          accountId: account.id,
          accessToken,
          avitoUserId: account.avito_user_id,
          dateFrom: yesterday,
          dateTo: yesterday,
        });
        const previousStatsRaw =
          existingPreviousSnapshot?.statsStatus === "success"
            ? {
                views: existingPreviousSnapshot.views,
                contacts: existingPreviousSnapshot.contacts,
                favorites: existingPreviousSnapshot.favorites,
              }
            : await getAvitoAggregateStatsForPeriod({
                accountId: account.id,
                accessToken,
                avitoUserId: account.avito_user_id,
                dateFrom: beforeYesterday,
                dateTo: beforeYesterday,
              });
        const hasPreparedPreviousExpenses =
          existingPreviousSnapshot?.expensesStatus === "success";

        const rawSpendings = await fetchAvitoSpendings({
          accountId: account.id,
          accessToken,
          userId: account.avito_user_id,
          dateFrom: hasPreparedPreviousExpenses ? yesterday : beforeYesterday,
          dateTo: yesterday,
          grouping: "day",
        });

        const currentSpendings = parseAvitoSpendings(rawSpendings, {
          dateFrom: yesterday,
          dateTo: yesterday,
        });
        const previousSpendings = parseAvitoSpendings(rawSpendings, {
          dateFrom: beforeYesterday,
          dateTo: beforeYesterday,
        });
        if (hasPreparedPreviousExpenses) {
          previousSpendings.total = existingPreviousSnapshot.expenses;
        }
        const currentStats = buildStats({
          ...currentStatsRaw,
          expenses: currentSpendings.total,
        });
        const previousStats = buildStats({
          ...previousStatsRaw,
          expenses: previousSpendings.total,
        });

        const snapshot = await upsertAvitoReportSnapshot({
          supabase,
          clientId: account.client_id,
          accountId: account.id,
          reportType: "daily",
          periodStart: yesterday,
          periodEnd: yesterday,
          current: currentStats,
          previous: previousStats,
          statsStatus: "success",
          expensesStatus: "success",
          raw: {
            accountName: account.name,
            source: "cache_warmup",
            previous: previousStats,
          },
        });

        if (snapshot.qualityStatus !== "ok") {
          await enqueueAvitoReportRetryJob({
            supabase,
            clientId: account.client_id,
            accountId: account.id,
            reportType: "daily",
            periodStart: yesterday,
            periodEnd: yesterday,
            priority: snapshot.qualityStatus === "critical" ? 10 : 50,
            delayMinutes: 1.5,
            lastError: snapshot.warnings.join("\n") || null,
          });
        }

        results.push({
          accountId: account.id,
          accountName: account.name,
          status: snapshot.qualityStatus === "ok" ? "warmed" : "failed",
          error:
            snapshot.qualityStatus === "ok"
              ? undefined
              : snapshot.warnings.join("; ") || "Данные требуют повторного сбора",
        });
      } catch (error) {
        await enqueueAvitoReportRetryJob({
          supabase,
          clientId: account.client_id,
          accountId: account.id,
          reportType: "daily",
          periodStart: yesterday,
          periodEnd: yesterday,
          priority: 20,
          delayMinutes: 1.5,
          lastError: getFriendlyAvitoErrorMessage(error),
        });

        results.push({
          accountId: account.id,
          accountName: account.name,
          status: "failed",
          error: getFriendlyAvitoErrorMessage(error),
        });
      }

      break;
    }

    return Response.json({
      ok: true,
      message: "Avito cache warmup completed",
      yesterday,
      beforeYesterday,
      accountsTotal: results.length,
      warmed: results.filter((item) => item.status === "warmed").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      failed: results.filter((item) => item.status === "failed").length,
      results,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка прогрева Avito-кеша",
      },
      { status: 500 }
    );
  }
}
