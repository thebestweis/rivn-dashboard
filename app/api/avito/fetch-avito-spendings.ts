export type AvitoSpendingType =
  | "all"
  | "promotion"
  | "presence"
  | "commission"
  | "rest";

type FetchAvitoSpendingsParams = {
  accessToken: string;
  userId: string | number;
  dateFrom: string;
  dateTo: string;
  grouping: "day" | "week" | "month";
  spendingTypes?: AvitoSpendingType[];
};

const SPENDINGS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const spendingsCache = new Map<
  string,
  {
    expiresAt: number;
    data: any;
  }
>();

const pendingSpendingsRequests = new Map<string, Promise<any>>();

function buildCacheKey(params: FetchAvitoSpendingsParams) {
  return JSON.stringify({
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

export async function fetchAvitoSpendings({
  accessToken,
  userId,
  dateFrom,
  dateTo,
  grouping,
  spendingTypes = ["all", "promotion", "presence", "commission", "rest"],
}: FetchAvitoSpendingsParams) {
  const cacheKey = buildCacheKey({
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

  const request = fetch(
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
  )
    .then(async (res) => {
      const text = await res.text();

      if (!res.ok) {
        throw new Error(`Avito spendings failed: ${res.status}. ${text}`);
      }

      const data = JSON.parse(text);

      spendingsCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + SPENDINGS_CACHE_TTL_MS,
      });

      return data;
    })
    .finally(() => {
      pendingSpendingsRequests.delete(cacheKey);
    });

  pendingSpendingsRequests.set(cacheKey, request);

  return request;
}
