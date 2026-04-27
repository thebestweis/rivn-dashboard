import { sendCronErrorNotification } from "../send-cron-error-notification";
import { getCronSecret, verifyCronSecret } from "../verify-cron-secret";
import { GET as runAvitoDailyReport } from "../../avito/daily-report/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    console.error("[cron:daily] unauthorized request");
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = new URL(request.url).origin;
    const requestUrl = new URL(request.url);
    const force = requestUrl.searchParams.get("force") === "1";
    console.log("[cron:daily] started", {
      force,
      url: requestUrl.pathname,
      triggeredAt: new Date().toISOString(),
    });
    const secret = getCronSecret();
    const internalUrl = new URL(`${baseUrl}/api/avito/daily-report`);
    internalUrl.searchParams.set("t", "cron");

    if (force) {
      internalUrl.searchParams.set("force", "1");
    }

    const internalRequest = new Request(internalUrl.toString(), {
      headers: {
        authorization: `Bearer ${secret}`,
      },
    });

    const response = await runAvitoDailyReport(internalRequest);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Avito daily report failed: ${response.status} ${JSON.stringify(data)}`
      );
    }

    console.log("[cron:daily] completed", data);

    return Response.json({
      ok: true,
      message: "Daily cron выполнен",
      avitoDailyReport: data,
    });
  } catch (error) {
    console.error("[cron:daily] failed", error);
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
