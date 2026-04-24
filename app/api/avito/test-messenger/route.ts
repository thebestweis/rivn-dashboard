import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function testEndpoint(url: string, token: string) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const data = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      url,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      url,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
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

    const token = account.access_token;
    const userId = account.avito_user_id;

    const results = await Promise.all([
      testEndpoint(
        `https://api.avito.ru/messenger/v1/accounts/${userId}/chats`,
        token
      ),
      testEndpoint(
        `https://api.avito.ru/messenger/v2/accounts/${userId}/chats`,
        token
      ),
      testEndpoint(
        `https://api.avito.ru/messenger/v1/accounts/${userId}/chats?limit=10`,
        token
      ),
      testEndpoint(
        `https://api.avito.ru/messenger/v1/accounts/${userId}/chats?unread_only=false`,
        token
      ),
    ]);

    return Response.json({
      ok: true,
      account: account.name,
      avito_user_id: userId,
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