import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ITEMS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const itemIdsMemoryCache = new Map<
  string,
  {
    expiresAt: number;
    itemIds: number[];
  }
>();

const pendingItemRequests = new Map<string, Promise<number[]>>();

export class AvitoApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "AvitoApiError";
    this.status = status;
    this.details = details;
  }
}

function getServiceSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text.slice(0, 500),
    };
  }
}

export function isAvitoRateLimitError(error: unknown) {
  return error instanceof AvitoApiError && error.status === 429;
}

export function getFriendlyAvitoErrorMessage(error: unknown) {
  if (isAvitoRateLimitError(error)) {
    return "Avito временно ограничил запросы. Данные подтянутся в следующем отчёте.";
  }

  return error instanceof Error ? error.message : "Неизвестная ошибка Avito";
}

export async function fetchAvitoJson(
  url: string,
  init: RequestInit,
  context: string
) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });
  const data = await readJsonResponse(response);

  if (!response.ok) {
    if (response.status === 429) {
      throw new AvitoApiError(
        "Avito временно ограничил запросы. Данные подтянутся в следующем отчёте.",
        response.status,
        data
      );
    }

    throw new AvitoApiError(
      `${context}: ${JSON.stringify(data ?? { status: response.status })}`,
      response.status,
      data
    );
  }

  return data;
}

async function loadCachedItemIds(accountId?: string) {
  if (!accountId) {
    return null;
  }

  const memoryCached = itemIdsMemoryCache.get(accountId);

  if (memoryCached && memoryCached.expiresAt > Date.now()) {
    return {
      itemIds: memoryCached.itemIds,
      isFresh: true,
    };
  }

  const supabase = getServiceSupabase();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("avito_report_item_cache")
    .select("item_ids, fetched_at")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error || !data || !Array.isArray(data.item_ids)) {
    return null;
  }

  const itemIds = data.item_ids.map(Number).filter(Number.isFinite);
  const fetchedAt = new Date(String(data.fetched_at)).getTime();
  const isFresh = Number.isFinite(fetchedAt)
    ? Date.now() - fetchedAt < ITEMS_CACHE_TTL_MS
    : false;

  if (isFresh) {
    itemIdsMemoryCache.set(accountId, {
      itemIds,
      expiresAt: Date.now() + ITEMS_CACHE_TTL_MS,
    });
  }

  return {
    itemIds,
    isFresh,
  };
}

async function saveCachedItemIds(params: {
  accountId?: string;
  avitoUserId?: string | null;
  itemIds: number[];
}) {
  if (!params.accountId) {
    return;
  }

  itemIdsMemoryCache.set(params.accountId, {
    itemIds: params.itemIds,
    expiresAt: Date.now() + ITEMS_CACHE_TTL_MS,
  });

  const supabase = getServiceSupabase();

  if (!supabase) {
    return;
  }

  const { data: existing, error: selectError } = await supabase
    .from("avito_report_item_cache")
    .select("id")
    .eq("account_id", params.accountId)
    .maybeSingle();

  if (selectError) {
    return;
  }

  const payload = {
    account_id: params.accountId,
    avito_user_id: params.avitoUserId,
    item_ids: params.itemIds,
    fetched_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await supabase
      .from("avito_report_item_cache")
      .update(payload)
      .eq("id", existing.id);
    return;
  }

  await supabase.from("avito_report_item_cache").insert(payload);
}

async function fetchAllItemIdsFromAvito(accessToken: string) {
  const allItems: { id: number }[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const data = await fetchAvitoJson(
      `https://api.avito.ru/core/v1/items?page=${page}&per_page=${perPage}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
      "Ошибка получения объявлений"
    );

    const resources = Array.isArray(data?.resources) ? data.resources : [];
    allItems.push(...resources);

    if (resources.length < perPage) break;

    page += 1;

    if (page > 50) break;

    await sleep(250);
  }

  return allItems.map((item) => item.id).filter(Boolean);
}

export async function getCachedAvitoItemIds(params: {
  accountId?: string;
  avitoUserId?: string | null;
  accessToken: string;
}) {
  const cacheKey = params.accountId || params.avitoUserId || params.accessToken;
  const pending = pendingItemRequests.get(cacheKey);

  if (pending) {
    return pending;
  }

  const request = (async () => {
    const cached = await loadCachedItemIds(params.accountId);

    if (cached?.isFresh) {
      return cached.itemIds;
    }

    try {
      const itemIds = await fetchAllItemIdsFromAvito(params.accessToken);

      await saveCachedItemIds({
        accountId: params.accountId,
        avitoUserId: params.avitoUserId,
        itemIds,
      });

      return itemIds;
    } catch (error) {
      if (isAvitoRateLimitError(error) && cached?.itemIds.length) {
        return cached.itemIds;
      }

      throw error;
    }
  })().finally(() => {
    pendingItemRequests.delete(cacheKey);
  });

  pendingItemRequests.set(cacheKey, request);

  return request;
}
