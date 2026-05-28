import { createClient } from "@supabase/supabase-js";
import { fetchAvitoSpendings } from "@/app/api/avito/fetch-avito-spendings";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";
import {
  getAvitoAggregateStatsForPeriod,
  getFriendlyAvitoErrorMessage,
  sleep,
} from "@/app/api/avito/avito-api-helpers";
import { parseAvitoSpendings } from "@/app/api/avito/parse-avito-spendings";
import {
  enqueueAvitoReportRetryJob,
  upsertAvitoReportSnapshot,
  type AvitoSnapshotStatus,
} from "@/app/api/avito/report-reliability";
import { verifyCronSecret } from "../verify-cron-secret";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AvitoAccount = {
  id: string;
  name: string;
  access_token: string | null;
  avito_user_id: string | null;
  avito_client_id: string | null;
  avito_client_secret: string | null;
};

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env variables are missing");
  }

  return createClient(supabaseUrl, supabaseKey);
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

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: jobs, error: jobsError } = await supabase
    .from("avito_report_sync_jobs")
    .select(
      "id, client_id, account_id, report_type, period_start, period_end, attempts"
    )
    .eq("status", "pending")
    .lte("next_run_at", now)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  if (jobsError) {
    return Response.json(
      { ok: false, error: jobsError.message },
      { status: 500 }
    );
  }

  const results: Array<{
    jobId: string;
    accountId: string;
    status: "success" | "retry" | "failed";
    error?: string;
  }> = [];

  for (const job of jobs ?? []) {
    await supabase
      .from("avito_report_sync_jobs")
      .update({
        status: "running",
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    try {
      const { data: account, error: accountError } = await supabase
        .from("avito_report_accounts")
        .select(
          "id, name, access_token, avito_user_id, avito_client_id, avito_client_secret"
        )
        .eq("id", job.account_id)
        .limit(1)
        .maybeSingle();

      if (accountError || !account) {
        throw new Error(accountError?.message || "Avito account not found");
      }

      if (!account.avito_user_id) {
        throw new Error("avito_user_id is missing");
      }

      const accessToken = await resolveAvitoAccessToken(account as AvitoAccount);
      const warnings: string[] = [];
      let statsStatus: AvitoSnapshotStatus = "success";
      let expensesStatus: AvitoSnapshotStatus = "success";
      let statsRaw = { views: 0, contacts: 0, favorites: 0 };
      let expenses = {
        total: 0,
        presence: 0,
        promotion: 0,
        commission: 0,
        rest: 0,
      };

      try {
        statsRaw = await getAvitoAggregateStatsForPeriod({
          accountId: job.account_id,
          accessToken,
          avitoUserId: account.avito_user_id,
          dateFrom: job.period_start,
          dateTo: job.period_end,
        });
      } catch (error) {
        statsStatus = "failed";
        warnings.push(getFriendlyAvitoErrorMessage(error));
      }

      try {
        const rawSpendings = await fetchAvitoSpendings({
          accountId: job.account_id,
          accessToken,
          userId: account.avito_user_id,
          dateFrom: job.period_start,
          dateTo: job.period_end,
          grouping: "day",
        });

        expenses = parseAvitoSpendings(rawSpendings, {
          dateFrom: job.period_start,
          dateTo: job.period_end,
        });
      } catch (error) {
        expensesStatus = "failed";
        warnings.push(getFriendlyAvitoErrorMessage(error));
      }

      const current = buildStats({
        ...statsRaw,
        expenses: expenses.total,
      });

      const snapshot = await upsertAvitoReportSnapshot({
        supabase,
        clientId: job.client_id,
        accountId: job.account_id,
        reportType: job.report_type,
        periodStart: job.period_start,
        periodEnd: job.period_end,
        current,
        statsStatus,
        expensesStatus,
        warnings,
        lastError: warnings.join("\n") || null,
        raw: {
          accountName: account.name,
          expenses,
          retryJobId: job.id,
        },
      });

      if (snapshot.qualityStatus === "ok") {
        await supabase
          .from("avito_report_sync_jobs")
          .update({
            status: "success",
            attempts: Number(job.attempts || 0) + 1,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        results.push({
          jobId: job.id,
          accountId: job.account_id,
          status: "success",
        });
      } else {
        await enqueueAvitoReportRetryJob({
          supabase,
          clientId: job.client_id,
          accountId: job.account_id,
          reportType: job.report_type,
          periodStart: job.period_start,
          periodEnd: job.period_end,
          priority: 80,
          delayMinutes: 1.5,
          lastError: snapshot.warnings.join("\n") || null,
        });

        await supabase
          .from("avito_report_sync_jobs")
          .update({
            status: "pending",
            attempts: Number(job.attempts || 0) + 1,
            next_run_at: new Date(Date.now() + 90 * 1000).toISOString(),
            last_error: snapshot.warnings.join("\n") || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        results.push({
          jobId: job.id,
          accountId: job.account_id,
          status: "retry",
          error: snapshot.warnings.join("; "),
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Avito sync error";
      const attempts = Number(job.attempts || 0) + 1;

      await supabase
        .from("avito_report_sync_jobs")
        .update({
          status: attempts >= 5 ? "failed" : "pending",
          attempts,
          next_run_at: new Date(Date.now() + 90 * 1000).toISOString(),
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      results.push({
        jobId: job.id,
        accountId: job.account_id,
        status: attempts >= 5 ? "failed" : "retry",
        error: message,
      });
    }

    await sleep(1200);
  }

  return Response.json({
    ok: true,
    processed: results.length,
    results,
  });
}
