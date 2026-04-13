import { isAppRole, type AppRole } from "../permissions";
import { getAppContext } from "./app-context";

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

type DbProjectRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  client_id: string;
  employee_id: string | null;
  status: ProjectStatus;
  start_date: string | null;
  revenue: number | string | null;
  profit: number | string | null;
  description: string | null;
  project_overview: string | null;
  important_links: string | null;
  created_at: string;
};

function mapProject(row: DbProjectRow): Project {
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

function filterProjectsByAccess(params: {
  projects: Project[];
  role: AppRole | null;
  membershipId: string | null;
  membershipRole?: string | null;
}) {
  const { projects, role, membershipId, membershipRole } = params;

  const resolvedRole: AppRole | null = isAppRole(role)
    ? role
    : isAppRole(membershipRole)
      ? membershipRole
      : null;

  if (!resolvedRole) {
    return [];
  }

  if (
    resolvedRole === "owner" ||
    resolvedRole === "admin" ||
    resolvedRole === "manager"
  ) {
    return projects;
  }

  if (resolvedRole === "analyst") {
    return [];
  }

  if (resolvedRole === "employee") {
    if (!membershipId) {
      return [];
    }

    return projects.filter((project) => project.employee_id === membershipId);
  }

  return [];
}

export async function getProjects(): Promise<Project[]> {
  const { supabase, workspace, membership } = await getAppContext();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить проекты: ${error.message}`);
  }

  const mappedProjects = ((data ?? []) as DbProjectRow[]).map(mapProject);
  const currentRole: AppRole | null = isAppRole(membership?.role)
  ? membership.role
  : null;

  return filterProjectsByAccess({
    projects: mappedProjects,
    role: currentRole,
    membershipId: membership?.id ?? null,
    membershipRole: membership?.role ?? null,
  });
}
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { supabase, workspace, user } = await getAppContext();

  const payload = {
    user_id: user.id,
    workspace_id: workspace.id,
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

  return mapProject(data as DbProjectRow);
}

export async function updateProject(
  projectId: string,
  input: CreateProjectInput
): Promise<Project> {
  const { supabase, workspace } = await getAppContext();

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
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось обновить проект: ${error.message}`);
  }

  return mapProject(data as DbProjectRow);
}

export async function deleteProject(projectId: string): Promise<void> {
  const { supabase, workspace } = await getAppContext();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(`Не удалось удалить проект: ${error.message}`);
  }
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const { supabase, workspace, membership } = await getAppContext();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось загрузить проект: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const mappedProject = mapProject(data as DbProjectRow);
  const currentRole: AppRole | null = isAppRole(membership?.role)
  ? membership.role
  : null;

  const accessibleProjects = filterProjectsByAccess({
    projects: [mappedProject],
    role: currentRole,
    membershipId: membership?.id ?? null,
    membershipRole: membership?.role ?? null,
  });

  return accessibleProjects[0] ?? null;
}