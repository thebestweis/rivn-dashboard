import { sendCronErrorNotification } from "../send-cron-error-notification";
import { verifyCronSecret } from "../verify-cron-secret";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = new URL(request.url).origin;
    const secret = process.env.CRON_SECRET;

    const response = await fetch(
      `${baseUrl}/api/avito/daily-report?t=cron&secret=${secret}`,
      { cache: "no-store" }
    );

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
    await sendCronErrorNotification({
      title: "Ошибка Daily Cron",
      route: "/api/cron/daily",
      error,
    });

    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Ошибка" },
      { status: 500 }
    );
  }
}
