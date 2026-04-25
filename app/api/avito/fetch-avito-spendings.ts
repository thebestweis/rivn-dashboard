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

    const response = await fetch(
      `https://api.avito.ru/stats/v2/accounts/${userId}/spendings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          dateFrom,
          dateTo,
          filter: null,
          grouping,
          spendingTypes,
        }),
        cache: "no-store",
      }
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Avito spendings failed: ${response.status}. ${text}`);
    }

    const data = JSON.parse(text);

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
