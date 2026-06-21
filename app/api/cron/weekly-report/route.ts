import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";
import {
  getFriendlyAvitoErrorMessage,
  sleep,
} from "@/app/api/avito/avito-api-helpers";
import {
  enqueueAvitoReportRetryJob,
  loadAvitoReportSnapshot,
  upsertAvitoReportSnapshot,
  type AvitoSnapshotStatus,
} from "@/app/api/avito/report-reliability";
import {
  buildDialogAnalyticsBlock,
  getDialogAnalytics,
  getMoscowPeriodRangeUnix,
  mergeDialogAnalytics,
  type DialogAnalytics,
} from "@/app/api/avito/dialog-analytics";

import { verifyCronSecret } from "../verify-cron-secret";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

type AvitoAccount = {
  id: string;
  name: string;
  access_token: string | null;
  avito_user_id: string | null;
  avito_client_id: string | null;
  avito_client_secret: string | null;
};



type PeriodStats = {
  views: number;
  contacts: number;
  favorites: number;
  expenses: number;
  conversion: number;
  costPerContact: number;
};

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function formatMoney(value: number) {
  return `${formatNumber(value)} ₽`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatChange(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function getChangePercent(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;

  return ((current - previous) / previous) * 100;
}


function buildStats(params: {
  views: number;
  contacts: number;
  favorites: number;
  expenses?: number;
}): PeriodStats {
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

function buildMetricLine(
  label: string,
  current: number,
  previous: number,
  type: "number" | "money" | "percent"
) {
  const change = getChangePercent(current, previous);

  let formattedValue = "";

  if (type === "money") formattedValue = formatMoney(current);
  if (type === "percent") formattedValue = formatPercent(current);
  if (type === "number") formattedValue = formatNumber(current);

  return `— ${label}: ${formattedValue} (${formatChange(change)})`;
}

function hasUnavailableStatsWarning(warnings: string[]) {
  return warnings.some((warning) => {
    const lowerWarning = warning.toLowerCase();

    return (
      (lowerWarning.includes("просмотр") || lowerWarning.includes("контакт")) &&
      (lowerWarning.includes("недоступ") ||
        lowerWarning.includes("нулев") ||
        lowerWarning.includes("огранич") ||
        lowerWarning.includes("перепровер"))
    ) || lowerWarning.includes("stats are temporarily unavailable");
  });
}

function buildUnavailableStatsLines() {
  return [
    "— Просмотры: временно недоступны",
    "— Конверсия: временно недоступна",
    "— Контакты: временно недоступны",
    "— Стоимость 1 контакта: временно недоступна",
  ];
}

async function sendTelegramMessage(chatId: string, text: string) {
  if (!telegramToken) {
    throw new Error("Не найден TELEGRAM_BOT_TOKEN");
  }

  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(
        `https://api.telegram.org/bot${telegramToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
          }),
        }
      );
      break;
    } catch (error) {
      lastError = error;
      await sleep(1200 * (attempt + 1));
    }
  }

  if (!response) {
    throw new Error(
      `Не удалось отправить отчёт в Telegram: ${
        lastError instanceof Error ? lastError.message : "network error"
      }`
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
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

function buildAccountErrorBlock(accountName: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Неизвестная ошибка Avito";
  const safeMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return [
    "━━━━━━━━━━━━",
    `Аккаунт: <b>${accountName}</b>`,
    "",
    "⚠️ Аккаунт не проверен.",
    `Причина: ${safeMessage}`,
  ].join("\n");
}

function buildAccountBlock(params: {
  accountName: string;
  current: PeriodStats;
  previous: PeriodStats;
}) {
  return [
    "━━━━━━━━━━━━",
    `Аккаунт: <b>${params.accountName}</b>`,
    "",
    buildMetricLine("Расходы", params.current.expenses, params.previous.expenses, "money"),
    buildMetricLine("Просмотры", params.current.views, params.previous.views, "number"),
    buildMetricLine("Конверсия", params.current.conversion, params.previous.conversion, "percent"),
    buildMetricLine("Контакты", params.current.contacts, params.previous.contacts, "number"),
    buildMetricLine("Стоимость 1 контакта", params.current.costPerContact, params.previous.costPerContact, "money"),
  ].join("\n");
}

function buildAccountPartialBlock(params: {
  accountName: string;
  current: PeriodStats;
  previous: PeriodStats;
  warnings: string[];
  statsUnavailable?: boolean;
}) {
  const warningLines = params.warnings.map((warning) => {
    const safeWarning = warning
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `⚠️ ${safeWarning}`;
  });

  if (!params.statsUnavailable) {
    return [
      buildAccountBlock({
        accountName: params.accountName,
        current: params.current,
        previous: params.previous,
      }),
      "",
      ...warningLines,
    ].join("\n");
  }

  return [
    "━━━━━━━━━━━━",
    `Аккаунт: <b>${params.accountName}</b>`,
    "",
    buildMetricLine("Расходы", params.current.expenses, params.previous.expenses, "money"),
    ...buildUnavailableStatsLines(),
    "",
    ...warningLines,
  ].join("\n");
}

function buildWeeklyReport(params: {
  clientName: string;
  periodLabel: string;
  accountBlocks: string[];
  totalCurrent: PeriodStats;
  totalPrevious: PeriodStats;
  dialogAnalyticsBlock: string;
  failedAccountsCount?: number;
  statsUnavailableAccountsCount?: number;
}) {
  const hasMultipleAccounts = params.accountBlocks.length > 1;
  const hasUnavailableStats = Boolean(params.statsUnavailableAccountsCount);

  const baseLines = [
    `📊 <b>Еженедельный Avito-отчёт</b>`,
    `<b>${params.periodLabel}</b>`,
    "",
    ...params.accountBlocks,
  ];

  if (!hasMultipleAccounts) {
    const footer = params.failedAccountsCount
      ? "✅ Отчёт сформирован. Аккаунт требует повторной проверки."
      : "✅ Аккаунт проверен";

    return [
      ...baseLines,
      "",
      params.dialogAnalyticsBlock,
      "",
      footer,
    ].join("\n");
  }

  const footer = params.failedAccountsCount
    ? "✅ Отчёт сформирован. Часть аккаунтов требует повторной проверки."
    : "✅ Аккаунты проверены";


  return [
    ...baseLines,
    "",
    "━━━━━━━━━━━━",
    "<b>Итого по всем аккаунтам</b>",
    "",
    buildMetricLine("Расходы", params.totalCurrent.expenses, params.totalPrevious.expenses, "money"),
    ...(hasUnavailableStats
      ? [
          ...buildUnavailableStatsLines(),
          "",
          "⚠️ Итоги по просмотрам и контактам не рассчитаны: Avito временно не отдал статистику по части аккаунтов.",
        ]
      : [
          buildMetricLine("Просмотры", params.totalCurrent.views, params.totalPrevious.views, "number"),
          buildMetricLine("Конверсия", params.totalCurrent.conversion, params.totalPrevious.conversion, "percent"),
          buildMetricLine("Контакты", params.totalCurrent.contacts, params.totalPrevious.contacts, "number"),
          buildMetricLine("Стоимость 1 контакта", params.totalCurrent.costPerContact, params.totalPrevious.costPerContact, "money"),
        ]),
    "",
    params.dialogAnalyticsBlock,
    "",
    footer,
  ].join("\n");
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const requestUrl = new URL(request.url);
    const forceSend = requestUrl.searchParams.get("force") === "1";
    const supabase = getSupabase();

    const { data: clients, error: clientsError } = await supabase
      .from("avito_report_clients")
      .select("id, name, telegram_chat_id")
      .eq("weekly_reports_enabled", true)
      .eq("is_active", true)
      .not("telegram_chat_id", "is", null);

    if (clientsError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Ошибка получения клиентов: ${clientsError.message}`,
        },
        { status: 500 }
      );
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Активные клиенты с Telegram chat_id не найдены",
        },
        { status: 404 }
      );
    }

    const now = new Date();
    const thisWeek = getWeekRange(now);
    const lastWeek = getWeekRange(new Date(thisWeek.start.getTime() - 1));
    const prevWeek = getWeekRange(new Date(lastWeek.start.getTime() - 1));

    const currentStart = lastWeek.start;
    const currentEnd = lastWeek.end;
    const prevStart = prevWeek.start;
    const prevEnd = prevWeek.end;

    const currentStartDate = toDateOnly(currentStart);
    const currentEndDate = toDateOnly(currentEnd);
    const prevStartDate = toDateOnly(prevStart);
    const prevEndDate = toDateOnly(prevEnd);

    const periodLabel = `${formatDate(currentStart)} — ${formatDate(currentEnd)}`;
    const results: {
      clientId: string;
      clientName: string;
      status: "success" | "failed" | "skipped";
      accountsCount: number;
      error?: string;
    }[] = [];

    for (const client of clients) {
      try {
        const { data: existingLog } = await supabase
          .from("avito_report_logs")
          .select("id")
          .eq("client_id", client.id)
          .eq("report_type", "weekly")
          .eq("period_start", currentStartDate)
          .eq("period_end", currentEndDate)
          .eq("status", "success")
          .maybeSingle();

        if (existingLog && !forceSend) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: "skipped",
            accountsCount: 0,
            error: "Weekly отчёт уже был отправлен за этот период",
          });

          continue;
        }

        const { data: accounts, error: accountsError } = await supabase
          .from("avito_report_accounts")
          .select("id, name, access_token, avito_user_id, avito_client_id, avito_client_secret")
          .eq("client_id", client.id)
          .eq("is_active", true);

        if (accountsError) {
          throw new Error(`Ошибка получения аккаунтов: ${accountsError.message}`);
        }

        if (!accounts || accounts.length === 0) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: "skipped",
            accountsCount: 0,
            error: "Активные Avito-аккаунты клиента не найдены",
          });

          continue;
        }

        const accountBlocks: string[] = [];
        const dialogAnalyticsItems: DialogAnalytics[] = [];
        const dialogRange = getMoscowPeriodRangeUnix(
          currentStartDate,
          currentEndDate
        );

        const totalCurrentRaw = {
          views: 0,
          contacts: 0,
          favorites: 0,
          expenses: 0,
        };

        const totalPreviousRaw = {
          views: 0,
          contacts: 0,
          favorites: 0,
          expenses: 0,
        };
        let failedAccountsCount = 0;
        let statsUnavailableAccountsCount = 0;

        for (const account of accounts as AvitoAccount[]) {
          try {
          if (!account.avito_user_id) {
            accountBlocks.push(
              [
                "━━━━━━━━━━━━",
                `Аккаунт: <b>${account.name}</b>`,
                "",
                "⚠️ Аккаунт не проверен: нет avito_user_id.",
              ].join("\n")
            );

            continue;
          }

          const accessToken = await resolveAvitoAccessToken(account);
          const warnings: string[] = [];
          let statsStatus: AvitoSnapshotStatus = "success";
          let expensesStatus: AvitoSnapshotStatus = "success";
          let currentStatsRaw = { views: 0, contacts: 0, favorites: 0 };
          let previousStatsRaw = { views: 0, contacts: 0, favorites: 0 };
          const currentAvitoSpendings = {
            total: 0,
            presence: 0,
            promotion: 0,
            commission: 0,
            rest: 0,
          };
          const previousAvitoSpendings = {
            total: 0,
            presence: 0,
            promotion: 0,
            commission: 0,
            rest: 0,
          };
          const preparedCurrent = await loadAvitoReportSnapshot({
            supabase,
            accountId: account.id,
            reportType: "weekly",
            periodStart: currentStartDate,
            periodEnd: currentEndDate,
          });
          const preparedPrevious = await loadAvitoReportSnapshot({
            supabase,
            accountId: account.id,
            reportType: "weekly",
            periodStart: prevStartDate,
            periodEnd: prevEndDate,
          });

          try {
            if (preparedCurrent?.qualityStatus === "ok") {
              currentStatsRaw = {
                views: preparedCurrent.views,
                contacts: preparedCurrent.contacts,
                favorites: preparedCurrent.favorites,
              };

              if (preparedPrevious?.statsStatus === "success") {
                previousStatsRaw = {
                  views: preparedPrevious.views,
                  contacts: preparedPrevious.contacts,
                  favorites: preparedPrevious.favorites,
                };
              }
            } else {
              statsStatus = "failed";
              warnings.push(
                "Stats are temporarily unavailable: Avito data is still being collected. The collector will retry without extra report-side requests."
              );
            }
          } catch (statsError) {
            statsStatus = "failed";
            const cachedCurrent = await loadAvitoReportSnapshot({
              supabase,
              accountId: account.id,
              reportType: "weekly",
              periodStart: currentStartDate,
              periodEnd: currentEndDate,
            });
            const cachedPrevious = await loadAvitoReportSnapshot({
              supabase,
              accountId: account.id,
              reportType: "weekly",
              periodStart: prevStartDate,
              periodEnd: prevEndDate,
            });

            if (
              cachedCurrent?.statsStatus === "success" &&
              cachedCurrent.qualityStatus !== "critical"
            ) {
              currentStatsRaw = {
                views: cachedCurrent.views,
                contacts: cachedCurrent.contacts,
                favorites: cachedCurrent.favorites,
              };
              statsStatus = "success";

              if (cachedPrevious?.statsStatus === "success") {
                previousStatsRaw = {
                  views: cachedPrevious.views,
                  contacts: cachedPrevious.contacts,
                  favorites: cachedPrevious.favorites,
                };
              }
            } else {
              warnings.push(
                `Stats are temporarily unavailable: ${getFriendlyAvitoErrorMessage(statsError)}`
              );
            }
          }

          try {
            if (preparedCurrent?.qualityStatus === "ok") {
              currentAvitoSpendings.total = preparedCurrent.expenses;

              if (preparedPrevious?.expensesStatus === "success") {
                previousAvitoSpendings.total = preparedPrevious.expenses;
              }
            } else {
              expensesStatus = "failed";
              warnings.push(
                "Expenses are temporarily unavailable: Avito data is still being collected. The collector will retry without extra report-side requests."
              );
            }
          } catch (spendingsError) {
            expensesStatus = "failed";
            const cachedCurrent = await loadAvitoReportSnapshot({
              supabase,
              accountId: account.id,
              reportType: "weekly",
              periodStart: currentStartDate,
              periodEnd: currentEndDate,
            });
            const cachedPrevious = await loadAvitoReportSnapshot({
              supabase,
              accountId: account.id,
              reportType: "weekly",
              periodStart: prevStartDate,
              periodEnd: prevEndDate,
            });

            if (
              cachedCurrent?.expensesStatus === "success" &&
              cachedCurrent.qualityStatus !== "critical"
            ) {
              currentAvitoSpendings.total = cachedCurrent.expenses;
              expensesStatus = "success";

              if (cachedPrevious?.expensesStatus === "success") {
                previousAvitoSpendings.total = cachedPrevious.expenses;
              }
            } else {
              warnings.push(
                `Expenses are temporarily unavailable: ${getFriendlyAvitoErrorMessage(spendingsError)}`
              );
            }
          }

          const currentStats = buildStats({
            ...currentStatsRaw,
            expenses: currentAvitoSpendings.total,
          });

          const previousStats = buildStats({
            ...previousStatsRaw,
            expenses: previousAvitoSpendings.total,
          });

          const snapshot = await upsertAvitoReportSnapshot({
            supabase,
            clientId: client.id,
            accountId: account.id,
            reportType: "weekly",
            periodStart: currentStartDate,
            periodEnd: currentEndDate,
            current: currentStats,
            previous: previousStats,
            statsStatus,
            expensesStatus,
            warnings,
            lastError: warnings.join("\n") || null,
            raw: {
              accountName: account.name,
              previous: previousStats,
              currentAvitoSpendings,
              previousAvitoSpendings,
            },
          });

          if (snapshot.qualityStatus !== "ok") {
            await enqueueAvitoReportRetryJob({
              supabase,
              clientId: client.id,
              accountId: account.id,
              reportType: "weekly",
              periodStart: currentStartDate,
              periodEnd: currentEndDate,
              priority: snapshot.qualityStatus === "critical" ? 10 : 50,
              delayMinutes: 1.5,
              lastError: snapshot.warnings.join("\n") || null,
            });

            for (const warning of snapshot.warnings) {
              if (!warnings.includes(warning)) {
                warnings.push(warning);
              }
            }
          }

          try {
            const dialogAnalytics = await getDialogAnalytics({
              accessToken,
              avitoUserId: account.avito_user_id,
              start: dialogRange.start,
              end: dialogRange.end,
            });

            dialogAnalyticsItems.push(dialogAnalytics);
          } catch (error) {
            console.error("Weekly dialog analytics failed", {
              accountId: account.id,
              error,
            });
          }

          const statsUnavailable = hasUnavailableStatsWarning(warnings);

          if (statsUnavailable) {
            statsUnavailableAccountsCount += 1;
          } else {
            totalCurrentRaw.views += currentStats.views;
            totalCurrentRaw.contacts += currentStats.contacts;
            totalCurrentRaw.favorites += currentStats.favorites;

            totalPreviousRaw.views += previousStats.views;
            totalPreviousRaw.contacts += previousStats.contacts;
            totalPreviousRaw.favorites += previousStats.favorites;
          }

          totalCurrentRaw.expenses += currentStats.expenses;

          totalPreviousRaw.expenses += previousStats.expenses;

          if (warnings.length > 0) {
            failedAccountsCount += 1;
            accountBlocks.push(
              buildAccountPartialBlock({
                accountName: account.name,
                current: currentStats,
                previous: previousStats,
                warnings,
                statsUnavailable,
              })
            );
          } else {
            accountBlocks.push(
              buildAccountBlock({
                accountName: account.name,
                current: currentStats,
                previous: previousStats,
              })
            );
          }
          } catch (accountError) {
            failedAccountsCount += 1;
            accountBlocks.push(buildAccountErrorBlock(account.name, accountError));

            await supabase.from("avito_report_logs").insert({
              client_id: client.id,
              telegram_chat_id: client.telegram_chat_id,
              report_type: "weekly",
              period_start: currentStartDate,
              period_end: currentEndDate,
              status: "failed",
              message:
                accountError instanceof Error
                  ? accountError.message
                  : "Неизвестная ошибка Avito-аккаунта",
            });
          }
        }

        const totalCurrent = buildStats(totalCurrentRaw);
        const totalPrevious = buildStats(totalPreviousRaw);
        const dialogAnalyticsBlock = buildDialogAnalyticsBlock(
          mergeDialogAnalytics(dialogAnalyticsItems)
        );

        const reportText = buildWeeklyReport({
          clientName: client.name,
          periodLabel,
          accountBlocks,
          totalCurrent,
          totalPrevious,
          dialogAnalyticsBlock,
          failedAccountsCount,
          statsUnavailableAccountsCount,
        });

        await sendTelegramMessage(client.telegram_chat_id, reportText);

        await supabase.from("avito_report_logs").insert({
          client_id: client.id,
          telegram_chat_id: client.telegram_chat_id,
          report_type: "weekly",
          period_start: currentStartDate,
          period_end: currentEndDate,
          status: "success",
          message: reportText,
        });

        results.push({
          clientId: client.id,
          clientName: client.name,
          status: "success",
          accountsCount: accounts.length,
        });
      } catch (clientError) {
        const errorMessage =
          clientError instanceof Error
            ? clientError.message
            : "Неизвестная ошибка клиента";

        results.push({
          clientId: client.id,
          clientName: client.name,
          status: "failed",
          accountsCount: 0,
          error: errorMessage,
        });

        await supabase.from("avito_report_logs").insert({
          client_id: client.id,
          telegram_chat_id: client.telegram_chat_id,
          report_type: "weekly",
          period_start: currentStartDate,
          period_end: currentEndDate,
          status: "failed",
          message: errorMessage,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Weekly Avito-отчёты обработаны по всем активным клиентам",
      period: {
        currentStart: currentStartDate,
        currentEnd: currentEndDate,
        prevStart: prevStartDate,
        prevEnd: prevEndDate,
      },
      totalClients: clients.length,
      success: results.filter((item) => item.status === "success").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      failed: results.filter((item) => item.status === "failed").length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Ошибка еженедельного отчёта",
      },
      { status: 500 }
    );
  }
}
