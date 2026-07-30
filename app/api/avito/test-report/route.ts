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
    const telegramChatId = url.searchParams.get("chatId");
    const previewMode = url.searchParams.get("preview") === "true";

    if (!clientCode && !telegramChatId) {
      return Response.json(
        {
          ok: false,
          error: "Передай clientCode или chatId для точечного теста",
        },
        { status: 400 }
      );
    }

    const result = await runAvitoReport({
      reportType: "daily",
      clientCode: clientCode || undefined,
      telegramChatId: telegramChatId || undefined,
      forceSend: true,
      testMode: !previewMode,
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
