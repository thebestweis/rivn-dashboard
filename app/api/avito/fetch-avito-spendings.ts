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

export async function fetchAvitoSpendings({
  accessToken,
  userId,
  dateFrom,
  dateTo,
  grouping,
  spendingTypes = ["all", "promotion", "presence", "commission", "rest"],
}: FetchAvitoSpendingsParams) {
  const res = await fetch(
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

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Avito spendings failed: ${res.status}. ${text}`);
  }

  return JSON.parse(text);
}