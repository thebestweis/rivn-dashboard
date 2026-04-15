import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";

export async function requireSuperAdminRoute() {
  const authSupabase = await createServerClient();

  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Пользователь не авторизован");
  }

  const serviceSupabase = createServiceRoleClient();

  const { data: profile, error: profileError } = await serviceSupabase
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
    serviceSupabase,
  };
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Внутренняя ошибка сервера";
}