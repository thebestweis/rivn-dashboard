import { getAppContext } from "./supabase/app-context";

export async function getAllWorkspaces() {
  const { supabase, profile } = await getAppContext();

  if (profile.platform_role !== "super_admin") {
    throw new Error("Нет доступа");
  }

  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}