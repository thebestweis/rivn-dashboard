import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: account, error: accountError } = await supabase
      .from("avito_report_accounts")
      .select("id, name, access_token")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (accountError || !account) {
      return Response.json(
        { ok: false, error: accountError?.message || "Аккаунт Avito не найден" },
        { status: 404 }
      );
    }

    if (!account.access_token) {
      return Response.json(
        { ok: false, error: "Сначала получи токен через /api/avito/test-token" },
        { status: 400 }
      );
    }

    const allItems: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://api.avito.ru/core/v1/items?page=${page}&per_page=${perPage}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return Response.json(
          {
            ok: false,
            page,
            status: response.status,
            error: data,
          },
          { status: response.status }
        );
      }

      const resources = Array.isArray(data.resources) ? data.resources : [];
      allItems.push(...resources);

      if (resources.length < perPage) {
        break;
      }

      page += 1;

      if (page > 50) {
        break;
      }
    }

    const itemIds = allItems
      .map((item) => item.id)
      .filter(Boolean);

    return Response.json({
      ok: true,
      account: account.name,
      total_items: allItems.length,
      total_item_ids: itemIds.length,
      sample_ids: itemIds.slice(0, 10),
      sample_items: allItems.slice(0, 3),
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