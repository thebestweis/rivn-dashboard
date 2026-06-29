import { runAvitoReport } from "@/app/api/avito/report-core";
import { verifyCronSecret } from "../../cron/verify-cron-secret";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const clientCode = url.searchParams.get("clientCode");

    if (!clientCode) {
      return Response.json(
        { ok: false, error: "Передай clientCode для точечного теста" },
        { status: 400 }
      );
    }

    const result = await runAvitoReport({
      reportType: "daily",
      clientCode,
      forceSend: true,
      testMode: true,
    });

    return Response.json(result, {
      status: result.ok ? 200 : result.status ?? 500,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Ошибка тестового Avito отчёта",
      },
      { status: 500 }
    );
  }
}
