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
  url: string;
  token: string;
  body: unknown;
}) {
  const response = await fetch(params.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.body),
  });

  const text = await response.text();

  let data: unknown = text;

  try {
    data = JSON.parse(text);
  } catch {}

  return {
    ok: response.ok,
    status: response.status,
    body: params.body,
    data,
  };
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: account, error } = await supabase
      .from("avito_report_accounts")
      .select("name, access_token, avito_user_id")
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

    const itemsResponse = await fetch(
      "https://api.avito.ru/core/v1/items?page=1&per_page=1",
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: "application/json",
        },
      }
    );

    const itemsData = await itemsResponse.json();
    const itemId = itemsData?.resources?.[0]?.id;

    if (!itemId) {
      return Response.json({
        ok: false,
        error: "Не найдено объявление для теста",
        itemsData,
      });
    }

    const userId = account.avito_user_id;
    const token = account.access_token;

    const vasUrl = `https://api.avito.ru/core/v1/accounts/${userId}/price/vas`;
    const packagesUrl = `https://api.avito.ru/core/v1/accounts/${userId}/price/vas_packages`;

    const bodies = [
      { item_id: itemId },
      { itemId },
      { item_ids: [itemId] },
      { itemIds: [itemId] },
      { ids: [itemId] },
      { items: [itemId] },
      { items: [{ item_id: itemId }] },
      { items: [{ itemId }] },
      { item_id: itemId, vas_id: "highlight" },
      { itemId, vas: "highlight" },
      { item_id: itemId, service: "highlight" },
      { item_id: itemId, service_id: "highlight" },
      { item_id: itemId, slug: "highlight" },
      { item_id: itemId, package_id: "x2_1" },
    ];

    const vasResults = await Promise.all(
      bodies.map((body) => requestJson({ url: vasUrl, token, body }))
    );

    const packageResults = await Promise.all(
      bodies.map((body) => requestJson({ url: packagesUrl, token, body }))
    );

    const useful = [...vasResults, ...packageResults].filter((result) => {
      const dataText = JSON.stringify(result.data);
      return (
        result.status !== 404 &&
        !dataText.includes("Bad Request") &&
        !dataText.includes("no Route matched")
      );
    });

    return Response.json({
      ok: true,
      account: account.name,
      itemId,
      useful,
      vasResults,
      packageResults,
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