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
      .select("id, name, avito_client_id, avito_client_secret")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (accountError || !account) {
      return Response.json(
        {
          ok: false,
          error: accountError?.message || "Аккаунт Avito не найден",
        },
        { status: 404 }
      );
    }

    const tokenResponse = await fetch("https://api.avito.ru/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: account.avito_client_id,
        client_secret: account.avito_client_secret,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      await supabase
        .from("avito_report_accounts")
        .update({
          last_error: JSON.stringify(tokenData),
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      return Response.json(
        {
          ok: false,
          account: account.name,
          error: tokenData,
        },
        { status: tokenResponse.status }
      );
    }

    const expiresInSeconds = Number(tokenData.expires_in || 0);
    const tokenExpiresAt = new Date(
      Date.now() + expiresInSeconds * 1000
    ).toISOString();

    await supabase
      .from("avito_report_accounts")
      .update({
        access_token: tokenData.access_token,
        token_expires_at: tokenExpiresAt,
        last_error: null,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    return Response.json({
      ok: true,
      message: "Токен Avito успешно получен и сохранён",
      account: account.name,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      token_expires_at: tokenExpiresAt,
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