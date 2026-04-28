import { getAppContext } from "./app-context";

export type ActivityEntityType = "project" | "task";

export type ActivityLog = {
  id: string;
  workspace_id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  project_id: string | null;
  task_id: string | null;
  actor_user_id: string | null;
  actor_member_id: string | null;
  action: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type DbActivityLogRow = {
  id: string;
  workspace_id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  project_id: string | null;
  task_id: string | null;
  actor_user_id: string | null;
  actor_member_id: string | null;
  action: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function mapActivityLog(row: DbActivityLogRow): ActivityLog {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    project_id: row.project_id ?? null,
    task_id: row.task_id ?? null,
    actor_user_id: row.actor_user_id ?? null,
    actor_member_id: row.actor_member_id ?? null,
    action: row.action,
    title: row.title,
    description: row.description ?? null,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  };
}

export async function getActivityLogs(params: {
  entityType: ActivityEntityType;
  entityId: string;
  limit?: number;
}): Promise<ActivityLog[]> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("activity_logs")
    .select(
      "id, workspace_id, entity_type, entity_id, project_id, task_id, actor_user_id, actor_member_id, action, title, description, metadata, created_at"
    )
    .eq("workspace_id", workspace.id)
    .eq("entity_type", params.entityType)
    .eq("entity_id", params.entityId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (error) {
    throw new Error(`Ошибка загрузки истории изменений: ${error.message}`);
  }

  return ((data ?? []) as DbActivityLogRow[]).map(mapActivityLog);
}

export async function createActivityLog(params: {
  entityType: ActivityEntityType;
  entityId: string;
  projectId?: string | null;
  taskId?: string | null;
  action: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { supabase, workspace, user, membership } = await getAppContext();

  const { error } = await supabase.from("activity_logs").insert({
    workspace_id: workspace.id,
    entity_type: params.entityType,
    entity_id: params.entityId,
    project_id: params.projectId ?? null,
    task_id: params.taskId ?? null,
    actor_user_id: user.id,
    actor_member_id: membership?.id ?? null,
    action: params.action,
    title: params.title,
    description: params.description ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    throw new Error(`Ошибка сохранения истории изменений: ${error.message}`);
  }
}

export async function createActivityLogSafely(
  params: Parameters<typeof createActivityLog>[0]
) {
  try {
    await createActivityLog(params);
  } catch (error) {
    console.error(error);
  }
}
