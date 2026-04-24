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

    const { data: account, error: accountError } = await supabase
      .from("avito_report_accounts")
      .select("id, name, access_token")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (accountError || !account) {
      return Response.json(
        { ok: false, error: accountError?.message || "Аккаунт не найден" },
        { status: 404 }
      );
    }

    if (!account.access_token) {
      return Response.json(
        { ok: false, error: "Сначала получи токен через /api/avito/test-token" },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.avito.ru/core/v1/accounts/self", {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          status: response.status,
          error: data,
        },
        { status: response.status }
      );
    }

    const avitoUserId = data?.id ? String(data.id) : null;

    if (avitoUserId) {
      await supabase
        .from("avito_report_accounts")
        .update({
          avito_user_id: avitoUserId,
          last_checked_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);
    }

    return Response.json({
      ok: true,
      account: account.name,
      avito_user_id: avitoUserId,
      data,
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