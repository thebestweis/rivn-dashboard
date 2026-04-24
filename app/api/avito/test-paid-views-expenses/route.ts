import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function requestJson(params: {
  method: "GET" | "POST";
  url: string;
  token: string;
  body?: unknown;
}) {
  const response = await fetch(params.url, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  const text = await response.text();

  let data: unknown = text;

  try {
    data = JSON.parse(text);
  } catch {}

  return {
    method: params.method,
    url: params.url,
    ok: response.ok,
    status: response.status,
    body: params.body || null,
    data,
  };
}

function findMoneyLikeFields(value: unknown, path = "data"): string[] {
  const matches: string[] = [];

  if (!value || typeof value !== "object") return matches;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      matches.push(...findMoneyLikeFields(item, `${path}[${index}]`));
    });

    return matches;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();

    if (
      lowerKey.includes("cost") ||
      lowerKey.includes("price") ||
      lowerKey.includes("amount") ||
      lowerKey.includes("expense") ||
      lowerKey.includes("spent") ||
      lowerKey.includes("spend") ||
      lowerKey.includes("sum") ||
      lowerKey.includes("balance") ||
      lowerKey.includes("payment") ||
      lowerKey.includes("vas") ||
      lowerKey.includes("promotion")
    ) {
      matches.push(`${path}.${key} = ${JSON.stringify(nestedValue)}`);
    }

    matches.push(...findMoneyLikeFields(nestedValue, `${path}.${key}`));
  }

  return matches;
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: account, error } = await supabase
      .from("avito_report_accounts")
      .select("id, name, access_token, avito_user_id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error || !account) {
      return Response.json({
        ok: false,
        error: error?.message || "Аккаунт Avito не найден",
      });
    }

    if (!account.access_token || !account.avito_user_id) {
      return Response.json({
        ok: false,
        error: "Нет access_token или avito_user_id",
      });
    }

    const itemsResponse = await requestJson({
      method: "GET",
      url: "https://api.avito.ru/core/v1/items?page=1&per_page=10",
      token: account.access_token,
    });

    const itemsData = itemsResponse.data as {
      resources?: Array<{ id: number }>;
    };

    const itemIds = Array.isArray(itemsData?.resources)
      ? itemsData.resources.map((item) => item.id).filter(Boolean).slice(0, 3)
      : [];

    if (itemIds.length === 0) {
      return Response.json({
        ok: false,
        error: "Не удалось получить объявления для теста",
        itemsResponse,
      });
    }

    const dateFrom = "2026-04-13";
    const dateTo = "2026-04-19";
    const userId = account.avito_user_id;
    const token = account.access_token;

    const tests = await Promise.all([
      requestJson({
        method: "POST",
        url: `https://api.avito.ru/stats/v1/accounts/${userId}/items`,
        token,
        body: {
          dateFrom,
          dateTo,
          itemIds,
          periodGrouping: "day",
        },
      }),

      requestJson({
        method: "POST",
        url: `https://api.avito.ru/stats/v1/accounts/${userId}/items`,
        token,
        body: {
          dateFrom,
          dateTo,
          itemIds,
          periodGrouping: "week",
        },
      }),

      requestJson({
        method: "POST",
        url: `https://api.avito.ru/core/v1/accounts/${userId}/price/vas`,
        token,
        body: {
          itemIds,
        },
      }),

      requestJson({
        method: "POST",
        url: `https://api.avito.ru/core/v1/accounts/${userId}/price/vas_packages`,
        token,
        body: {
          itemIds,
        },
      }),

      requestJson({
        method: "POST",
        url: `https://api.avito.ru/core/v2/accounts/${userId}/price/vas`,
        token,
        body: {
          itemIds,
        },
      }),

      requestJson({
        method: "POST",
        url: `https://api.avito.ru/core/v2/accounts/${userId}/price/vas_packages`,
        token,
        body: {
          itemIds,
        },
      }),

      requestJson({
        method: "GET",
        url: `https://api.avito.ru/core/v1/accounts/${userId}/items/${itemIds[0]}`,
        token,
      }),

      requestJson({
        method: "GET",
        url: `https://api.avito.ru/core/v1/items/${itemIds[0]}`,
        token,
      }),

      requestJson({
        method: "GET",
        url: `https://api.avito.ru/core/v1/accounts/${userId}/items/${itemIds[0]}/services`,
        token,
      }),

      requestJson({
        method: "GET",
        url: `https://api.avito.ru/core/v1/items/${itemIds[0]}/services`,
        token,
      }),
    ]);

    const compact = tests.map((test) => ({
      method: test.method,
      url: test.url,
      ok: test.ok,
      status: test.status,
      money_like_fields: findMoneyLikeFields(test.data).slice(0, 50),
      data_preview: JSON.stringify(test.data).slice(0, 2000),
    }));

    return Response.json({
      ok: true,
      account: account.name,
      userId,
      itemIds,
      dateFrom,
      dateTo,
      compact,
      full: tests,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}