import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/app/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TurboPage = {
  Id: number;
  Name?: string;
  Href?: string;
  PreviewHref?: string;
  TurboSiteHref?: string;
};

function getServiceSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env is missing");
  }

  return createServiceClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function verifyWorkspaceAccess(workspaceId: string) {
  const authSupabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: "Пользователь не авторизован" };
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
    return { ok: false as const, status: 403, error: "Нет доступа к этому кабинету" };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = String(body.workspaceId || "").trim();
    const oauthToken = String(body.oauthToken || "").trim();
    const clientLogin = String(body.clientLogin || "").trim();

    if (!workspaceId) {
      return Response.json(
        { ok: false, error: "Не выбран кабинет RIVN OS" },
        { status: 400 }
      );
    }

    if (!oauthToken) {
      return Response.json(
        { ok: false, error: "Укажи OAuth-токен Яндекс Директа" },
        { status: 400 }
      );
    }

    const access = await verifyWorkspaceAccess(workspaceId);

    if (!access.ok) {
      return Response.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${oauthToken}`,
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json",
    };

    if (clientLogin) {
      headers["Client-Login"] = clientLogin;
    }

    const response = await fetch("https://api.direct.yandex.com/json/v5/turbopages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        method: "get",
        params: {
          FieldNames: ["Id", "Name", "Href", "PreviewHref", "TurboSiteHref"],
          Page: {
            Limit: 10000,
            Offset: 0,
          },
        },
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.error) {
      return Response.json(
        {
          ok: false,
          error:
            data?.error?.error_detail ||
            data?.error?.error_string ||
            "Яндекс не вернул список турбо-страниц",
          raw: data,
        },
        { status: 400 }
      );
    }

    const turboPages = ((data?.result?.TurboPages ?? []) as TurboPage[]).map(
      (page) => ({
        id: Number(page.Id),
        name: page.Name || `Турбо-страница ${page.Id}`,
        href: page.Href || page.TurboSiteHref || page.PreviewHref || "",
      })
    );

    return Response.json({
      ok: true,
      turboPages,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось получить турбо-страницы Яндекс Директа",
      },
      { status: 500 }
    );
  }
}
