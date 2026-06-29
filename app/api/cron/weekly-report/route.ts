import { runAvitoReport } from "@/app/api/avito/report-core";
import { verifyCronSecret } from "../verify-cron-secret";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const result = await runAvitoReport({
      reportType: "weekly",
      forceSend: url.searchParams.get("force") === "1",
    });

    return Response.json(result, {
      status: result.ok ? 200 : result.status ?? 500,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Ошибка Avito weekly report",
      },
      { status: 500 }
    );
  }
}
