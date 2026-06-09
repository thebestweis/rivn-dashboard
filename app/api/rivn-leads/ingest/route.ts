import { apiFailure, apiSuccess } from "@/app/lib/api/errors";
import { ApiAccessError } from "@/app/api/_guards";
import { readJsonWithLimit } from "@/app/api/_request";
import { safeEqualSecret } from "@/app/api/_secrets";
import { processRivnLeadsMessage } from "@/app/lib/rivn-leads/processor";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";

export const dynamic = "force-dynamic";

function getExpectedSecret() {
  return process.env.RIVN_LEADS_INGEST_SECRET || process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
}

function getRequestSecret(request: Request, body: Record<string, unknown> | null) {
  const headerSecret = request.headers.get("x-rivn-leads-secret") || request.headers.get("x-cron-secret");
  const bodySecret = typeof body?.secret === "string" ? body.secret : "";
  const urlSecret = new URL(request.url).searchParams.get("secret") || "";
  return headerSecret || bodySecret || urlSecret;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonWithLimit<Record<string, unknown>>(
      request,
      256 * 1024
    );
    const expectedSecret = getExpectedSecret();

    if (!safeEqualSecret(getRequestSecret(request, body), expectedSecret)) {
      return apiFailure({ error: new Error("Нет доступа"), status: 403, code: "FORBIDDEN" });
    }

    const sourceChatId = typeof body?.sourceChatId === "string" ? body.sourceChatId.trim() : "";
    const telegramChatId = typeof body?.telegramChatId === "string" ? body.telegramChatId.trim() : "";
    const telegramMessageId = typeof body?.telegramMessageId === "string" ? body.telegramMessageId.trim() : "";
    const messageText = typeof body?.messageText === "string" ? body.messageText.trim() : "";

    if (!sourceChatId || !telegramChatId || !telegramMessageId || !messageText) {
      return apiFailure({
        error: new Error("Не хватает данных для обработки сообщения"),
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const serviceSupabase = createServiceRoleClient();
    const result = await processRivnLeadsMessage(
      serviceSupabase,
      {
        sourceChatId,
        telegramChatId,
        telegramMessageId,
        messageText,
        authorName: typeof body?.authorName === "string" ? body.authorName : null,
        authorUsername: typeof body?.authorUsername === "string" ? body.authorUsername : null,
        messageLink: typeof body?.messageLink === "string" ? body.messageLink : null,
        messageDate: typeof body?.messageDate === "string" ? body.messageDate : new Date().toISOString(),
      },
      { deliver: process.env.RIVN_LEADS_DELIVER_IN_INGEST === "true" }
    );

    return apiSuccess({ result });
  } catch (error) {
    if (error instanceof ApiAccessError) {
      return apiFailure({
        error,
        status: error.status,
        code: "VALIDATION_ERROR",
      });
    }

    return apiFailure({ error, code: "INTERNAL_ERROR" });
  }
}
