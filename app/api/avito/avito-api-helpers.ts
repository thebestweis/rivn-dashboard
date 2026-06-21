import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

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
const pendingStatsRequests = new Map<string, Promise<AvitoPeriodStats>>();
const pendingAggregateStatsRequests = new Map<string, Promise<AvitoPeriodStats>>();
const pendingAggregateStatsByDayRequests = new Map<
  string,
  Promise<Record<string, AvitoPeriodStats>>
>();
const AGGREGATE_STATS_CACHE_HASH = "stats-v2-profile-totals-v2";
const AGGREGATE_STATS_BY_DAY_CACHE_HASH = "stats-v2-profile-day-v2";
const ACCURATE_ITEM_STATS_CACHE_HASH_PREFIX = "stats-v1-items:";

type AvitoStatPoint = {
  uniqViews?: number;
  uniqContacts?: number;
  uniqFavorites?: number;
};

type AvitoStatsItem = {
  itemId: number;
  stats?: AvitoStatPoint[];
};

type AvitoPeriodStats = {
  views: number;
  contacts: number;
  favorites: number;
};

type MetricBucket = keyof AvitoPeriodStats;

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

function chunkArray<T>(array: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
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
  const retryDelays = [1500, 3500, 7000, 12000];
  let lastData: unknown = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        cache: "no-store",
      });
    } catch (error) {
      throw new AvitoApiError(
        `${context}: не удалось подключиться к Avito API (${error instanceof Error ? error.message : "network error"})`,
        0,
        {
          url,
          cause: error instanceof Error ? error.message : String(error),
        }
      );
    }

    const data = await readJsonResponse(response);

    if (response.ok) {
      return data;
    }

    lastData = data;

    if (response.status !== 429 || attempt === retryDelays.length) {
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

    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const retryAfterMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : retryDelays[attempt];

    await sleep(retryAfterMs);
  }

  throw new AvitoApiError(
    "Avito временно ограничил запросы. Данные подтянутся в следующем отчёте.",
    429,
    lastData
  );
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
    .select("item_ids, fetched_at, next_page, is_complete")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error || !data || !Array.isArray(data.item_ids)) {
    return null;
  }

  const itemIds = data.item_ids.map(Number).filter(Number.isFinite);
  const fetchedAt = new Date(String(data.fetched_at)).getTime();
  const isComplete = data.is_complete !== false;
  const isFresh = isComplete && Number.isFinite(fetchedAt)
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
    isComplete,
    nextPage: Number(data.next_page || 1),
  };
}

async function saveCachedItemIds(params: {
  accountId?: string;
  avitoUserId?: string | null;
  itemIds: number[];
  nextPage?: number;
  isComplete?: boolean;
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
    next_page: params.nextPage ?? 1,
    is_complete: params.isComplete ?? true,
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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

async function fetchAllItemIdsFromAvito(params: {
  accountId?: string;
  avitoUserId?: string | null;
  accessToken: string;
  cachedItemIds?: number[];
  startPage?: number;
}) {
  const allItemIds = [...(params.cachedItemIds ?? [])];
  let page = Math.max(1, params.startPage ?? 1);
  const perPage = 100;

  while (true) {
    const data = await fetchAvitoJson(
      `https://api.avito.ru/core/v1/items?page=${page}&per_page=${perPage}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          Accept: "application/json",
        },
      },
      "Ошибка получения объявлений"
    );

    const resources = Array.isArray(data?.resources) ? data.resources : [];
    allItemIds.push(
      ...resources.map((item: { id?: number }) => Number(item.id)).filter(Boolean)
    );

    if (resources.length < perPage) {
      await saveCachedItemIds({
        accountId: params.accountId,
        avitoUserId: params.avitoUserId,
        itemIds: allItemIds,
        nextPage: 1,
        isComplete: true,
      });

      break;
    }

    page += 1;

    await saveCachedItemIds({
      accountId: params.accountId,
      avitoUserId: params.avitoUserId,
      itemIds: allItemIds,
      nextPage: page,
      isComplete: false,
    });

    if (page > 100) break;

    await sleep(500);
  }

  return allItemIds;
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
      const itemIds = await fetchAllItemIdsFromAvito({
        accountId: params.accountId,
        avitoUserId: params.avitoUserId,
        accessToken: params.accessToken,
        cachedItemIds: cached?.isComplete ? [] : cached?.itemIds,
        startPage: cached?.isComplete ? 1 : cached?.nextPage,
      });

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

function buildStatsCacheKey(params: {
  accountId?: string;
  avitoUserId: string;
  dateFrom: string;
  dateTo: string;
  itemIdsHash: string;
}) {
  return JSON.stringify({
    accountId: params.accountId,
    avitoUserId: params.avitoUserId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    itemIdsHash: params.itemIdsHash,
  });
}

function hashItemIds(itemIds: number[]) {
  return createHash("sha1").update(itemIds.join(",")).digest("hex");
}

function buildAccurateItemStatsHash(itemIds: number[]) {
  return `${ACCURATE_ITEM_STATS_CACHE_HASH_PREFIX}${hashItemIds(itemIds)}`;
}

async function loadStatsCache(params: {
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

  const { data, error } = await supabase
    .from("avito_report_stats_cache")
    .select(
      "id, views, contacts, favorites, processed_chunks, total_chunks, item_ids_hash, is_complete"
    )
    .eq("account_id", params.accountId)
    .eq("date_from", params.dateFrom)
    .eq("date_to", params.dateTo)
    .order("updated_at", { ascending: false })
    .limit(1);

  const row = data?.[0] ?? null;

  if (error || !row) {
    return null;
  }

  return {
    id: String(row.id),
    views: Number(row.views || 0),
    contacts: Number(row.contacts || 0),
    favorites: Number(row.favorites || 0),
    processedChunks: Number(row.processed_chunks || 0),
    totalChunks: Number(row.total_chunks || 0),
    itemIdsHash: String(row.item_ids_hash || ""),
    isComplete: row.is_complete === true,
  };
}

async function saveStatsCache(params: {
  id?: string;
  accountId?: string;
  avitoUserId: string;
  dateFrom: string;
  dateTo: string;
  itemIdsHash: string;
  views: number;
  contacts: number;
  favorites: number;
  processedChunks: number;
  totalChunks: number;
  isComplete: boolean;
}) {
  if (!params.accountId) {
    return;
  }

  const supabase = getServiceSupabase();

  if (!supabase) {
    return;
  }

  const payload = {
    account_id: params.accountId,
    avito_user_id: params.avitoUserId,
    date_from: params.dateFrom,
    date_to: params.dateTo,
    item_ids_hash: params.itemIdsHash,
    views: params.views,
    contacts: params.contacts,
    favorites: params.favorites,
    processed_chunks: params.processedChunks,
    total_chunks: params.totalChunks,
    is_complete: params.isComplete,
    updated_at: new Date().toISOString(),
  };

  if (params.id) {
    await supabase
      .from("avito_report_stats_cache")
      .update(payload)
      .eq("id", params.id);
    return;
  }

  await supabase.from("avito_report_stats_cache").insert(payload);
}

function normalizeMetricName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getMetricBucket(metricName: string): MetricBucket | null {
  const normalized = normalizeMetricName(metricName);

  if (
    [
      "uniqviews",
      "uniqueviews",
      "views",
      "view",
      "itemviews",
      "impressions",
      "totalviews",
      "uniqview",
      "uniqueview",
    ].includes(normalized)
  ) {
    return "views";
  }

  if (
    [
      "uniqcontacts",
      "uniquecontacts",
      "contacts",
      "contact",
      "contactsshown",
      "contactshows",
      "totalcontacts",
      "uniqcontact",
      "uniquecontact",
      "targetcontacts",
      "targetedcontacts",
    ].includes(normalized)
  ) {
    return "contacts";
  }

  if (
    [
      "uniqfavorites",
      "uniquefavorites",
      "favorites",
      "favorite",
      "favourites",
      "favourite",
      "totalfavorites",
      "uniqfavorite",
      "uniquefavorite",
    ].includes(normalized)
  ) {
    return "favorites";
  }

  return null;
}

const coreAnalyticsMetrics = ["views", "contacts", "favorites"];

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function addMetricValue(
  totals: AvitoPeriodStats,
  metricName: string,
  value: unknown
) {
  const bucket = getMetricBucket(metricName);

  if (!bucket) {
    return false;
  }

  totals[bucket] += toFiniteNumber(value);
  return true;
}

function collectMetricsFromValue(value: unknown): AvitoPeriodStats {
  const totals: AvitoPeriodStats = {
    views: 0,
    contacts: 0,
    favorites: 0,
  };

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }

    const record = node as Record<string, unknown>;
    const metricName =
      record.slug ?? record.name ?? record.code ?? record.metric ?? record.type;
    const metricValue =
      record.value ?? record.amount ?? record.count ?? record.total;

    if (
      typeof metricName === "string" &&
      metricValue !== undefined &&
      addMetricValue(totals, metricName, metricValue)
    ) {
      return;
    }

    for (const [key, nestedValue] of Object.entries(record)) {
      addMetricValue(totals, key, nestedValue);
    }

    const nestedCollections = [
      record.metrics,
      record.stats,
      record.items,
      record.values,
      record.groupings,
      record.groups,
    ];

    for (const nestedCollection of nestedCollections) {
      visit(nestedCollection);
    }
  };

  visit(value);

  return totals;
}

function parseAggregateStatsResponse(data: unknown): AvitoPeriodStats {
  const root = data as Record<string, unknown> | null;
  const result =
    root && typeof root === "object" && "result" in root
      ? (root.result as Record<string, unknown> | unknown[])
      : data;

  const candidates: unknown[] = [];

  if (result && typeof result === "object") {
    if (Array.isArray(result)) {
      candidates.push(result);
    } else {
      const resultRecord = result as Record<string, unknown>;
      candidates.push(
        resultRecord.totals,
        resultRecord.total,
        resultRecord.metrics,
        resultRecord.stats,
        resultRecord.groupings,
        resultRecord.groups,
        result
      );
    }
  }

  candidates.push(data);

  for (const candidate of candidates) {
    const totals = collectMetricsFromValue(candidate);

    if (totals.views || totals.contacts || totals.favorites) {
      return totals;
    }
  }

  return {
    views: 0,
    contacts: 0,
    favorites: 0,
  };
}

function normalizeDateKey(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? "";
}

function getGroupingDate(record: Record<string, unknown>): string {
  const directDate =
    normalizeDateKey(record.date) ||
    normalizeDateKey(record.day) ||
    normalizeDateKey(record.id) ||
    normalizeDateKey(record.name) ||
    normalizeDateKey(record.title) ||
    normalizeDateKey(record.value) ||
    normalizeDateKey(record.dateFrom) ||
    normalizeDateKey(record.date_from);

  if (directDate) {
    return directDate;
  }

  for (const nestedValue of Object.values(record)) {
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      const nestedDate: string = getGroupingDate(
        nestedValue as Record<string, unknown>
      );

      if (nestedDate) {
        return nestedDate;
      }
    }
  }

  return "";
}

function addStats(left: AvitoPeriodStats, right: AvitoPeriodStats) {
  left.views += right.views;
  left.contacts += right.contacts;
  left.favorites += right.favorites;
}

function hasStatsValue(stats?: AvitoPeriodStats | null) {
  return Boolean(stats && (stats.views || stats.contacts || stats.favorites));
}

function parseAggregateStatsByDayResponse(data: unknown) {
  const result =
    data && typeof data === "object" && "result" in data
      ? (data as Record<string, unknown>).result
      : data;
  const resultRecord =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : null;
  const groupings = [
    resultRecord?.groupings,
    resultRecord?.groups,
    resultRecord?.items,
    Array.isArray(result) ? result : null,
  ].find((value): value is unknown[] => Array.isArray(value));
  const statsByDate: Record<string, AvitoPeriodStats> = {};

  if (!groupings) {
    return statsByDate;
  }

  for (const grouping of groupings) {
    if (!grouping || typeof grouping !== "object") {
      continue;
    }

    const record = grouping as Record<string, unknown>;
    const date = getGroupingDate(record);

    if (!date) {
      continue;
    }

    if (!statsByDate[date]) {
      statsByDate[date] = { views: 0, contacts: 0, favorites: 0 };
    }

    addStats(statsByDate[date], collectMetricsFromValue(record));
  }

  return statsByDate;
}

async function fetchAggregateStatsFromAvito(params: {
  accessToken: string;
  avitoUserId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const requestBodies = [
    {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      grouping: "totals",
      metrics: coreAnalyticsMetrics,
      limit: 1000,
      offset: 0,
    },
  ];
  let lastError: unknown = null;

  for (const [index, body] of requestBodies.entries()) {
    try {
      const data = await fetchAvitoJson(
        `https://api.avito.ru/stats/v2/accounts/${params.avitoUserId}/items`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        "Ошибка получения агрегированной статистики"
      );

      const parsed = parseAggregateStatsResponse(data);

      if (hasStatsValue(parsed) || index === requestBodies.length - 1) {
        return data;
      }
    } catch (error) {
      lastError = error;

      if (
        !(error instanceof AvitoApiError) ||
        ![400, 404, 422].includes(error.status)
      ) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function fetchAggregateStatsByDayFromAvito(params: {
  accessToken: string;
  avitoUserId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const requestBodies = ["day", "date"].flatMap((grouping) =>
    [coreAnalyticsMetrics].map((metrics) => ({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      grouping,
      metrics,
      limit: 1000,
      offset: 0,
    }))
  );
  let lastError: unknown = null;

  for (const [index, body] of requestBodies.entries()) {
    try {
      const data = await fetchAvitoJson(
        `https://api.avito.ru/stats/v2/accounts/${params.avitoUserId}/items`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        "Ошибка получения статистики по дням"
      );

      const parsed = parseAggregateStatsByDayResponse(data);
      const hasParsedValues = Object.values(parsed).some(hasStatsValue);

      if (hasParsedValues || index === requestBodies.length - 1) {
        return data;
      }
    } catch (error) {
      lastError = error;

      if (
        !(error instanceof AvitoApiError) ||
        ![400, 404, 422].includes(error.status)
      ) {
        throw error;
      }
    }
  }

  throw lastError;
}

export async function getAvitoAggregateStatsForPeriod(params: {
  accountId?: string;
  accessToken: string;
  avitoUserId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<AvitoPeriodStats> {
  const cacheKey = buildStatsCacheKey({
    accountId: params.accountId,
    avitoUserId: params.avitoUserId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    itemIdsHash: AGGREGATE_STATS_CACHE_HASH,
  });
  const pending = pendingAggregateStatsRequests.get(cacheKey);

  if (pending) {
    return pending;
  }

  const request = (async () => {
    const cached = await loadStatsCache({
      accountId: params.accountId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });

    const cachedStats =
      cached?.isComplete &&
      (cached.itemIdsHash === AGGREGATE_STATS_CACHE_HASH ||
        cached.itemIdsHash.startsWith(ACCURATE_ITEM_STATS_CACHE_HASH_PREFIX))
        ? {
        views: cached.views,
        contacts: cached.contacts,
        favorites: cached.favorites,
          }
        : null;

    if (cachedStats && hasStatsValue(cachedStats)) {
      return cachedStats;
    }

    let stats: AvitoPeriodStats;
    const cacheHash = AGGREGATE_STATS_CACHE_HASH;
    const processedChunks = 1;
    const totalChunks = 1;
    const cacheId = cached?.id;

    try {
      const data = await fetchAggregateStatsFromAvito(params);
      stats = parseAggregateStatsResponse(data);

      if (!hasStatsValue(stats)) {
        console.warn("[avito:stats-v2] aggregate response parsed as zero", {
          accountId: params.accountId,
          avitoUserId: params.avitoUserId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        });
      }
    } catch (error) {
      if (cachedStats && hasStatsValue(cachedStats)) {
        return cachedStats;
      }

      throw error;
    }

    await saveStatsCache({
      id: cacheId,
      accountId: params.accountId,
      avitoUserId: params.avitoUserId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      itemIdsHash: cacheHash,
      views: stats.views,
      contacts: stats.contacts,
      favorites: stats.favorites,
      processedChunks,
      totalChunks,
      isComplete: hasStatsValue(stats),
    });

    return stats;
  })().finally(() => {
    pendingAggregateStatsRequests.delete(cacheKey);
  });

  pendingAggregateStatsRequests.set(cacheKey, request);

  return request;
}

export async function getAvitoAggregateStatsByDayForPeriod(params: {
  accountId?: string;
  accessToken: string;
  avitoUserId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<Record<string, AvitoPeriodStats>> {
  const cacheKey = JSON.stringify({
    accountId: params.accountId,
    avitoUserId: params.avitoUserId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    itemIdsHash: AGGREGATE_STATS_BY_DAY_CACHE_HASH,
  });
  const pending = pendingAggregateStatsByDayRequests.get(cacheKey);

  if (pending) {
    return pending;
  }

  const request = (async () => {
    const dates: string[] = [];
    const start = new Date(`${params.dateFrom}T00:00:00.000Z`);
    const end = new Date(`${params.dateTo}T00:00:00.000Z`);

    for (
      const current = new Date(start);
      current <= end;
      current.setUTCDate(current.getUTCDate() + 1)
    ) {
      dates.push(current.toISOString().slice(0, 10));
    }

    const cachedByDate: Record<string, AvitoPeriodStats> = {};

    for (const date of dates) {
      const cached = await loadStatsCache({
        accountId: params.accountId,
        dateFrom: date,
        dateTo: date,
      });

      const isAggregateCache =
        cached?.itemIdsHash === AGGREGATE_STATS_BY_DAY_CACHE_HASH ||
        cached?.itemIdsHash === AGGREGATE_STATS_CACHE_HASH;

      if (
        cached?.isComplete &&
        isAggregateCache &&
        hasStatsValue({
          views: cached.views,
          contacts: cached.contacts,
          favorites: cached.favorites,
        })
      ) {
        cachedByDate[date] = {
          views: cached.views,
          contacts: cached.contacts,
          favorites: cached.favorites,
        };
      }
    }

    if (dates.every((date) => cachedByDate[date])) {
      return cachedByDate;
    }

    try {
      const data = await fetchAggregateStatsByDayFromAvito(params);
      const statsByDate = parseAggregateStatsByDayResponse(data);
      const parsedHasValues = Object.values(statsByDate).some(hasStatsValue);

      if (!parsedHasValues) {
        console.warn("[avito:stats-v2] aggregate day response parsed as zero", {
          accountId: params.accountId,
          avitoUserId: params.avitoUserId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        });

        return {
          ...cachedByDate,
          ...statsByDate,
        };
      }

      for (const date of dates) {
        const stats = statsByDate[date];

        if (!stats) {
          continue;
        }

        const cached = await loadStatsCache({
          accountId: params.accountId,
          dateFrom: date,
          dateTo: date,
        });

        await saveStatsCache({
          id: cached?.id,
          accountId: params.accountId,
          avitoUserId: params.avitoUserId,
          dateFrom: date,
          dateTo: date,
          itemIdsHash: AGGREGATE_STATS_BY_DAY_CACHE_HASH,
          views: stats.views,
          contacts: stats.contacts,
          favorites: stats.favorites,
          processedChunks: 1,
          totalChunks: 1,
          isComplete: true,
        });
      }

      return {
        ...cachedByDate,
        ...statsByDate,
      };
    } catch (error) {
      if (Object.keys(cachedByDate).length > 0) {
        return cachedByDate;
      }

      throw error;
    }
  })().finally(() => {
    pendingAggregateStatsByDayRequests.delete(cacheKey);
  });

  pendingAggregateStatsByDayRequests.set(cacheKey, request);

  return request;
}

export async function getCachedAvitoStatsForPeriod(params: {
  accountId?: string;
  accessToken: string;
  avitoUserId: string;
  itemIds: number[];
  dateFrom: string;
  dateTo: string;
}): Promise<AvitoPeriodStats> {
  const itemIdsHash = buildAccurateItemStatsHash(params.itemIds);
  const cacheKey = buildStatsCacheKey({
    accountId: params.accountId,
    avitoUserId: params.avitoUserId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    itemIdsHash,
  });
  const pending = pendingStatsRequests.get(cacheKey);

  if (pending) {
    return pending;
  }

  const request = (async () => {
    const chunks = chunkArray(params.itemIds, 200);
    const cached = await loadStatsCache({
      accountId: params.accountId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });
    const canResume = cached?.itemIdsHash === itemIdsHash;

    if (canResume && cached?.isComplete) {
      return {
        views: cached.views,
        contacts: cached.contacts,
        favorites: cached.favorites,
      };
    }

    let cacheId = canResume ? cached?.id : undefined;
    let views = canResume ? cached?.views ?? 0 : 0;
    let contacts = canResume ? cached?.contacts ?? 0 : 0;
    let favorites = canResume ? cached?.favorites ?? 0 : 0;
    const startChunk = canResume ? cached?.processedChunks ?? 0 : 0;

    for (let index = startChunk; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const data = await fetchAvitoJson(
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
        },
        "Ошибка получения статистики"
      );

      const items = (data?.result?.items || []) as AvitoStatsItem[];

      for (const item of items) {
        for (const stat of item.stats || []) {
          views += Number(stat.uniqViews || 0);
          contacts += Number(stat.uniqContacts || 0);
          favorites += Number(stat.uniqFavorites || 0);
        }
      }

      await saveStatsCache({
        id: cacheId,
        accountId: params.accountId,
        avitoUserId: params.avitoUserId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        itemIdsHash,
        views,
        contacts,
        favorites,
        processedChunks: index + 1,
        totalChunks: chunks.length,
        isComplete: index + 1 === chunks.length,
      });

      if (!cacheId) {
        const saved = await loadStatsCache({
          accountId: params.accountId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        });
        cacheId = saved?.id;
      }

      await sleep(2000);
    }

    return {
      views,
      contacts,
      favorites,
    };
  })().finally(() => {
    pendingStatsRequests.delete(cacheKey);
  });

  pendingStatsRequests.set(cacheKey, request);

  return request;
}
