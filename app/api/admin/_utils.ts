import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";

export async function requireSuperAdminRoute() {
  const authSupabase = await createServerClient();

  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    throw new Error(
      `Пользователь не авторизован: ${userError?.message ?? "no user"}`
    );
  }

  const serviceSupabase = createServiceRoleClient();

  const { data: profile, error: profileError } = await serviceSupabase
    .from("profiles")
    .select("id, platform_role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Ошибка чтения profiles: ${profileError.message}`);
  }

  if (!profile) {
    throw new Error(`Профиль не найден для user.id=${user.id}`);
  }

  if (profile.platform_role !== "super_admin") {
    throw new Error(
      `Нет доступа: role=${profile.platform_role ?? "null"}, user.id=${user.id}`
    );
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