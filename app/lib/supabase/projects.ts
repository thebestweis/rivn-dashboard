import { createClient } from "./client";

export type ProjectStatus = "active" | "paused" | "completed";

export type Project = {
  id: string;
  name: string;
  client_id: string;
  status: ProjectStatus;
  start_date: string | null;
  active_tasks_count: number;
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
  status?: ProjectStatus;
  start_date?: string | null;
  active_tasks_count?: number;
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
    status: row.status,
    start_date: row.start_date,
    active_tasks_count: Number(row.active_tasks_count ?? 0),
    revenue: Number(row.revenue ?? 0),
    profit: Number(row.profit ?? 0),
    description: row.description ?? null,
    project_overview: row.project_overview ?? null,
    important_links: row.important_links ?? null,
    created_at: row.created_at,
  };
}

export async function getProjects(): Promise<Project[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить проекты: ${error.message}`);
  }

  return (data ?? []).map(mapProject);
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const supabase = createClient();

  const payload = {
    name: input.name,
    client_id: input.client_id,
    status: input.status ?? "active",
    start_date: input.start_date ?? null,
    active_tasks_count: input.active_tasks_count ?? 0,
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
  const supabase = createClient();

  const payload = {
    name: input.name,
    client_id: input.client_id,
    status: input.status ?? "active",
    start_date: input.start_date ?? null,
    active_tasks_count: input.active_tasks_count ?? 0,
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
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось обновить проект: ${error.message}`);
  }

  return mapProject(data);
}

export async function deleteProject(projectId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    throw new Error(`Не удалось удалить проект: ${error.message}`);
  }
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось загрузить проект: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapProject(data);
}