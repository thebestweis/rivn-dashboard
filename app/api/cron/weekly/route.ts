import { sendCronErrorNotification } from "../send-cron-error-notification";
import { getCronSecret, verifyCronSecret } from "../verify-cron-secret";
import { GET as runAvitoWeeklyReport } from "../weekly-report/route";

export const dynamic = "force-dynamic";

const AVITO_REPORT_CRON_DISABLED = true;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (AVITO_REPORT_CRON_DISABLED) {
    console.log("[cron:weekly] skipped because Avito report cron is temporarily disabled");

    return Response.json({
      ok: true,
      disabled: true,
      message: "Avito weekly reports are temporarily disabled",
    });
  }

  try {
    const baseUrl = new URL(request.url).origin;
    const secret = getCronSecret();
    const internalRequest = new Request(
      `${baseUrl}/api/cron/weekly-report?t=cron`,
      {
        headers: {
          authorization: `Bearer ${secret}`,
        },
      }
    );

    const response = await runAvitoWeeklyReport(internalRequest);
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
    await sendCronErrorNotification({
      title: "Ошибка Weekly Cron",
      route: "/api/cron/weekly",
      error,
    });

    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Ошибка" },
      { status: 500 }
    );
  }
}
