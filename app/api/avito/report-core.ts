import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getAvitoProfileAnalyticsByPeriod,
  getFriendlyAvitoErrorMessage,
  sleep,
  type AvitoProfileAnalyticsStats,
} from "@/app/api/avito/avito-api-helpers";
import {
  buildDialogAnalyticsBlock,
  getDialogAnalytics,
  getMoscowPeriodRangeUnix,
  mergeDialogAnalytics,
  type DialogAnalytics,
} from "@/app/api/avito/dialog-analytics";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";
import {
  enqueueAvitoReportRetryJob,
  loadAvitoReportSnapshot,
  upsertAvitoReportSnapshot,
  type AvitoReportType,
  type AvitoSnapshotStatus,
} from "@/app/api/avito/report-reliability";
import { saveAvitoReportMetric } from "@/app/api/avito/save-avito-report-metric";

type Supabase = SupabaseClient;

type AvitoClient = {
  id: string;
  name: string;
  client_code?: string | null;
  telegram_chat_id: string;
};

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

type ReportPeriod = {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  label: string;
};

type RunReportParams = {
  reportType: AvitoReportType;
  forceSend?: boolean;
  clientCode?: string;
  testMode?: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_MESSAGE_LIMIT = 3900;
const TELEGRAM_FETCH_TIMEOUT_MS = 20_000;

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

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
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

function getReportPeriod(reportType: AvitoReportType): ReportPeriod {
  if (reportType === "daily") {
    const current = getMoscowDate(1);
    const previous = getMoscowDate(2);

    return {
      currentStart: current,
      currentEnd: current,
      previousStart: previous,
      previousEnd: previous,
      label: formatDateFull(current),
    };
  }

  const now = new Date();
  const thisWeek = getWeekRange(now);
  const lastWeek = getWeekRange(new Date(thisWeek.start.getTime() - 1));
  const previousWeek = getWeekRange(new Date(lastWeek.start.getTime() - 1));

  return {
    currentStart: toDateOnly(lastWeek.start),
    currentEnd: toDateOnly(lastWeek.end),
    previousStart: toDateOnly(previousWeek.start),
    previousEnd: toDateOnly(previousWeek.end),
    label: `${formatDateShort(toDateOnly(lastWeek.start))} — ${formatDateShort(
      toDateOnly(lastWeek.end)
    )}`,
  };
}

function formatDateShort(date: string) {
  const [, month, day] = date.split("-");
  return `${day}.${month}`;
}

function formatDateFull(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value || 0));
}

function formatMoney(value: number) {
  return `${formatNumber(value)} ₽`;
}

function formatPercentValue(value: number) {
  return `${Math.round(value || 0)}%`;
}

function formatChange(value: number) {
  const rounded = Math.round(value || 0);
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

function addStats(target: {
  views: number;
  contacts: number;
  favorites: number;
  expenses: number;
}, stats: PeriodStats) {
  target.views += stats.views;
  target.contacts += stats.contacts;
  target.favorites += stats.favorites;
  target.expenses += stats.expenses;
}

function buildMetricLine(
  label: string,
  current: number,
  previous: number,
  type: "number" | "money" | "percent"
) {
  const change = getChangePercent(current, previous);
  const formattedValue =
    type === "money"
      ? formatMoney(current)
      : type === "percent"
        ? formatPercentValue(current)
        : formatNumber(current);

  return `— ${label}: ${formattedValue} (${formatChange(change)})`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isStatsUnavailable(warnings: string[]) {
  return warnings.some((warning) => {
    const lower = warning.toLowerCase();

    return (
      (lower.includes("просмотр") || lower.includes("контакт")) &&
      (lower.includes("недоступ") ||
        lower.includes("нулев") ||
        lower.includes("огранич") ||
        lower.includes("перепровер"))
    );
  });
}

function unavailableStatsLines() {
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

  let lastData: unknown = null;

  for (const message of splitTelegramMessage(text)) {
    lastData = await sendTelegramMessagePart(chatId, message);
    await sleep(350);
  }

  return lastData;
}

function splitTelegramMessage(text: string) {
  if (text.length <= TELEGRAM_MESSAGE_LIMIT) {
    return [text];
  }

  const parts: string[] = [];
  let current = "";

  for (const block of text.split("\n\n")) {
    const next = current ? `${current}\n\n${block}` : block;

    if (next.length <= TELEGRAM_MESSAGE_LIMIT) {
      current = next;
      continue;
    }

    if (current) {
      parts.push(current);
      current = "";
    }

    if (block.length <= TELEGRAM_MESSAGE_LIMIT) {
      current = block;
      continue;
    }

    for (let index = 0; index < block.length; index += TELEGRAM_MESSAGE_LIMIT) {
      parts.push(block.slice(index, index + TELEGRAM_MESSAGE_LIMIT));
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

async function sendTelegramMessagePart(chatId: string, text: string) {
  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_FETCH_TIMEOUT_MS);

    try {
      response = await fetch(
        `https://api.telegram.org/bot${telegramToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }
      );
      break;
    } catch (error) {
      lastError = error;
      console.error("[avito:telegram] sendMessage fetch failed", {
        chatId,
        attempt: attempt + 1,
        error: formatTelegramError(error),
      });
      await sleep(1200 * (attempt + 1));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!response) {
    throw new Error(
      `Не удалось отправить отчёт в Telegram: ${
        formatTelegramError(lastError)
      }`
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

function formatTelegramError(error: unknown) {
  if (!error) {
    return "network error";
  }

  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeMessage =
    cause && typeof cause === "object" && "message" in cause
      ? String((cause as { message?: unknown }).message)
      : cause
        ? String(cause)
        : "";
  const causeCode =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code)
      : "";

  return [error.message, causeCode, causeMessage]
    .filter(Boolean)
    .join(" | ");
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

async function getPreparedOrLivePeriod(params: {
  supabase: Supabase;
  clientId: string;
  account: AvitoAccount;
  reportType: AvitoReportType;
  periodStart: string;
  periodEnd: string;
  allowWarningSnapshot?: boolean;
  preloadedStats?: AvitoProfileAnalyticsStats;
}) {
  const snapshot = await loadAvitoReportSnapshot({
    supabase: params.supabase,
    accountId: params.account.id,
    reportType: params.reportType,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });

  if (
    !params.preloadedStats &&
    snapshot &&
    (snapshot.qualityStatus === "ok" ||
      (params.allowWarningSnapshot && snapshot.qualityStatus !== "critical"))
  ) {
    return {
      stats: buildStats({
        views: snapshot.statsStatus === "success" ? snapshot.views : 0,
        contacts: snapshot.statsStatus === "success" ? snapshot.contacts : 0,
        favorites: snapshot.statsStatus === "success" ? snapshot.favorites : 0,
        expenses: snapshot.expensesStatus === "success" ? snapshot.expenses : 0,
      }),
      warnings: snapshot.warnings,
      fromSnapshot: true,
    };
  }

  const warnings: string[] = [];
  let statsStatus: AvitoSnapshotStatus = "success";
  let expensesStatus: AvitoSnapshotStatus = "success";
  const profileStats = params.preloadedStats ?? {
    views: 0,
    contacts: 0,
    favorites: 0,
    expenses: 0,
  };

  if (!params.account.avito_user_id) {
    throw new Error("Нет avito_user_id");
  }

  if (!params.preloadedStats) {
    statsStatus = "failed";
    expensesStatus = "failed";
    warnings.push("Avito не вернул статистику профиля за этот период.");
  }

  const stats = buildStats({
    views: profileStats.views,
    contacts: profileStats.contacts,
    favorites: profileStats.favorites,
    expenses: profileStats.expenses,
  });

  const saved = await upsertAvitoReportSnapshot({
    supabase: params.supabase,
    clientId: params.clientId,
    accountId: params.account.id,
    reportType: params.reportType,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    current: stats,
    statsStatus,
    expensesStatus,
    warnings,
    lastError: warnings.join("\n") || null,
    raw: {
      accountName: params.account.name,
      source: params.preloadedStats
        ? "profile_item_analytics"
        : "profile_item_analytics_missing_period",
    },
  });

  if (saved.qualityStatus !== "ok") {
    await enqueueAvitoReportRetryJob({
      supabase: params.supabase,
      clientId: params.clientId,
      accountId: params.account.id,
      reportType: params.reportType,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      priority: saved.qualityStatus === "critical" ? 10 : 50,
      delayMinutes: 5,
      lastError: saved.warnings.join("\n") || null,
    });
  }

  return {
    stats,
    warnings: saved.warnings,
    fromSnapshot: false,
  };
}

async function loadProfileAnalyticsForAccount(params: {
  account: AvitoAccount;
  period: ReportPeriod;
  reportType: AvitoReportType;
}) {
  if (!params.account.avito_user_id) {
    throw new Error("Нет avito_user_id");
  }

  const accessToken = await resolveAvitoAccessToken(params.account);

  return getAvitoProfileAnalyticsByPeriod({
    accountId: params.account.id,
    accessToken,
    avitoUserId: params.account.avito_user_id,
    dateFrom: params.period.previousStart,
    dateTo: params.period.currentEnd,
    grouping: params.reportType === "daily" ? "day" : "week",
  });
}

function buildAccountBlock(params: {
  accountName: string;
  current: PeriodStats;
  previous: PeriodStats;
}) {
  return [
    "━━━━━━━━━━━━",
    `Аккаунт: <b>${escapeHtml(params.accountName)}</b>`,
    "",
    buildMetricLine("Расходы", params.current.expenses, params.previous.expenses, "money"),
    buildMetricLine("Просмотры", params.current.views, params.previous.views, "number"),
    buildMetricLine("Конверсия", params.current.conversion, params.previous.conversion, "percent"),
    buildMetricLine("Контакты", params.current.contacts, params.previous.contacts, "number"),
    buildMetricLine(
      "Стоимость 1 контакта",
      params.current.costPerContact,
      params.previous.costPerContact,
      "money"
    ),
  ].join("\n");
}

function buildAccountPartialBlock(params: {
  accountName: string;
  current: PeriodStats;
  previous: PeriodStats;
  warnings: string[];
  statsUnavailable: boolean;
}) {
  const warningLines = params.warnings.map(
    (warning) => `⚠️ ${escapeHtml(warning)}`
  );

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
    `Аккаунт: <b>${escapeHtml(params.accountName)}</b>`,
    "",
    buildMetricLine("Расходы", params.current.expenses, params.previous.expenses, "money"),
    ...unavailableStatsLines(),
    "",
    ...warningLines,
  ].join("\n");
}

function buildAccountErrorBlock(accountName: string, error: unknown) {
  return [
    "━━━━━━━━━━━━",
    `Аккаунт: <b>${escapeHtml(accountName)}</b>`,
    "",
    "⚠️ Аккаунт не проверен.",
    `Причина: ${escapeHtml(getFriendlyAvitoErrorMessage(error))}`,
  ].join("\n");
}

function buildDailyReport(params: {
  period: ReportPeriod;
  accountBlocks: string[];
  totalCurrent: PeriodStats;
  totalPrevious: PeriodStats;
  failedAccountsCount: number;
  statsUnavailableAccountsCount: number;
}) {
  const hasMultipleAccounts = params.accountBlocks.length > 1;
  const hasUnavailableStats = params.statsUnavailableAccountsCount > 0;
  const lines = [
    "👋 Добрый день",
    "",
    `📊 <b>Ежедневный отчёт за период: ${params.period.label}</b>`,
    "",
    ...params.accountBlocks,
  ];

  if (!hasMultipleAccounts) {
    return [
      ...lines,
      "",
      params.failedAccountsCount
        ? "✅ Отчёт сформирован. Аккаунт требует повторной проверки."
        : "✅ Аккаунт проверен",
    ].join("\n");
  }

  return [
    ...lines,
    "",
    "━━━━━━━━━━━━",
    "<b>Итого по всем аккаунтам</b>",
    "",
    buildMetricLine("Расходы", params.totalCurrent.expenses, params.totalPrevious.expenses, "money"),
    ...(hasUnavailableStats
      ? [
          ...unavailableStatsLines(),
          "",
          "⚠️ Итоги по просмотрам и контактам не рассчитаны: Avito временно не отдал статистику по части аккаунтов.",
        ]
      : [
          buildMetricLine("Просмотры", params.totalCurrent.views, params.totalPrevious.views, "number"),
          buildMetricLine("Конверсия", params.totalCurrent.conversion, params.totalPrevious.conversion, "percent"),
          buildMetricLine("Контакты", params.totalCurrent.contacts, params.totalPrevious.contacts, "number"),
          buildMetricLine(
            "Стоимость 1 контакта",
            params.totalCurrent.costPerContact,
            params.totalPrevious.costPerContact,
            "money"
          ),
        ]),
    "",
    params.failedAccountsCount
      ? "✅ Отчёт сформирован. Часть аккаунтов требует повторной проверки."
      : "✅ Аккаунты проверены",
  ].join("\n");
}

function buildWeeklyReport(params: {
  clientName: string;
  period: ReportPeriod;
  accountBlocks: string[];
  totalCurrent: PeriodStats;
  totalPrevious: PeriodStats;
  dialogAnalyticsBlock: string;
  failedAccountsCount: number;
  statsUnavailableAccountsCount: number;
}) {
  const hasUnavailableStats = params.statsUnavailableAccountsCount > 0;

  return [
    `📊 <b>Еженедельный Avito-отчёт: ${escapeHtml(params.clientName)}</b>`,
    `Период: ${params.period.label}`,
    "",
    ...params.accountBlocks,
    "",
    "━━━━━━━━━━━━",
    "<b>Итого по всем аккаунтам</b>",
    "",
    buildMetricLine("Расходы", params.totalCurrent.expenses, params.totalPrevious.expenses, "money"),
    ...(hasUnavailableStats
      ? [
          ...unavailableStatsLines(),
          "",
          "⚠️ Итоги по просмотрам и контактам не рассчитаны: Avito временно не отдал статистику по части аккаунтов.",
        ]
      : [
          buildMetricLine("Просмотры", params.totalCurrent.views, params.totalPrevious.views, "number"),
          buildMetricLine("Конверсия", params.totalCurrent.conversion, params.totalPrevious.conversion, "percent"),
          buildMetricLine("Контакты", params.totalCurrent.contacts, params.totalPrevious.contacts, "number"),
          buildMetricLine(
            "Стоимость 1 контакта",
            params.totalCurrent.costPerContact,
            params.totalPrevious.costPerContact,
            "money"
          ),
        ]),
    "",
    params.dialogAnalyticsBlock,
    "",
    params.failedAccountsCount
      ? "✅ Отчёт сформирован. Часть аккаунтов требует повторной проверки."
      : "✅ Аккаунты проверены",
  ].join("\n");
}

async function loadClients(params: {
  supabase: Supabase;
  reportType: AvitoReportType;
  clientCode?: string;
}) {
  let query = params.supabase
    .from("avito_report_clients")
    .select("id, name, client_code, telegram_chat_id")
    .eq("is_active", true)
    .not("telegram_chat_id", "is", null);

  if (params.clientCode) {
    query = query.eq("client_code", params.clientCode).limit(1);
  } else {
    query =
      params.reportType === "daily"
        ? query.eq("daily_reports_enabled", true)
        : query.eq("weekly_reports_enabled", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Ошибка получения клиентов: ${error.message}`);
  }

  return (data ?? []) as AvitoClient[];
}

async function loadAccounts(supabase: Supabase, clientId: string) {
  const { data, error } = await supabase
    .from("avito_report_accounts")
    .select(
      "id, name, access_token, avito_user_id, avito_client_id, avito_client_secret"
    )
    .eq("client_id", clientId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Ошибка получения аккаунтов: ${error.message}`);
  }

  return (data ?? []) as AvitoAccount[];
}

async function hasDuplicateSuccess(params: {
  supabase: Supabase;
  clientId: string;
  reportType: AvitoReportType;
  period: ReportPeriod;
}) {
  const processingWindowStart = new Date(
    Date.now() - 2 * 60 * 60 * 1000
  ).toISOString();
  const { data } = await params.supabase
    .from("avito_report_logs")
    .select("id, status, created_at")
    .eq("client_id", params.clientId)
    .eq("report_type", params.reportType)
    .eq("period_start", params.period.currentStart)
    .eq("period_end", params.period.currentEnd);

  const rows = (data ?? []) as Array<{
    id: string;
    status: string | null;
    created_at: string | null;
  }>;

  return rows.some(
    (row) =>
      row.status === "success" ||
      (row.status === "processing" &&
        typeof row.created_at === "string" &&
        row.created_at >= processingWindowStart)
  );
}

export async function runAvitoReport(params: RunReportParams) {
  const supabase = getSupabase();
  const period = getReportPeriod(params.reportType);
  const clients = await loadClients({
    supabase,
    reportType: params.reportType,
    clientCode: params.clientCode,
  });

  if (clients.length === 0) {
    return {
      ok: false,
      error: params.clientCode
        ? "Активный клиент с Telegram chat_id не найден"
        : "Активные клиенты с Telegram chat_id не найдены",
      status: 404,
    };
  }

  const results: Array<{
    clientId: string;
    clientName: string;
    status: "success" | "failed" | "skipped";
    accountsCount: number;
    error?: string;
  }> = [];

  for (const client of clients) {
    try {
      if (
        !params.testMode &&
        !params.forceSend &&
        (await hasDuplicateSuccess({
          supabase,
          clientId: client.id,
          reportType: params.reportType,
          period,
        }))
      ) {
        results.push({
          clientId: client.id,
          clientName: client.name,
          status: "skipped",
          accountsCount: 0,
          error: `${params.reportType} отчёт уже был отправлен или формируется за этот период`,
        });
        continue;
      }

      await supabase.from("avito_report_logs").insert({
        client_id: client.id,
        telegram_chat_id: client.telegram_chat_id,
        report_type: params.testMode ? "test" : params.reportType,
        period_start: period.currentStart,
        period_end: period.currentEnd,
        status: "processing",
        message: `${params.testMode ? "Test" : params.reportType} отчёт принят в обработку`,
      });

      const accounts = await loadAccounts(supabase, client.id);

      if (accounts.length === 0) {
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
      const totalCurrentRaw = { views: 0, contacts: 0, favorites: 0, expenses: 0 };
      const totalPreviousRaw = { views: 0, contacts: 0, favorites: 0, expenses: 0 };
      let failedAccountsCount = 0;
      let statsUnavailableAccountsCount = 0;

      for (const account of accounts) {
        try {
          if (!account.avito_user_id) {
            throw new Error("Нет avito_user_id");
          }

          const profileAnalytics = await loadProfileAnalyticsForAccount({
            account,
            period,
            reportType: params.reportType,
          });
          const current = await getPreparedOrLivePeriod({
            supabase,
            clientId: client.id,
            account,
            reportType: params.reportType,
            periodStart: period.currentStart,
            periodEnd: period.currentEnd,
            allowWarningSnapshot: true,
            preloadedStats: profileAnalytics[period.currentStart],
          });
          const previous = await getPreparedOrLivePeriod({
            supabase,
            clientId: client.id,
            account,
            reportType: params.reportType,
            periodStart: period.previousStart,
            periodEnd: period.previousEnd,
            allowWarningSnapshot: true,
            preloadedStats: profileAnalytics[period.previousStart],
          });
          const warnings = [...current.warnings];
          const statsUnavailable = isStatsUnavailable(warnings);

          if (params.reportType === "weekly") {
            try {
              const accessToken = await resolveAvitoAccessToken(account);
              const dialogRange = getMoscowPeriodRangeUnix(
                period.currentStart,
                period.currentEnd
              );
              const analytics = await getDialogAnalytics({
                accessToken,
                avitoUserId: account.avito_user_id,
                start: dialogRange.start,
                end: dialogRange.end,
              });
              dialogAnalyticsItems.push(analytics);
            } catch (error) {
              console.error("[avito:report-core] dialog analytics failed", {
                accountId: account.id,
                error,
              });
            }
          }

          if (statsUnavailable) {
            statsUnavailableAccountsCount += 1;
          } else {
            addStats(totalCurrentRaw, current.stats);
            addStats(totalPreviousRaw, previous.stats);
          }

          if (statsUnavailable) {
            totalCurrentRaw.expenses += current.stats.expenses;
            totalPreviousRaw.expenses += previous.stats.expenses;
          }

          if (warnings.length === 0 && params.reportType === "daily") {
            await saveAvitoReportMetric({
              clientId: client.id,
              accountId: account.id,
              reportType: "daily",
              periodStart: period.currentStart,
              periodEnd: period.currentEnd,
              views: current.stats.views,
              contacts: current.stats.contacts,
              favorites: current.stats.favorites,
              expenses: current.stats.expenses,
              conversion: current.stats.conversion,
              costPerContact: current.stats.costPerContact,
              raw: {
                accountName: account.name,
                source: current.fromSnapshot ? "snapshot" : "live_fetch",
                previous: previous.stats,
              },
            });
          }

          if (warnings.length > 0) {
            failedAccountsCount += 1;
            accountBlocks.push(
              buildAccountPartialBlock({
                accountName: account.name,
                current: current.stats,
                previous: previous.stats,
                warnings,
                statsUnavailable,
              })
            );
          } else {
            accountBlocks.push(
              buildAccountBlock({
                accountName: account.name,
                current: current.stats,
                previous: previous.stats,
              })
            );
          }
        } catch (error) {
          failedAccountsCount += 1;
          accountBlocks.push(buildAccountErrorBlock(account.name, error));
        }

        await sleep(500);
      }

      const totalCurrent = buildStats(totalCurrentRaw);
      const totalPrevious = buildStats(totalPreviousRaw);

      if (
        failedAccountsCount === 0 &&
        params.reportType === "daily" &&
        !params.testMode
      ) {
        await saveAvitoReportMetric({
          clientId: client.id,
          accountId: null,
          reportType: "daily",
          periodStart: period.currentStart,
          periodEnd: period.currentEnd,
          views: totalCurrent.views,
          contacts: totalCurrent.contacts,
          favorites: totalCurrent.favorites,
          expenses: totalCurrent.expenses,
          conversion: totalCurrent.conversion,
          costPerContact: totalCurrent.costPerContact,
          raw: {
            type: "client_total",
            previous: totalPrevious,
          },
        });
      }

      const reportText =
        params.reportType === "daily"
          ? buildDailyReport({
              period,
              accountBlocks,
              totalCurrent,
              totalPrevious,
              failedAccountsCount,
              statsUnavailableAccountsCount,
            })
          : buildWeeklyReport({
              clientName: client.name,
              period,
              accountBlocks,
              totalCurrent,
              totalPrevious,
              dialogAnalyticsBlock: buildDialogAnalyticsBlock(
                mergeDialogAnalytics(dialogAnalyticsItems)
              ),
              failedAccountsCount,
              statsUnavailableAccountsCount,
            });
      const finalText = params.testMode
        ? ["🧪 <b>Тестовый Avito-отчёт RIVN OS</b>", "", reportText].join("\n")
        : reportText;

      await sendTelegramMessage(client.telegram_chat_id, finalText);

      await supabase.from("avito_report_logs").insert({
        client_id: client.id,
        telegram_chat_id: client.telegram_chat_id,
        report_type: params.testMode ? "test" : params.reportType,
        period_start: period.currentStart,
        period_end: period.currentEnd,
        status: "success",
        message: finalText,
      });

      results.push({
        clientId: client.id,
        clientName: client.name,
        status: "success",
        accountsCount: accounts.length,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка клиента";

      results.push({
        clientId: client.id,
        clientName: client.name,
        status: "failed",
        accountsCount: 0,
        error: message,
      });

      await supabase.from("avito_report_logs").insert({
        client_id: client.id,
        telegram_chat_id: client.telegram_chat_id,
        report_type: params.testMode ? "test" : params.reportType,
        period_start: period.currentStart,
        period_end: period.currentEnd,
        status: "failed",
        message,
      });
    }
  }

  return {
    ok: true,
    reportType: params.reportType,
    testMode: params.testMode ?? false,
    forceSend: params.forceSend ?? false,
    period,
    totalClients: clients.length,
    success: results.filter((item) => item.status === "success").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  };
}
