import { requireBillingAccess } from "../billing-guards";
import { isAppRole, type AppRole } from "../permissions";
import { getAppContext } from "./app-context";

export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskAssignee = {
  id: string;
  task_id: string;
  workspace_member_id: string;
  created_at: string;
  workspace_member?: {
    id: string;
    email: string | null;
    role: string;
    status: string;
  };
};

export type Task = {
  id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  deadline_at: string | null;
  created_at: string;
  updated_at: string;
  position: number;
  is_archived: boolean;
  assignees?: TaskAssignee[];
};

export type CreateTaskInput = {
  project_id?: string | null;
  parent_task_id?: string | null;
  title: string;
  deadline_at?: string | null;
  assignee_ids?: string[];
  description?: string | null;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  deadline_at?: string | null;
  assignee_ids?: string[];
};

type DbTaskRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  deadline_at: string | null;
  created_at: string;
  updated_at: string;
  position: number | string | null;
  is_archived: boolean | null;
};

type DbTaskAssigneeRow = {
  id: string;
  task_id: string;
  workspace_member_id: string;
  created_at: string;
  workspace_members?:
    | {
        id: string;
        workspace_id: string;
        role: string;
        status: string;
        profiles?:
          | {
              email: string | null;
            }
          | {
              email: string | null;
            }[]
          | null;
      }
    | {
        id: string;
        workspace_id: string;
        role: string;
        status: string;
        profiles?:
          | {
              email: string | null;
            }
          | {
              email: string | null;
            }[]
          | null;
      }[]
    | null;
};

function mapTask(row: DbTaskRow): Task {
  return {
    id: row.id,
    project_id: row.project_id,
    parent_task_id: row.parent_task_id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    deadline_at: row.deadline_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    position: Number(row.position ?? 0),
    is_archived: row.is_archived ?? false,
  };
}

function mapTaskAssignee(row: DbTaskAssigneeRow): TaskAssignee {
  const workspaceMember = Array.isArray(row.workspace_members)
    ? row.workspace_members[0]
    : row.workspace_members;

  const profile = Array.isArray(workspaceMember?.profiles)
    ? workspaceMember.profiles[0]
    : workspaceMember?.profiles;

  return {
    id: row.id,
    task_id: row.task_id,
    workspace_member_id: row.workspace_member_id,
    created_at: row.created_at,
    workspace_member: workspaceMember
      ? {
          id: workspaceMember.id,
          email: profile?.email ?? null,
          role: workspaceMember.role,
          status: workspaceMember.status,
        }
      : undefined,
  };
}

function normalizeAssigneeIds(assigneeIds?: string[]) {
  return Array.from(
    new Set((assigneeIds ?? []).map((item) => item.trim()).filter(Boolean))
  );
}

function filterTasksByAccess(params: {
  tasks: Task[];
  role: AppRole | null;
  membershipId: string | null;
  membershipRole?: string | null;
}) {
  const { tasks, role, membershipId, membershipRole } = params;

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
    return tasks;
  }

  if (resolvedRole === "analyst") {
    return [];
  }

  if (resolvedRole === "employee") {
    if (!membershipId) {
      return [];
    }

    return tasks.filter((task) =>
      (task.assignees ?? []).some(
        (assignee) => assignee.workspace_member_id === membershipId
      )
    );
  }

  return [];
}

export async function getTaskAssignees(taskId: string): Promise<TaskAssignee[]> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("task_assignees")
    .select(
  `
  id,
  task_id,
  workspace_member_id,
  created_at,
  workspace_members!inner (
    id,
    workspace_id,
    role,
    status,
    profiles!workspace_members_user_id_fkey (
      email
    )
  )
  `
)
    .eq("task_id", taskId)
    .eq("workspace_members.workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Ошибка загрузки исполнителей задачи: ${error.message}`);
  }

  return (data ?? []).map((row) => mapTaskAssignee(row as DbTaskAssigneeRow));
}

export async function getTaskAssigneesMap(
  taskIds: string[]
): Promise<Record<string, TaskAssignee[]>> {
  const normalizedTaskIds = Array.from(new Set(taskIds.filter(Boolean)));

  if (normalizedTaskIds.length === 0) {
    return {};
  }

  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("task_assignees")
    .select(
  `
  id,
  task_id,
  workspace_member_id,
  created_at,
  workspace_members!inner (
    id,
    workspace_id,
    role,
    status,
    profiles!workspace_members_user_id_fkey (
      email
    )
  )
  `
)
    .in("task_id", normalizedTaskIds)
    .eq("workspace_members.workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Ошибка загрузки исполнителей задач: ${error.message}`);
  }

  const map: Record<string, TaskAssignee[]> = {};

  for (const row of data ?? []) {
  const mapped = mapTaskAssignee(row as DbTaskAssigneeRow);

    if (!map[mapped.task_id]) {
      map[mapped.task_id] = [];
    }

    map[mapped.task_id].push(mapped);
  }

  return map;
}

export async function replaceTaskAssignees(
  taskId: string,
  assigneeIds: string[]
): Promise<TaskAssignee[]> {
  await requireBillingAccess();

  const { supabase, workspace } = await getAppContext();

  const normalizedIds = normalizeAssigneeIds(assigneeIds);

  const { data: taskRow, error: taskError } = await supabase
    .from("tasks")
    .select("id, workspace_id")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (taskError) {
    throw new Error(`Ошибка проверки задачи: ${taskError.message}`);
  }

  if (!taskRow) {
    throw new Error("Задача не найдена");
  }

  const { error: deleteError } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId);

  if (deleteError) {
    throw new Error(
      `Ошибка очистки исполнителей задачи: ${deleteError.message}`
    );
  }

  if (normalizedIds.length === 0) {
    return [];
  }

  const { data: workspaceMembers, error: membersError } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspace.id)
    .in("id", normalizedIds);

  if (membersError) {
    throw new Error(`Ошибка проверки исполнителей: ${membersError.message}`);
  }

  const allowedIds = new Set(
    (workspaceMembers ?? []).map((item) => item.id as string)
  );

  const safeIds = normalizedIds.filter((id) => allowedIds.has(id));

  if (safeIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("task_assignees")
    .insert(
      safeIds.map((workspaceMemberId) => ({
        task_id: taskId,
        workspace_member_id: workspaceMemberId,
      }))
    )
    .select("id, task_id, workspace_member_id, created_at");

  if (error) {
    throw new Error(`Ошибка сохранения исполнителей задачи: ${error.message}`);
  }

  return ((data ?? []) as DbTaskAssigneeRow[]).map(mapTaskAssignee);
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
    const { supabase, workspace, membership } = await getAppContext();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Ошибка загрузки задач: ${error.message}`);
  }

  const mappedTasks = ((data ?? []) as DbTaskRow[]).map(mapTask);
  const assigneesMap = await getTaskAssigneesMap(
    mappedTasks.map((task) => task.id)
  );

    const tasksWithAssignees = mappedTasks.map((task) => ({
    ...task,
    assignees: assigneesMap[task.id] ?? [],
  }));

  const currentRole: AppRole | null = isAppRole(membership?.role)
  ? membership.role
  : null;

  return filterTasksByAccess({
  tasks: tasksWithAssignees,
  role: currentRole,
  membershipId: membership?.id ?? null,
  membershipRole: membership?.role ?? null,
  });
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  await requireBillingAccess();

  const { supabase, workspace, user } = await getAppContext();

   const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      project_id: input.project_id ?? null,
      parent_task_id: input.parent_task_id ?? null,
      title: input.title,
      description: input.description ?? null,
      deadline_at: input.deadline_at ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Ошибка создания задачи: ${error.message}`);
  }

  const mappedTask = mapTask(data as DbTaskRow);

  const assignees = await replaceTaskAssignees(
    mappedTask.id,
    input.assignee_ids ?? []
  );

  return {
    ...mappedTask,
    assignees,
  };
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<void> {
  await requireBillingAccess();

  const { supabase, workspace } = await getAppContext();

  const { error } = await supabase
    .from("tasks")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(`Ошибка обновления задачи: ${error.message}`);
  }
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Ошибка загрузки задачи: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const mappedTask = mapTask(data as DbTaskRow);
  const assignees = await getTaskAssignees(mappedTask.id);

  return {
    ...mappedTask,
    assignees,
  };
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput
): Promise<Task> {
  await requireBillingAccess();

  const { supabase, workspace } = await getAppContext();

  const payload = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.deadline_at !== undefined
      ? { deadline_at: input.deadline_at }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Ошибка обновления задачи: ${error.message}`);
  }

  const mappedTask = mapTask(data as DbTaskRow);

  const assignees =
    input.assignee_ids !== undefined
      ? await replaceTaskAssignees(taskId, input.assignee_ids)
      : await getTaskAssignees(taskId);

  return {
    ...mappedTask,
    assignees,
  };
}

export async function createSubtask(
  parentTaskId: string,
  projectId: string | null,
  title: string
): Promise<Task> {
  await requireBillingAccess();

  const { supabase, workspace, user } = await getAppContext();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      project_id: projectId ?? null,
      parent_task_id: parentTaskId,
      title,
      status: "todo",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Ошибка создания подзадачи: ${error.message}`);
  }

  return {
    ...mapTask(data as DbTaskRow),
    assignees: [],
  };
}

export async function getAllTasks(): Promise<Task[]> {
  const { supabase, workspace, membership } = await getAppContext();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("is_archived", false)
    .order("deadline_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Ошибка загрузки всех задач: ${error.message}`);
  }

  const mappedTasks = ((data ?? []) as DbTaskRow[]).map(mapTask);
  const assigneesMap = await getTaskAssigneesMap(
    mappedTasks.map((task) => task.id)
  );

    const tasksWithAssignees = mappedTasks.map((task) => ({
    ...task,
    assignees: assigneesMap[task.id] ?? [],
  }));

  const currentRole: AppRole | null = isAppRole(membership?.role)
  ? membership.role
  : null;

  return filterTasksByAccess({
  tasks: tasksWithAssignees,
  role: currentRole,
  membershipId: membership?.id ?? null,
  membershipRole: membership?.role ?? null,
});
}

export async function updateTaskDeadline(
  taskId: string,
  deadlineAt: string | null
): Promise<Task> {
  await requireBillingAccess();

  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      deadline_at: deadlineAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Ошибка обновления дедлайна: ${error.message}`);
  }

  const mappedTask = mapTask(data as DbTaskRow);
  const assignees = await getTaskAssignees(mappedTask.id);

  return {
    ...mappedTask,
    assignees,
  };
}