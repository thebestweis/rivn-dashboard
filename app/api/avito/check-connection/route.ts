import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { getAvitoAccessToken } from "@/app/api/avito/get-avito-access-token";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Не найдены переменные Supabase");
  }

  return createServiceClient(supabaseUrl, supabaseKey);
}

function getMoscowDate(daysAgo: number) {
  const now = new Date();
  const moscowNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Moscow" })
  );

  moscowNow.setDate(moscowNow.getDate() - daysAgo);

  const year = moscowNow.getFullYear();
  const month = String(moscowNow.getMonth() + 1).padStart(2, "0");
  const day = String(moscowNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId;
    const avitoUserId = String(body.avitoUserId || "").trim();
    const avitoClientId = String(body.avitoClientId || "").trim();
    const avitoClientSecret = String(body.avitoClientSecret || "").trim();

    if (!workspaceId) {
      return Response.json(
        { ok: false, error: "Не передан workspaceId" },
        { status: 400 }
      );
    }

    if (!avitoUserId || !avitoClientId || !avitoClientSecret) {
      return Response.json(
        { ok: false, error: "Заполни Avito user_id, client_id и client_secret" },
        { status: 400 }
      );
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
      throw new Error(`Ошибка проверки доступа: ${membershipError.message}`);
    }

    if (!membership) {
      return Response.json(
        { ok: false, error: "Нет доступа к этому кабинету" },
        { status: 403 }
      );
    }

    const accessToken = await getAvitoAccessToken({
      clientId: avitoClientId,
      clientSecret: avitoClientSecret,
    });

    const response = await fetch(
      "https://api.avito.ru/core/v1/items?page=1&per_page=1",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          error: `Avito API не принял данные: ${JSON.stringify(data)}`,
        },
        { status: 400 }
      );
    }

    const yesterday = getMoscowDate(1);
    const spendingsResponse = await fetch(
      `https://api.avito.ru/stats/v2/accounts/${avitoUserId}/spendings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateFrom: yesterday,
          dateTo: yesterday,
          filter: null,
          grouping: "day",
          spendingTypes: ["all"],
        }),
        cache: "no-store",
      }
    );

    const spendingsData = await spendingsResponse.json();

    if (!spendingsResponse.ok) {
      return Response.json(
        {
          ok: false,
          error: `Avito user_id не прошёл проверку расходов: ${JSON.stringify(
            spendingsData
          )}`,
        },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      message: "Подключение Avito работает",
      avitoUserId,
      itemsChecked: Array.isArray(data.resources) ? data.resources.length : 0,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка проверки Avito-подключения",
      },
      { status: 500 }
    );
  }
}
