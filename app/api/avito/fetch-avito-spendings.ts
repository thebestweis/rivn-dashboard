import { createClient } from "@supabase/supabase-js";

export type AvitoSpendingType =
  | "all"
  | "promotion"
  | "presence"
  | "commission"
  | "rest";

type FetchAvitoSpendingsParams = {
  accountId?: string;
  accessToken: string;
  userId: string | number;
  dateFrom: string;
  dateTo: string;
  grouping: "day" | "week" | "month";
  spendingTypes?: AvitoSpendingType[];
};

const SPENDINGS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const spendingsCache = new Map<
  string,
  {
    expiresAt: number;
    data: any;
  }
>();

const pendingSpendingsRequests = new Map<string, Promise<any>>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getServiceSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

function buildCacheKey(params: FetchAvitoSpendingsParams) {
  return JSON.stringify({
    accountId: params.accountId,
    userId: String(params.userId),
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    grouping: params.grouping,
    spendingTypes: params.spendingTypes ?? [
      "all",
      "promotion",
      "presence",
      "commission",
      "rest",
    ],
  });
}

function getDateRange(dateFrom: string, dateTo: string) {
  const dates: string[] = [];
  const current = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T00:00:00.000Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function buildSyntheticSpendings(
  rows: { expense_date: string; amount: number | string | null }[]
) {
  return {
    result: {
      groupings: rows.map((row) => ({
        date: row.expense_date,
        spendings: [
          {
            slug: "all",
            value: Number(row.amount || 0),
          },
        ],
      })),
    },
  };
}

function getDailyTotalFromGroup(group: any) {
  const spendings = group?.spendings;

  if (!Array.isArray(spendings)) {
    return 0;
  }

  const all = spendings.find((spending) => spending?.slug === "all");

  if (all) {
    return Math.round(Number(all.value || 0));
  }

  return Math.round(
    spendings.reduce((sum, spending) => sum + Number(spending?.value || 0), 0)
  );
}

async function getCachedSpendingsFromDatabase(params: {
  accountId?: string;
  dateFrom: string;
  dateTo: string;
}) {
  if (!params.accountId) {
    return null;
  }

  const supabase = getServiceSupabase();

  if (!supabase) {
    return null;
  }

  const expectedDates = getDateRange(params.dateFrom, params.dateTo);

  const { data, error } = await supabase
    .from("avito_report_expenses")
    .select("expense_date, amount")
    .eq("account_id", params.accountId)
    .gte("expense_date", params.dateFrom)
    .lte("expense_date", params.dateTo);

  if (error || !data) {
    return null;
  }

  const rowsByDate = new Map(
    data.map((row) => [String(row.expense_date), row])
  );

  if (!expectedDates.every((date) => rowsByDate.has(date))) {
    return null;
  }

  return buildSyntheticSpendings(
    expectedDates.map((date) => rowsByDate.get(date)!)
  );
}

async function getCachedSpendingsRowsFromDatabase(params: {
  accountId?: string;
  dateFrom: string;
  dateTo: string;
}) {
  if (!params.accountId) {
    return new Map<string, { expense_date: string; amount: number | string | null }>();
  }

  const supabase = getServiceSupabase();

  if (!supabase) {
    return new Map<string, { expense_date: string; amount: number | string | null }>();
  }

  const { data, error } = await supabase
    .from("avito_report_expenses")
    .select("expense_date, amount")
    .eq("account_id", params.accountId)
    .gte("expense_date", params.dateFrom)
    .lte("expense_date", params.dateTo);

  if (error || !data) {
    return new Map<string, { expense_date: string; amount: number | string | null }>();
  }

  return new Map(data.map((row) => [String(row.expense_date), row]));
}

async function saveSpendingsToDatabase(params: {
  accountId?: string;
  dateFrom: string;
  dateTo: string;
  data: any;
}) {
  if (!params.accountId) {
    return;
  }

  const supabase = getServiceSupabase();

  if (!supabase) {
    return;
  }

  const groups = params.data?.result?.groupings;

  if (!Array.isArray(groups)) {
    return;
  }

  await Promise.all(
    groups
      .filter((group) => {
        const date = String(group?.date || "");
        return date >= params.dateFrom && date <= params.dateTo;
      })
      .map(async (group) => {
        const expenseDate = String(group.date);
        const amount = getDailyTotalFromGroup(group);

        const { data: existing, error: selectError } = await supabase
          .from("avito_report_expenses")
          .select("id")
          .eq("account_id", params.accountId)
          .eq("expense_date", expenseDate)
          .maybeSingle();

        if (selectError) {
          return;
        }

        if (existing?.id) {
          await supabase
            .from("avito_report_expenses")
            .update({ amount })
            .eq("id", existing.id);
          return;
        }

        await supabase.from("avito_report_expenses").insert({
          account_id: params.accountId,
          expense_date: expenseDate,
          amount,
        });
      })
  );
}

function mergeSpendingsResponses(responses: any[]) {
  const groupings = responses.flatMap((response) =>
    Array.isArray(response?.result?.groupings) ? response.result.groupings : []
  );

  return {
    result: {
      groupings: groupings.sort((left, right) =>
        String(left?.date || "").localeCompare(String(right?.date || ""))
      ),
    },
  };
}

async function fetchAvitoSpendingsOnce(params: FetchAvitoSpendingsParams) {
  let response: Response;

  try {
    response = await fetch(
      `https://api.avito.ru/stats/v2/accounts/${params.userId}/spendings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          filter: null,
          grouping: params.grouping,
          spendingTypes: params.spendingTypes,
        }),
        cache: "no-store",
      }
    );
  } catch (error) {
    throw new Error(
      `Не удалось подключиться к Avito API расходов: ${
        error instanceof Error ? error.message : "network error"
      }`
    );
  }

  const text = await response.text();

  if (!response.ok) {
    const error = new Error(
      `Avito spendings failed: ${response.status}. ${text}`
    );
    (error as Error & { status?: number; retryAfter?: number }).status =
      response.status;

    const retryAfter = Number(response.headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      (error as Error & { status?: number; retryAfter?: number }).retryAfter =
        retryAfter * 1000;
    }

    throw error;
  }

  return JSON.parse(text);
}

async function fetchAvitoSpendingsWithRetry(params: FetchAvitoSpendingsParams) {
  const delays = [1200, 2800, 5500, 9000];
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await fetchAvitoSpendingsOnce(params);
    } catch (error) {
      lastError = error;
      const status = (error as Error & { status?: number }).status;

      if (status !== 429 || attempt === delays.length) {
        break;
      }

      const retryAfter = (error as Error & { retryAfter?: number }).retryAfter;
      await sleep(retryAfter ?? delays[attempt]);
    }
  }

  throw lastError;
}

export async function fetchAvitoSpendings({
  accountId,
  accessToken,
  userId,
  dateFrom,
  dateTo,
  grouping,
  spendingTypes = ["all", "promotion", "presence", "commission", "rest"],
}: FetchAvitoSpendingsParams) {
  const cacheKey = buildCacheKey({
    accountId,
    accessToken,
    userId,
    dateFrom,
    dateTo,
    grouping,
    spendingTypes,
  });
  const cached = spendingsCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const pendingRequest = pendingSpendingsRequests.get(cacheKey);

  if (pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    const databaseCached = await getCachedSpendingsFromDatabase({
      accountId,
      dateFrom,
      dateTo,
    });

    if (databaseCached) {
      spendingsCache.set(cacheKey, {
        data: databaseCached,
        expiresAt: Date.now() + SPENDINGS_CACHE_TTL_MS,
      });

      return databaseCached;
    }

    let data: any;

    try {
      data = await fetchAvitoSpendingsWithRetry({
        accountId,
        accessToken,
        userId,
        dateFrom,
        dateTo,
        grouping,
        spendingTypes,
      });
    } catch (error) {
      const status = (error as Error & { status?: number }).status;

      if (status !== 429 || grouping !== "day") {
        throw error;
      }

      const cachedRows = await getCachedSpendingsRowsFromDatabase({
        accountId,
        dateFrom,
        dateTo,
      });
      const dailyResponses = [];

      for (const date of getDateRange(dateFrom, dateTo)) {
        const cachedRow = cachedRows.get(date);

        if (cachedRow) {
          dailyResponses.push(buildSyntheticSpendings([cachedRow]));
          continue;
        }

        const dayData = await fetchAvitoSpendingsWithRetry({
          accountId,
          accessToken,
          userId,
          dateFrom: date,
          dateTo: date,
          grouping,
          spendingTypes,
        });

        await saveSpendingsToDatabase({
          accountId,
          dateFrom: date,
          dateTo: date,
          data: dayData,
        });

        dailyResponses.push(dayData);
        await sleep(1200);
      }

      data = mergeSpendingsResponses(dailyResponses);
    }

    await saveSpendingsToDatabase({
      accountId,
      dateFrom,
      dateTo,
      data,
    });

    spendingsCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + SPENDINGS_CACHE_TTL_MS,
    });

    return data;
  })().finally(() => {
    pendingSpendingsRequests.delete(cacheKey);
  });

  pendingSpendingsRequests.set(cacheKey, request);

  return request;
}
