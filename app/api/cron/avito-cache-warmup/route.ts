import { createClient } from "@supabase/supabase-js";
import { fetchAvitoSpendings } from "@/app/api/avito/fetch-avito-spendings";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";
import {
  getAvitoAggregateStatsForPeriod,
  getFriendlyAvitoErrorMessage,
  sleep,
} from "@/app/api/avito/avito-api-helpers";
import { verifyCronSecret } from "../verify-cron-secret";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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

        const accessToken = await resolveAvitoAccessToken(account);
        await getAvitoAggregateStatsForPeriod({
          accountId: account.id,
          accessToken,
          avitoUserId: account.avito_user_id,
          dateFrom: yesterday,
          dateTo: yesterday,
        });

        await getAvitoAggregateStatsForPeriod({
          accountId: account.id,
          accessToken,
          avitoUserId: account.avito_user_id,
          dateFrom: beforeYesterday,
          dateTo: beforeYesterday,
        });

        await fetchAvitoSpendings({
          accountId: account.id,
          accessToken,
          userId: account.avito_user_id,
          dateFrom: beforeYesterday,
          dateTo: yesterday,
          grouping: "day",
        });

        results.push({
          accountId: account.id,
          accountName: account.name,
          status: "warmed",
        });
      } catch (error) {
        results.push({
          accountId: account.id,
          accountName: account.name,
          status: "failed",
          error: getFriendlyAvitoErrorMessage(error),
        });
      }

      await sleep(1200);
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
