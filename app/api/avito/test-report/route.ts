import { runAvitoReport } from "@/app/api/avito/report-core";
import type { AvitoReportType } from "@/app/api/avito/report-reliability";
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
    const telegramChatId = url.searchParams.get("chatId");
    const accountName = url.searchParams.get("accountName");
    const previewMode = url.searchParams.get("preview") === "true";
    const sendMode = url.searchParams.get("send") === "true";
    const reportTypeParam = url.searchParams.get("reportType") ?? "daily";

    if (!(["daily", "weekly"] as string[]).includes(reportTypeParam)) {
      return Response.json(
        { ok: false, error: "reportType должен быть daily или weekly" },
        { status: 400 }
      );
    }

    if (previewMode && sendMode) {
      return Response.json(
        { ok: false, error: "Нельзя одновременно включить preview и send" },
        { status: 400 }
      );
    }

    if (!clientCode && !telegramChatId && !accountName) {
      return Response.json(
        {
          ok: false,
          error:
            "Передай clientCode, chatId или accountName для точечного отчёта",
        },
        { status: 400 }
      );
    }

    const result = await runAvitoReport({
      reportType: reportTypeParam as AvitoReportType,
      clientCode: clientCode || undefined,
      telegramChatId: telegramChatId || undefined,
      accountName: accountName || undefined,
      forceSend: true,
      testMode: !previewMode && !sendMode,
      previewMode,
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
