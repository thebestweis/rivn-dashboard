import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "../supabase/admin-server";

export async function requireSuperAdminServer() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Пользователь не авторизован");
  }

  const adminSupabase = createAdminClient();

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Профиль не найден");
  }

  if (profile.platform_role !== "super_admin") {
    throw new Error("Нет доступа");
  }

  return {
    user,
    adminSupabase,
  };
}