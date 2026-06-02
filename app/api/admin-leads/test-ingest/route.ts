import { apiSuccess } from "@/app/lib/api/errors";
import { processRivnLeadsMessage } from "@/app/lib/rivn-leads/processor";
import { requireSuperAdminRoute } from "../../admin/_utils";
import { adminLeadsFailure } from "../_utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { serviceSupabase } = await requireSuperAdminRoute();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const sourceChatId = typeof body?.sourceChatId === "string" ? body.sourceChatId.trim() : "";
    const messageText = typeof body?.messageText === "string" ? body.messageText.trim() : "";

    if (!sourceChatId) {
      throw new Error("Выбери чат-источник для теста");
    }
    if (!messageText) {
      throw new Error("Напиши тестовое сообщение");
    }

    const { data: sourceChat, error: sourceChatError } = await serviceSupabase
      .from("rivn_leads_source_chats")
      .select("telegram_chat_id,username")
      .eq("id", sourceChatId)
      .maybeSingle();

    if (sourceChatError) throw new Error(sourceChatError.message);
    if (!sourceChat) throw new Error("Чат-источник не найден");

    const result = await processRivnLeadsMessage(serviceSupabase, {
      sourceChatId,
      telegramChatId: sourceChat.telegram_chat_id,
      telegramMessageId: `test-${Date.now()}`,
      messageText,
      authorName: "Тестовый пользователь",
      authorUsername: typeof body?.authorUsername === "string" ? body.authorUsername : "test_lead",
      messageLink: sourceChat.username ? `https://t.me/${sourceChat.username}` : null,
      messageDate: new Date().toISOString(),
    });

    return apiSuccess({ result });
  } catch (error) {
    return adminLeadsFailure(error);
  }
}
