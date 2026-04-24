export async function GET() {
  try {
    // 👉 Avito weekly report
try {
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/cron/weekly-report`);
} catch (e) {
  console.error("Avito weekly report error:", e);
}
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/avito/weekly-report?t=cron`;

    await fetch(url);

    return Response.json({
      ok: true,
      message: "Weekly cron выполнен",
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