import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RECENT_UNLINKED_CHAT_WINDOW_MS = 10 * 60 * 1000;

type TelegramChatRow = {
  chat_id: string;
  title: string | null;
  username: string | null;
  type: string | null;
  last_seen_at: string | null;
};

function mapChat(chat: TelegramChatRow) {
  return {
    chatId: chat.chat_id,
    title: chat.title || "Без названия",
    username: chat.username,
    type: chat.type || "private",
    lastSeenAt: chat.last_seen_at,
  };
}

function getServiceSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createServiceClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");

    if (!workspaceId) {
      throw new Error("Не передан workspaceId");
    }

    const authSupabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      return Response.json(
        { ok: false, error: "Пользователь не авторизован" },
        { status: 401 }
      );
    }

    const supabase = getServiceSupabase();

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      throw new Error(`Ошибка проверки доступа к кабинету: ${membershipError.message}`);
    }

    if (!membership) {
      return Response.json(
        { ok: false, error: "Нет доступа к этому кабинету" },
        { status: 403 }
      );
    }

    const { data: workspaceClients, error: clientsError } = await supabase
      .from("avito_report_clients")
      .select("telegram_chat_id")
      .eq("workspace_id", workspaceId)
      .not("telegram_chat_id", "is", null);

    if (clientsError) {
      throw new Error(`Ошибка загрузки чатов кабинета: ${clientsError.message}`);
    }

    const linkedChatIds = Array.from(
      new Set(
        (workspaceClients ?? [])
          .map((client) => client.telegram_chat_id)
          .filter(Boolean)
          .map(String)
      )
    );

    const recentSince = new Date(
      Date.now() - RECENT_UNLINKED_CHAT_WINDOW_MS
    ).toISOString();

    const linkedChatsPromise =
      linkedChatIds.length > 0
        ? supabase
            .from("telegram_bot_chats")
            .select("chat_id, title, username, type, last_seen_at")
            .in("chat_id", linkedChatIds)
            .order("last_seen_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });

    const recentChatsQuery = supabase
      .from("telegram_bot_chats")
      .select("chat_id, title, username, type, last_seen_at")
      .gte("last_seen_at", recentSince)
      .order("last_seen_at", { ascending: false })
      .limit(20);

    const [
      { data: linkedChats, error: linkedChatsError },
      { data: recentChats, error: recentChatsError },
    ] = await Promise.all([linkedChatsPromise, recentChatsQuery]);

    if (linkedChatsError) {
      throw new Error(`Ошибка загрузки привязанных chat_id: ${linkedChatsError.message}`);
    }

    if (recentChatsError) {
      throw new Error(`Ошибка загрузки новых chat_id: ${recentChatsError.message}`);
    }

    const chatsById = new Map<string, TelegramChatRow>();

    for (const chat of [...(linkedChats ?? []), ...(recentChats ?? [])]) {
      chatsById.set(String(chat.chat_id), chat as TelegramChatRow);
    }

    const chats = Array.from(chatsById.values()).sort((a, b) => {
      const dateA = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
      const dateB = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
      return dateB - dateA;
    });

    return Response.json({
      ok: true,
      chats: chats.map(mapChat),
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
