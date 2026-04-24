import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AvitoStatPoint = {
  date?: string;
  uniqViews?: number;
  uniqContacts?: number;
  uniqFavorites?: number;
};

type AvitoStatsItem = {
  itemId: number;
  stats?: AvitoStatPoint[];
};

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

function chunkArray<T>(array: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: account, error: accountError } = await supabase
      .from("avito_report_accounts")
      .select("id, name, access_token, avito_user_id")
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

    if (!account.avito_user_id) {
      return Response.json(
        { ok: false, error: "Сначала получи avito_user_id через /api/avito/test-user" },
        { status: 400 }
      );
    }

    const allItems: { id: number }[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const itemsResponse = await fetch(
        `https://api.avito.ru/core/v1/items?page=${page}&per_page=${perPage}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            Accept: "application/json",
          },
        }
      );

      const itemsData = await itemsResponse.json();

      if (!itemsResponse.ok) {
        return Response.json(
          {
            ok: false,
            step: "items",
            page,
            status: itemsResponse.status,
            error: itemsData,
          },
          { status: itemsResponse.status }
        );
      }

      const resources = Array.isArray(itemsData.resources)
        ? itemsData.resources
        : [];

      allItems.push(...resources);

      if (resources.length < perPage) {
        break;
      }

      page += 1;

      if (page > 50) {
        break;
      }
    }

    const itemIds = allItems.map((item) => item.id).filter(Boolean);

    if (itemIds.length === 0) {
      return Response.json({
        ok: false,
        error: "Объявления не найдены",
      });
    }

    const dateFrom = getMoscowDate(7);
    const dateTo = getMoscowDate(1);
    const chunks = chunkArray(itemIds, 200);

    let views = 0;
    let contacts = 0;
    let favorites = 0;
    let itemsWithStatsCount = 0;

    const chunkResults = [];

    for (const [index, chunk] of chunks.entries()) {
      const statsResponse = await fetch(
        `https://api.avito.ru/stats/v1/accounts/${account.avito_user_id}/items`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dateFrom,
            dateTo,
            itemIds: chunk,
            periodGrouping: "day",
          }),
        }
      );

      const statsData = await statsResponse.json();

      if (!statsResponse.ok) {
        return Response.json(
          {
            ok: false,
            step: "stats",
            chunk_index: index + 1,
            status: statsResponse.status,
            request_body: {
              dateFrom,
              dateTo,
              itemIds_count: chunk.length,
              itemIds_sample: chunk.slice(0, 5),
              periodGrouping: "day",
            },
            error: statsData,
          },
          { status: statsResponse.status }
        );
      }

      const items = (statsData?.result?.items || []) as AvitoStatsItem[];

      for (const item of items) {
        if (Array.isArray(item.stats) && item.stats.length > 0) {
          itemsWithStatsCount += 1;
        }

        for (const stat of item.stats || []) {
          views += Number(stat.uniqViews || 0);
          contacts += Number(stat.uniqContacts || 0);
          favorites += Number(stat.uniqFavorites || 0);
        }
      }

      chunkResults.push({
        chunk_index: index + 1,
        items_in_chunk: chunk.length,
        items_returned: items.length,
      });
    }

    return Response.json({
      ok: true,
      account: account.name,
      dateFrom,
      dateTo,
      total_items: itemIds.length,
      chunks_count: chunks.length,
      chunk_results: chunkResults,
      items_with_stats_count: itemsWithStatsCount,
      totals: {
        views,
        contacts,
        favorites,
      },
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