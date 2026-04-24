export async function GET(request: Request) {
  try {
    const baseUrl = new URL(request.url).origin;

    const response = await fetch(`${baseUrl}/api/cron/weekly-report?t=cron`, {
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Avito weekly report failed: ${response.status} ${JSON.stringify(data)}`
      );
    }

    return Response.json({
      ok: true,
      message: "Weekly cron выполнен",
      avitoWeeklyReport: data,
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