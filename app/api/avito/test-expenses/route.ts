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
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const data = await res.json();

    return {
      ok: res.ok,
      status: res.status,
      url,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      url,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: account } = await supabase
      .from("avito_report_accounts")
      .select("access_token, avito_user_id, name")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!account) {
      return Response.json({ ok: false, error: "Нет аккаунта" });
    }

    const token = account.access_token;
    const userId = account.avito_user_id;

    const tests = await Promise.all([
      testEndpoint(
        `https://api.avito.ru/core/v1/accounts/${userId}`,
        token
      ),

      testEndpoint(
        `https://api.avito.ru/core/v1/accounts/${userId}/balance`,
        token
      ),

      testEndpoint(
        `https://api.avito.ru/core/v1/accounts/${userId}/operations`,
        token
      ),

      testEndpoint(
        `https://api.avito.ru/stats/v1/accounts/${userId}`,
        token
      ),

      testEndpoint(
        `https://api.avito.ru/autoload/v1/accounts/${userId}`,
        token
      ),
    ]);

    return Response.json({
      ok: true,
      account: account.name,
      results: tests,
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