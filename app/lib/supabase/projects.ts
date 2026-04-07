import { getAuthedSupabase } from "./auth-user";

export type ProjectStatus = "active" | "paused" | "completed";

export type Project = {
  id: string;
  name: string;
  client_id: string;
    employee_id: string | null;
  status: ProjectStatus;
  start_date: string | null;
  revenue: number;
  profit: number;
  description: string | null;
  project_overview: string | null;
  important_links: string | null;
  created_at: string;
};

export type ProjectWithClient = Project & {
  client_name: string | null;
};

export type CreateProjectInput = {
  name: string;
  client_id: string;
    employee_id?: string | null;
  status?: ProjectStatus;
  start_date?: string | null;
  revenue?: number;
  profit?: number;
  description?: string;
  project_overview?: string;
  important_links?: string;
};

function mapProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    client_id: row.client_id,
        employee_id: row.employee_id ?? null,
    status: row.status,
    start_date: row.start_date,
    revenue: Number(row.revenue ?? 0),
    profit: Number(row.profit ?? 0),
    description: row.description ?? null,
    project_overview: row.project_overview ?? null,
    important_links: row.important_links ?? null,
    created_at: row.created_at,
  };
}

export async function getProjects(): Promise<Project[]> {
  const { supabase, userId } = await getAuthedSupabase();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить проекты: ${error.message}`);
  }

  return (data ?? []).map(mapProject);
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { supabase, userId } = await getAuthedSupabase();

  const payload = {
    user_id: userId,
    name: input.name,
    client_id: input.client_id,
        employee_id: input.employee_id ?? null,
    status: input.status ?? "active",
    start_date: input.start_date ?? null,
    revenue: input.revenue ?? 0,
    profit: input.profit ?? 0,
    description: input.description?.trim() || null,
    project_overview: input.project_overview?.trim() || null,
    important_links: input.important_links?.trim() || null,
  };

  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось создать проект: ${error.message}`);
  }

  return mapProject(data);
}

export async function updateProject(
  projectId: string,
  input: CreateProjectInput
): Promise<Project> {
  const { supabase, userId } = await getAuthedSupabase();

  const payload = {
    name: input.name,
    client_id: input.client_id,
        employee_id: input.employee_id ?? null,
    status: input.status ?? "active",
    start_date: input.start_date ?? null,
    revenue: input.revenue ?? 0,
    profit: input.profit ?? 0,
    description: input.description?.trim() || null,
    project_overview: input.project_overview?.trim() || null,
    important_links: input.important_links?.trim() || null,
  };

  const { data, error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось обновить проект: ${error.message}`);
  }

  return mapProject(data);
}

export async function deleteProject(projectId: string): Promise<void> {
  const { supabase, userId } = await getAuthedSupabase();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Не удалось удалить проект: ${error.message}`);
  }
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const { supabase, userId } = await getAuthedSupabase();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось загрузить проект: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapProject(data);
}