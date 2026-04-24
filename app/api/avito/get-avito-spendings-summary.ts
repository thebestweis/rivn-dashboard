import { fetchAvitoSpendings } from "@/app/api/avito/fetch-avito-spendings";
import { parseAvitoSpendings } from "@/app/api/avito/parse-avito-spendings";

type GetAvitoSpendingsSummaryParams = {
  accessToken: string;
  userId: string | number;
  dateFrom: string;
  dateTo: string;
  grouping?: "day" | "week" | "month";
};

export async function getAvitoSpendingsSummary({
  accessToken,
  userId,
  dateFrom,
  dateTo,
  grouping = "day",
}: GetAvitoSpendingsSummaryParams) {
  const raw = await fetchAvitoSpendings({
    accessToken,
    userId,
    dateFrom,
    dateTo,
    grouping,
  });

  return parseAvitoSpendings(raw);
}