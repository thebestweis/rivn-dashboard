import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function testGet(url: string, token: string) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const text = await response.text();

    let data: unknown = text;

    try {
      data = JSON.parse(text);
    } catch {}

    return {
      method: "GET",
      url,
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      method: "GET",
      url,
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
}

async function testPost(url: string, token: string, body: unknown) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    let data: unknown = text;

    try {
      data = JSON.parse(text);
    } catch {}

    return {
      method: "POST",
      url,
      ok: response.ok,
      status: response.status,
      body,
      data,
    };
  } catch (error) {
    return {
      method: "POST",
      url,
      ok: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
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

    const token = account.access_token;
    const userId = account.avito_user_id;

    const dateFrom = "2026-04-13";
    const dateTo = "2026-04-19";

    const getUrls = [
      `https://api.avito.ru/core/v1/accounts/${userId}/balance`,
      `https://api.avito.ru/core/v1/accounts/${userId}/balance/`,
      `https://api.avito.ru/core/v1/accounts/${userId}/operations`,
      `https://api.avito.ru/core/v1/accounts/${userId}/operations?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      `https://api.avito.ru/core/v1/accounts/${userId}/transactions`,
      `https://api.avito.ru/core/v1/accounts/${userId}/transactions?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      `https://api.avito.ru/core/v1/accounts/${userId}/expenses`,
      `https://api.avito.ru/core/v1/accounts/${userId}/expenses?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      `https://api.avito.ru/stats/v1/accounts/${userId}/expenses`,
      `https://api.avito.ru/stats/v1/accounts/${userId}/expenses?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      `https://api.avito.ru/cpa/v1/accounts/${userId}/expenses`,
      `https://api.avito.ru/cpa/v1/accounts/${userId}/expenses?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      `https://api.avito.ru/cpa/v1/accounts/${userId}/transactions`,
      `https://api.avito.ru/cpa/v1/accounts/${userId}/transactions?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      `https://api.avito.ru/vas/v1/accounts/${userId}/expenses`,
      `https://api.avito.ru/vas/v1/accounts/${userId}/expenses?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      `https://api.avito.ru/vas/v1/accounts/${userId}/operations`,
      `https://api.avito.ru/vas/v1/accounts/${userId}/operations?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      `https://api.avito.ru/promotion/v1/accounts/${userId}/expenses`,
      `https://api.avito.ru/promotion/v1/accounts/${userId}/expenses?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    ];

    const postTests = [
      testPost(`https://api.avito.ru/stats/v1/accounts/${userId}/expenses`, token, {
        dateFrom,
        dateTo,
      }),
      testPost(`https://api.avito.ru/cpa/v1/accounts/${userId}/expenses`, token, {
        dateFrom,
        dateTo,
      }),
      testPost(`https://api.avito.ru/vas/v1/accounts/${userId}/expenses`, token, {
        dateFrom,
        dateTo,
      }),
      testPost(`https://api.avito.ru/promotion/v1/accounts/${userId}/expenses`, token, {
        dateFrom,
        dateTo,
      }),
    ];

    const results = await Promise.all([
      ...getUrls.map((url) => testGet(url, token)),
      ...postTests,
    ]);

    const useful = results.filter((result) => {
      return result.ok || ![404, 405].includes(Number(result.status));
    });

    return Response.json({
      ok: true,
      account: account.name,
      dateFrom,
      dateTo,
      useful,
      all: results,
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