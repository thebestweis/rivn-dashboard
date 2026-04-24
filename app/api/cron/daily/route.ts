export async function GET() {
  try {
    // 👉 Avito daily report
try {
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/avito/daily-report`);
} catch (e) {
  console.error("Avito daily report error:", e);
}
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/avito/daily-report?t=cron`;

    await fetch(url);

    return Response.json({
      ok: true,
      message: "Daily cron выполнен",
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