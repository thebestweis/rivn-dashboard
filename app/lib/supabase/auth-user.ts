import { createClient } from "./client";

export async function getAuthedSupabase() {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Не удалось получить пользователя: ${error.message}`);
  }

  if (!user) {
    throw new Error("Пользователь не авторизован");
  }

  return {
    supabase,
    userId: user.id,
  };
}