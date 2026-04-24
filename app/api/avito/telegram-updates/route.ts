import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Не найдены переменные Supabase");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("telegram_bot_chats")
      .select("chat_id, title, username, type, last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Ошибка загрузки chat_id: ${error.message}`);
    }

    return Response.json({
      ok: true,
      chats: (data ?? []).map((chat) => ({
        chatId: chat.chat_id,
        title: chat.title || "Без названия",
        username: chat.username,
        type: chat.type || "private",
        lastSeenAt: chat.last_seen_at,
      })),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка получения Telegram chat_id",
      },
      { status: 500 }
    );
  }
}