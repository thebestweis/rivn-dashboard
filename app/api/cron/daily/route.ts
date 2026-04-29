import { after } from "next/server";
import { sendCronErrorNotification } from "../send-cron-error-notification";
import { getCronSecret, verifyCronSecret } from "../verify-cron-secret";
import { GET as runAvitoDailyReport } from "../../avito/daily-report/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function runDailyReportAndNotify(internalRequest: Request) {
  try {
    const response = await runAvitoDailyReport(internalRequest);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Avito daily report failed: ${response.status} ${JSON.stringify(data)}`
      );
    }

    console.log("[cron:daily] background completed", data);
    return data;
  } catch (error) {
    console.error("[cron:daily] background failed", error);
    await sendCronErrorNotification({
      title: "Daily Cron Error",
      route: "/api/cron/daily",
      error,
    });

    throw error;
  }
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    console.error("[cron:daily] unauthorized request");
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = new URL(request.url).origin;
    const requestUrl = new URL(request.url);
    const force = requestUrl.searchParams.get("force") === "1";
    const wait = requestUrl.searchParams.get("wait") === "1";

    console.log("[cron:daily] accepted", {
      force,
      wait,
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

    if (wait) {
      const data = await runDailyReportAndNotify(internalRequest);

      return Response.json({
        ok: true,
        mode: "sync",
        message: "Daily cron completed",
        avitoDailyReport: data,
      });
    }

    after(async () => {
      await runDailyReportAndNotify(internalRequest);
    });

    return Response.json({
      ok: true,
      mode: "background",
      message: "Daily cron accepted",
      acceptedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron:daily] failed before background start", error);
    await sendCronErrorNotification({
      title: "Daily Cron Error",
      route: "/api/cron/daily",
      error,
    });

    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
