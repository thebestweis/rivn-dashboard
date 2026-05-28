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

type AvitoStatPoint = {
  uniqViews?: number;
  uniqContacts?: number;
  uniqFavorites?: number;
};

type AvitoStatsItem = {
  itemId: number;
  stats?: AvitoStatPoint[];
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
    throw new Error("РќРµ РЅР°Р№РґРµРЅС‹ РїРµСЂРµРјРµРЅРЅС‹Рµ Supabase");
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
  return `${formatNumber(value)} в‚Ѕ`;
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

function chunkArray<T>(array: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
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

  return `вЂ” ${label}: ${formattedValue} (${formatChange(change)})`;
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
    throw new Error("РќРµ РЅР°Р№РґРµРЅ TELEGRAM_BOT_TOKEN");
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
    error instanceof Error ? error.message : "РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР° Avito";
  const safeMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return [
    "в”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓ",
    `РђРєРєР°СѓРЅС‚: <b>${accountName}</b>`,
    "",
    "вљ пёЏ РђРєРєР°СѓРЅС‚ РЅРµ РїСЂРѕРІРµСЂРµРЅ.",
    `РџСЂРёС‡РёРЅР°: ${safeMessage}`,
  ].join("\n");
}

async function getAllItemIds(accessToken: string) {
  const allItems: { id: number }[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `https://api.avito.ru/core/v1/items?page=${page}&per_page=${perPage}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РѕР±СЉСЏРІР»РµРЅРёР№: ${JSON.stringify(data)}`);
    }

    const resources = Array.isArray(data.resources) ? data.resources : [];
    allItems.push(...resources);

    if (resources.length < perPage) break;

    page += 1;

    if (page > 50) break;
  }

  return allItems.map((item) => item.id).filter(Boolean);
}

async function getStatsForPeriod(params: {
  accessToken: string;
  avitoUserId: string;
  itemIds: number[];
  dateFrom: string;
  dateTo: string;
}) {
  const chunks = chunkArray(params.itemIds, 200);

  let views = 0;
  let contacts = 0;
  let favorites = 0;

  for (const chunk of chunks) {
    const response = await fetch(
      `https://api.avito.ru/stats/v1/accounts/${params.avitoUserId}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          itemIds: chunk,
          periodGrouping: "day",
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ СЃС‚Р°С‚РёСЃС‚РёРєРё: ${JSON.stringify(data)}`);
    }

    const items = (data?.result?.items || []) as AvitoStatsItem[];

    for (const item of items) {
      for (const stat of item.stats || []) {
        views += Number(stat.uniqViews || 0);
        contacts += Number(stat.uniqContacts || 0);
        favorites += Number(stat.uniqFavorites || 0);
      }
    }
  }

  return buildStats({
    views,
    contacts,
    favorites,
    expenses: 0,
  });
}

function buildAccountBlock(params: {
  accountName: string;
  current: PeriodStats;
  previous: PeriodStats;
}) {
  return [
    "в”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓ",
    `РђРєРєР°СѓРЅС‚: <b>${params.accountName}</b>`,
    "",
    buildMetricLine("Р Р°СЃС…РѕРґС‹", params.current.expenses, params.previous.expenses, "money"),
    buildMetricLine("РџСЂРѕСЃРјРѕС‚СЂС‹", params.current.views, params.previous.views, "number"),
    buildMetricLine("РљРѕРЅРІРµСЂСЃРёСЏ", params.current.conversion, params.previous.conversion, "percent"),
    buildMetricLine("РљРѕРЅС‚Р°РєС‚С‹", params.current.contacts, params.previous.contacts, "number"),
    buildMetricLine("РЎС‚РѕРёРјРѕСЃС‚СЊ 1 РєРѕРЅС‚Р°РєС‚Р°", params.current.costPerContact, params.previous.costPerContact, "money"),
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

    return `вљ пёЏ ${safeWarning}`;
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
    `рџ“Љ <b>Р•Р¶РµРЅРµРґРµР»СЊРЅС‹Р№ Avito-РѕС‚С‡С‘С‚</b>`,
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
    "в”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓ",
    "<b>РС‚РѕРіРѕ РїРѕ РІСЃРµРј Р°РєРєР°СѓРЅС‚Р°Рј</b>",
    "",
    buildMetricLine("Р Р°СЃС…РѕРґС‹", params.totalCurrent.expenses, params.totalPrevious.expenses, "money"),
    ...(hasUnavailableStats
      ? [
          ...buildUnavailableStatsLines(),
          "",
          "⚠️ Итоги по просмотрам и контактам не рассчитаны: Avito временно не отдал статистику по части аккаунтов.",
        ]
      : [
          buildMetricLine("РџСЂРѕСЃРјРѕС‚СЂС‹", params.totalCurrent.views, params.totalPrevious.views, "number"),
          buildMetricLine("РљРѕРЅРІРµСЂСЃРёСЏ", params.totalCurrent.conversion, params.totalPrevious.conversion, "percent"),
          buildMetricLine("РљРѕРЅС‚Р°РєС‚С‹", params.totalCurrent.contacts, params.totalPrevious.contacts, "number"),
          buildMetricLine("РЎС‚РѕРёРјРѕСЃС‚СЊ 1 РєРѕРЅС‚Р°РєС‚Р°", params.totalCurrent.costPerContact, params.totalPrevious.costPerContact, "money"),
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
          error: `РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РєР»РёРµРЅС‚РѕРІ: ${clientsError.message}`,
        },
        { status: 500 }
      );
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "РђРєС‚РёРІРЅС‹Рµ РєР»РёРµРЅС‚С‹ СЃ Telegram chat_id РЅРµ РЅР°Р№РґРµРЅС‹",
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

    const periodLabel = `${formatDate(currentStart)} вЂ” ${formatDate(currentEnd)}`;
    const weekKey = `${currentStartDate}_${currentEndDate}`;

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
            error: "Weekly РѕС‚С‡С‘С‚ СѓР¶Рµ Р±С‹Р» РѕС‚РїСЂР°РІР»РµРЅ Р·Р° СЌС‚РѕС‚ РїРµСЂРёРѕРґ",
          });

          continue;
        }

        const { data: accounts, error: accountsError } = await supabase
          .from("avito_report_accounts")
          .select("id, name, access_token, avito_user_id, avito_client_id, avito_client_secret")
          .eq("client_id", client.id)
          .eq("is_active", true);

        if (accountsError) {
          throw new Error(`РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ Р°РєРєР°СѓРЅС‚РѕРІ: ${accountsError.message}`);
        }

        if (!accounts || accounts.length === 0) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: "skipped",
            accountsCount: 0,
            error: "РђРєС‚РёРІРЅС‹Рµ Avito-Р°РєРєР°СѓРЅС‚С‹ РєР»РёРµРЅС‚Р° РЅРµ РЅР°Р№РґРµРЅС‹",
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
                "в”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓв”Ѓ",
                `РђРєРєР°СѓРЅС‚: <b>${account.name}</b>`,
                "",
                "вљ пёЏ РђРєРєР°СѓРЅС‚ РЅРµ РїСЂРѕРІРµСЂРµРЅ: РЅРµС‚ avito_user_id.",
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
          let currentAvitoSpendings = {
            total: 0,
            presence: 0,
            promotion: 0,
            commission: 0,
            rest: 0,
          };
          let previousAvitoSpendings = {
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
                  : "РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР° Avito-Р°РєРєР°СѓРЅС‚Р°",
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
            : "РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР° РєР»РёРµРЅС‚Р°";

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
      message: "Weekly Avito-РѕС‚С‡С‘С‚С‹ РѕР±СЂР°Р±РѕС‚Р°РЅС‹ РїРѕ РІСЃРµРј Р°РєС‚РёРІРЅС‹Рј РєР»РёРµРЅС‚Р°Рј",
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
        error: error instanceof Error ? error.message : "РћС€РёР±РєР° weekly report",
      },
      { status: 500 }
    );
  }
}
