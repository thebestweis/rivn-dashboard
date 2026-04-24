export async function GET(request: Request) {
  try {
    const baseUrl = new URL(request.url).origin;

    const response = await fetch(`${baseUrl}/api/avito/daily-report?t=cron`, {
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Avito daily report failed: ${response.status} ${JSON.stringify(data)}`
      );
    }

    return Response.json({
      ok: true,
      message: "Daily cron выполнен",
      avitoDailyReport: data,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Ошибка",
      },
      { status: 500 }
    );
  }
}