import { createClient } from "@/app/lib/supabase/client";

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export type ResolvedWorkspaceMember = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
};

export type ResolvedProject = {
  id: string;
  name: string;
  client_id: string;
};

export type ResolvedClient = {
  id: string;
  name: string;
};

export async function getWorkspaceMembersForResolver(workspaceId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select(`
      id,
      user_id,
      display_name,
      profiles!workspace_members_user_id_fkey (
        email
      )
    `)
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (error) {
    throw new Error(`Не удалось загрузить участников workspace: ${error.message}`);
  }

  return (data ?? []).map((item: any) => ({
    id: item.id,
    user_id: item.user_id,
    display_name: item.display_name ?? null,
    email: Array.isArray(item.profiles)
      ? item.profiles[0]?.email ?? ""
      : item.profiles?.email ?? "",
  })) as ResolvedWorkspaceMember[];
}

export async function getWorkspaceProjectsForResolver(workspaceId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, client_id")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Не удалось загрузить проекты workspace: ${error.message}`);
  }

  return (data ?? []) as ResolvedProject[];
}

export async function getWorkspaceClientsForResolver(workspaceId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Не удалось загрузить клиентов workspace: ${error.message}`);
  }

  return (data ?? []) as ResolvedClient[];
}

export function findMemberByName(
  members: ResolvedWorkspaceMember[],
  input: string
): ResolvedWorkspaceMember | null {
  const needle = normalize(input);

  if (!needle) return null;

  return (
    members.find((member) => normalize(member.display_name) === needle) ||
    members.find((member) => normalize(member.email).includes(needle)) ||
    members.find((member) => normalize(member.display_name).includes(needle)) ||
    null
  );
}

export function findProjectByName(
  projects: ResolvedProject[],
  input: string
): ResolvedProject | null {
  const needle = normalize(input);

  if (!needle) return null;

  return (
    projects.find((project) => normalize(project.name) === needle) ||
    projects.find((project) => normalize(project.name).includes(needle)) ||
    null
  );
}

export function findClientByName(
  clients: ResolvedClient[],
  input: string
): ResolvedClient | null {
  const needle = normalize(input);

  if (!needle) return null;

  return (
    clients.find((client) => normalize(client.name) === needle) ||
    clients.find((client) => normalize(client.name).includes(needle)) ||
    null
  );
}