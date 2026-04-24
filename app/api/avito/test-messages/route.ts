import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: account, error } = await supabase
      .from("avito_report_accounts")
      .select("name, access_token, avito_user_id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error || !account) {
      return Response.json({
        ok: false,
        error: error?.message || "Аккаунт Avito не найден",
      });
    }

    if (!account.access_token || !account.avito_user_id) {
      return Response.json({
        ok: false,
        error: "Нет access_token или avito_user_id",
      });
    }

    const chatsResponse = await fetch(
      `https://api.avito.ru/messenger/v2/accounts/${account.avito_user_id}/chats?limit=5`,
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: "application/json",
        },
      }
    );

    const chatsData = await chatsResponse.json();

    if (!chatsResponse.ok) {
      return Response.json({
        ok: false,
        step: "chats",
        status: chatsResponse.status,
        error: chatsData,
      });
    }

    const chats = Array.isArray(chatsData.chats) ? chatsData.chats : [];

    const results = [];

    for (const chat of chats.slice(0, 3)) {
      const messagesResponse = await fetch(
        `https://api.avito.ru/messenger/v3/accounts/${account.avito_user_id}/chats/${chat.id}/messages?limit=20`,
        {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            Accept: "application/json",
          },
        }
      );

      let messagesData: any = null;

      try {
        messagesData = await messagesResponse.json();
      } catch {
        messagesData = null;
      }

      results.push({
        chat_id: chat.id,
        chat_created: chat.created,
        chat_updated: chat.updated,
        messages_ok: messagesResponse.ok,
        messages_status: messagesResponse.status,
        messages_count: Array.isArray(messagesData?.messages)
          ? messagesData.messages.length
          : null,
        sample_messages: Array.isArray(messagesData?.messages)
          ? messagesData.messages.slice(0, 5).map((message: any) => ({
              id: message.id,
              author_id: message.author_id,
              direction: message.direction,
              created: message.created,
              type: message.type,
              text: message.content?.text || null,
            }))
          : messagesData,
      });
    }

    return Response.json({
      ok: true,
      account: account.name,
      avito_user_id: account.avito_user_id,
      chats_checked: results.length,
      results,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 }
    );
  }
}