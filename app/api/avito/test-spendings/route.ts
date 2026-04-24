import { NextResponse } from "next/server";
import { fetchAvitoSpendings } from "@/app/api/avito/fetch-avito-spendings";
import { parseAvitoSpendings } from "@/app/api/avito/parse-avito-spendings";

export async function GET() {
  const accessToken = process.env.AVITO_ACCESS_TOKEN;
  const userId = process.env.AVITO_USER_ID;

  if (!accessToken || !userId) {
    return NextResponse.json(
      { error: "No AVITO_ACCESS_TOKEN or AVITO_USER_ID" },
      { status: 500 }
    );
  }

  const data = await fetchAvitoSpendings({
    accessToken,
    userId,
    dateFrom: "2026-04-01",
    dateTo: "2026-04-24",
    grouping: "day",
  });

  const parsed = parseAvitoSpendings(data);

  return NextResponse.json({
    parsed,
    raw: data,
  });
}