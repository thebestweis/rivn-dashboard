import { sendCronErrorNotification } from "../send-cron-error-notification";
import { getCronSecret, verifyCronSecret } from "../verify-cron-secret";
import { GET as runAvitoDailyReport } from "../../avito/daily-report/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    console.error("[cron:daily] unauthorized request");
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const requestUrl = new URL(request.url);
    const internalUrl = new URL(`${requestUrl.origin}/api/avito/daily-report`);
    internalUrl.searchParams.set("t", "cron");

    if (requestUrl.searchParams.get("force") === "1") {
      internalUrl.searchParams.set("force", "1");
    }

    const response = await runAvitoDailyReport(
      new Request(internalUrl.toString(), {
        headers: {
          authorization: `Bearer ${getCronSecret()}`,
        },
      })
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
    console.error("[cron:daily] failed", error);
    await sendCronErrorNotification({
      title: "Daily Cron Error",
      route: "/api/cron/daily",
      error,
    });

    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Ошибка" },
      { status: 500 }
    );
  }
}
