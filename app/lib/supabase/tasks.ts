import { requireBillingAccess } from "../billing-guards";
import { isAppRole, type AppRole } from "../permissions";
import { createActivityLogSafely } from "./activity-logs";
import { getAppContext } from "./app-context";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskRecurrenceFrequency = "daily" | "weekly" | "monthly";

export type TaskRecurrenceInput = {
  frequency: TaskRecurrenceFrequency;
  interval_value?: number;
  weekdays?: number[];
  month_day?: number | null;
  starts_at: string;
  ends_at?: string | null;
};

export type TaskRecurrenceUpdateInput =
  | { enabled: false }
  | ({ enabled: true } & TaskRecurrenceInput);

export type TaskRecurrenceRule = {
  id: string;
  workspace_id: string;
  template_task_id: string | null;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  assignee_ids: string[];
  frequency: TaskRecurrenceFrequency;
  interval_value: number;
  weekdays: number[];
  month_day: number | null;
  starts_at: string;
  ends_at: string | null;
  next_run_at: string;
  last_run_at: string | null;
  deadline_time: string | null;
  is_active: boolean;
};

export type TaskAssignee = {
  id: string;
  task_id: string;
  workspace_member_id: string;
  created_at: string;
  workspace_member?: {
    id: string;
    name: string | null;
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
  is_hot: boolean;
  recurrence_rule_id: string | null;
  recurrence_occurrence_date: string | null;
  assignees?: TaskAssignee[];
};

export type ActiveTaskCountByProject = {
  project_id: string;
  count: number;
};

export type CreateTaskInput = {
  project_id?: string | null;
  parent_task_id?: string | null;
  title: string;
  deadline_at?: string | null;
  assignee_ids?: string[];
  description?: string | null;
  is_hot?: boolean;
  recurrence?: TaskRecurrenceInput | null;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  deadline_at?: string | null;
  assignee_ids?: string[];
  is_hot?: boolean;
  recurrence?: TaskRecurrenceUpdateInput;
};

export type UpdateTaskPositionInput = {
  taskId: string;
  position: number;
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
  is_hot?: boolean | null;
  recurrence_rule_id?: string | null;
  recurrence_occurrence_date?: string | null;
};

type DbProjectTaskCountRow = {
  project_id: string | null;
  parent_task_id: string | null;
  status: TaskStatus;
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
        display_name: string | null;
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
        display_name: string | null;
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

type DbTaskRecurrenceRuleRow = {
  id: string;
  workspace_id: string;
  template_task_id: string | null;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  assignee_ids: string[] | null;
  frequency: TaskRecurrenceFrequency;
  interval_value: number | null;
  weekdays: number[] | null;
  month_day: number | null;
  starts_at: string;
  ends_at: string | null;
  next_run_at: string;
  last_run_at: string | null;
  deadline_time: string | null;
  is_active: boolean | null;
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
    is_hot: row.is_hot ?? false,
    recurrence_rule_id: row.recurrence_rule_id ?? null,
    recurrence_occurrence_date: row.recurrence_occurrence_date ?? null,
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
          name: workspaceMember.display_name ?? null,
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

function mapTaskRecurrenceRule(
  row: DbTaskRecurrenceRuleRow
): TaskRecurrenceRule {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    template_task_id: row.template_task_id,
    project_id: row.project_id,
    parent_task_id: row.parent_task_id,
    title: row.title,
    description: row.description ?? null,
    assignee_ids: row.assignee_ids ?? [],
    frequency: row.frequency,
    interval_value: Number(row.interval_value ?? 1),
    weekdays: row.weekdays ?? [],
    month_day: row.month_day ?? null,
    starts_at: row.starts_at,
    ends_at: row.ends_at ?? null,
    next_run_at: row.next_run_at,
    last_run_at: row.last_run_at ?? null,
    deadline_time: row.deadline_time ?? null,
    is_active: row.is_active ?? true,
  };
}

function normalizeWeekdays(weekdays?: number[]) {
  return Array.from(
    new Set(
      (weekdays ?? [])
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
    )
  ).sort((a, b) => a - b);
}

function getDatePart(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10);
}

function getTimePart(value: string | null | undefined) {
  const parsed = value ? new Date(value) : new Date();

  if (Number.isNaN(parsed.getTime())) {
    return "12:00";
  }

  return `${String(parsed.getHours()).padStart(2, "0")}:${String(
    parsed.getMinutes()
  ).padStart(2, "0")}`;
}

function buildRecurrenceRulePayload(params: {
  input: TaskRecurrenceInput;
  task: Task;
  workspaceId: string;
  assigneeIds?: string[];
}) {
  const { input, task, workspaceId, assigneeIds } = params;
  const intervalValue = Math.max(1, Number(input.interval_value ?? 1));
  const startsAt = new Date(input.starts_at);
  const safeStartsAt = Number.isNaN(startsAt.getTime()) ? new Date() : startsAt;
  const monthDay =
    input.month_day && input.month_day >= 1
      ? Math.min(31, input.month_day)
      : safeStartsAt.getDate();
  const normalizedWeekdays = normalizeWeekdays(input.weekdays);
  const weekdays =
    input.frequency === "weekly"
      ? normalizedWeekdays.length > 0
        ? normalizedWeekdays
        : [safeStartsAt.getDay()]
      : [];

  return {
    workspace_id: workspaceId,
    template_task_id: task.id,
    project_id: task.project_id,
    parent_task_id: task.parent_task_id,
    title: task.title,
    description: task.description,
    assignee_ids: normalizeAssigneeIds(assigneeIds),
    frequency: input.frequency,
    interval_value: intervalValue,
    weekdays,
    month_day: monthDay,
    starts_at: safeStartsAt.toISOString(),
    ends_at: input.ends_at ?? null,
    next_run_at: safeStartsAt.toISOString(),
    deadline_time: getTimePart(task.deadline_at ?? input.starts_at),
    updated_at: new Date().toISOString(),
  };
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
    resolvedRole === "manager" ||
    resolvedRole === "sales_head"
  ) {
    return tasks;
  }

  if (resolvedRole === "analyst") {
    return [];
  }

  if (resolvedRole === "employee" || resolvedRole === "sales_manager") {
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
    display_name,
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

  return ((data ?? []) as DbTaskAssigneeRow[]).map(mapTaskAssignee);
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
    display_name,
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
    ((workspaceMembers ?? []) as Array<{ id: string }>).map((item) => item.id)
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

  let nextPosition = 1000;

  if (input.parent_task_id) {
    const { data: lastSubtask, error: lastSubtaskError } = await supabase
      .from("tasks")
      .select("position")
      .eq("workspace_id", workspace.id)
      .eq("parent_task_id", input.parent_task_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSubtaskError) {
      throw new Error(`РћС€РёР±РєР° РїРѕРґРіРѕС‚РѕРІРєРё РїРѕСЂСЏРґРєР° Р·Р°РґР°С‡Рё: ${lastSubtaskError.message}`);
    }

    nextPosition = Number(lastSubtask?.position ?? 0) + 1000;
  }

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
      is_hot: input.is_hot ?? false,
      position: nextPosition,
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

  let recurrenceRuleId: string | null = null;

  if (input.recurrence) {
    const intervalValue = Math.max(1, Number(input.recurrence.interval_value ?? 1));
    const startsAt = new Date(input.recurrence.starts_at);
    const safeStartsAt = Number.isNaN(startsAt.getTime())
      ? new Date()
      : startsAt;
    const monthDay =
      input.recurrence.month_day && input.recurrence.month_day >= 1
        ? Math.min(31, input.recurrence.month_day)
        : safeStartsAt.getDate();
    const weekdays =
      input.recurrence.frequency === "weekly"
        ? normalizeWeekdays(input.recurrence.weekdays).length > 0
          ? normalizeWeekdays(input.recurrence.weekdays)
          : [safeStartsAt.getDay()]
        : [];

    const { data: ruleData, error: ruleError } = await supabase
      .from("task_recurrence_rules")
      .insert({
        workspace_id: workspace.id,
        template_task_id: mappedTask.id,
        project_id: input.project_id ?? null,
        parent_task_id: input.parent_task_id ?? null,
        title: input.title,
        description: input.description ?? null,
        assignee_ids: normalizeAssigneeIds(input.assignee_ids),
        frequency: input.recurrence.frequency,
        interval_value: intervalValue,
        weekdays,
        month_day: monthDay,
        starts_at: safeStartsAt.toISOString(),
        ends_at: input.recurrence.ends_at ?? null,
        next_run_at: safeStartsAt.toISOString(),
        deadline_time: getTimePart(input.deadline_at ?? input.recurrence.starts_at),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (ruleError || !ruleData) {
      await supabase
        .from("tasks")
        .delete()
        .eq("id", mappedTask.id)
        .eq("workspace_id", workspace.id);

      throw new Error(
        `Задача создана, но повторение не сохранилось: ${
          ruleError?.message ?? "нет данных"
        }`
      );
    }

    recurrenceRuleId = ruleData.id;

    await supabase
      .from("tasks")
      .update({
        recurrence_rule_id: recurrenceRuleId,
        recurrence_occurrence_date: getDatePart(input.deadline_at),
      })
      .eq("id", mappedTask.id)
      .eq("workspace_id", workspace.id);
  }

  return {
    ...mappedTask,
    recurrence_rule_id: recurrenceRuleId,
    recurrence_occurrence_date: recurrenceRuleId
      ? getDatePart(input.deadline_at)
      : null,
    assignees,
  };
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<void> {
  await requireBillingAccess();

  const { supabase, workspace } = await getAppContext();

  const { data: previousTask } = await supabase
    .from("tasks")
    .select("id, project_id, status")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

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

  await createActivityLogSafely({
    entityType: "task",
    entityId: taskId,
    projectId: (previousTask as { project_id?: string | null } | null)
      ?.project_id ?? null,
    taskId,
    action: "task_status_updated",
    title: "Статус задачи изменён",
    description: `Статус: ${
      (previousTask as { status?: string } | null)?.status ?? "не указан"
    } → ${status}`,
    metadata: {
      previousStatus: (previousTask as { status?: string } | null)?.status ?? null,
      nextStatus: status,
    },
  });
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

export async function getTaskRecurrenceRule(
  recurrenceRuleId: string | null
): Promise<TaskRecurrenceRule | null> {
  if (!recurrenceRuleId) {
    return null;
  }

  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("task_recurrence_rules")
    .select("*")
    .eq("id", recurrenceRuleId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Ошибка загрузки повторения задачи: ${error.message}`);
  }

  return data ? mapTaskRecurrenceRule(data as DbTaskRecurrenceRuleRow) : null;
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput
): Promise<Task> {
  await requireBillingAccess();

  const { supabase, workspace, user } = await getAppContext();

  const { data: previousTaskRow } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  const payload = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.deadline_at !== undefined
      ? { deadline_at: input.deadline_at }
      : {}),
    ...(input.is_hot !== undefined ? { is_hot: input.is_hot } : {}),
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

  let mappedTask = mapTask(data as DbTaskRow);

  const assignees =
    input.assignee_ids !== undefined
      ? await replaceTaskAssignees(taskId, input.assignee_ids)
      : await getTaskAssignees(taskId);

  if (input.recurrence !== undefined) {
    if (!input.recurrence.enabled) {
      if (mappedTask.recurrence_rule_id) {
        await supabase
          .from("task_recurrence_rules")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", mappedTask.recurrence_rule_id)
          .eq("workspace_id", workspace.id);
      }

      const { data: taskWithoutRecurrence, error: clearRecurrenceError } =
        await supabase
          .from("tasks")
          .update({
            recurrence_rule_id: null,
            recurrence_occurrence_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .eq("workspace_id", workspace.id)
          .select("*")
          .single();

      if (clearRecurrenceError) {
        throw new Error(
          `Ошибка отключения повторения задачи: ${clearRecurrenceError.message}`
        );
      }

      mappedTask = mapTask(taskWithoutRecurrence as DbTaskRow);
    } else {
      const recurrencePayload = buildRecurrenceRulePayload({
        input: input.recurrence,
        task: mappedTask,
        workspaceId: workspace.id,
        assigneeIds:
          input.assignee_ids ??
          assignees.map((assignee) => assignee.workspace_member_id),
      });

      let recurrenceRuleId = mappedTask.recurrence_rule_id;

      if (recurrenceRuleId) {
        const { error: recurrenceUpdateError } = await supabase
          .from("task_recurrence_rules")
          .update({
            ...recurrencePayload,
            is_active: true,
          })
          .eq("id", recurrenceRuleId)
          .eq("workspace_id", workspace.id);

        if (recurrenceUpdateError) {
          throw new Error(
            `Ошибка обновления повторения задачи: ${recurrenceUpdateError.message}`
          );
        }
      } else {
        const { data: recurrenceData, error: recurrenceCreateError } =
          await supabase
            .from("task_recurrence_rules")
            .insert({
              ...recurrencePayload,
              created_by: user.id,
            })
            .select("id")
            .single();

        if (recurrenceCreateError || !recurrenceData) {
          throw new Error(
            `Ошибка сохранения повторения задачи: ${
              recurrenceCreateError?.message ?? "нет данных"
            }`
          );
        }

        recurrenceRuleId = recurrenceData.id;
      }

      const { data: taskWithRecurrence, error: taskRecurrenceError } =
        await supabase
          .from("tasks")
          .update({
            recurrence_rule_id: recurrenceRuleId,
            recurrence_occurrence_date: getDatePart(input.recurrence.starts_at),
            updated_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .eq("workspace_id", workspace.id)
          .select("*")
          .single();

      if (taskRecurrenceError) {
        throw new Error(
          `Ошибка привязки повторения к задаче: ${taskRecurrenceError.message}`
        );
      }

      mappedTask = mapTask(taskWithRecurrence as DbTaskRow);
    }
  }

  const previousTask = previousTaskRow
    ? mapTask(previousTaskRow as DbTaskRow)
    : null;
  const changedFields: string[] = [];

  if (previousTask) {
    if (previousTask.title !== mappedTask.title) changedFields.push("название");
    if (previousTask.description !== mappedTask.description) {
      changedFields.push("описание");
    }
    if (previousTask.status !== mappedTask.status) changedFields.push("статус");
    if (previousTask.deadline_at !== mappedTask.deadline_at) {
      changedFields.push("дедлайн");
    }
    if (input.assignee_ids !== undefined) changedFields.push("исполнители");
    if (input.recurrence !== undefined) changedFields.push("повторение");
  }

  await createActivityLogSafely({
    entityType: "task",
    entityId: taskId,
    projectId: mappedTask.project_id,
    taskId,
    action: "task_updated",
    title: "Задача обновлена",
    description:
      changedFields.length > 0
        ? `Изменено: ${changedFields.join(", ")}`
        : "Данные задачи обновлены",
    metadata: {
      changedFields,
    },
  });

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

  const { data: lastSubtask, error: lastSubtaskError } = await supabase
    .from("tasks")
    .select("position")
    .eq("workspace_id", workspace.id)
    .eq("parent_task_id", parentTaskId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSubtaskError) {
    throw new Error(`РћС€РёР±РєР° РїРѕРґРіРѕС‚РѕРІРєРё РїРѕСЂСЏРґРєР° РїРѕРґР·Р°РґР°С‡Рё: ${lastSubtaskError.message}`);
  }

  const nextPosition = Number(lastSubtask?.position ?? 0) + 1000;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      project_id: projectId ?? null,
      parent_task_id: parentTaskId,
      title,
      status: "todo",
      position: nextPosition,
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

export async function getActiveRootTaskCountsByProject(): Promise<
  ActiveTaskCountByProject[]
> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("tasks")
    .select("project_id, parent_task_id, status, is_archived")
    .eq("workspace_id", workspace.id)
    .eq("is_archived", false)
    .is("parent_task_id", null)
    .in("status", ["todo", "in_progress"]);

  if (error) {
    throw new Error(`РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё СЃС‡С‘С‚С‡РёРєРѕРІ Р·Р°РґР°С‡: ${error.message}`);
  }

  const counts: Record<string, number> = {};

  for (const row of (data ?? []) as DbProjectTaskCountRow[]) {
    if (!row.project_id) {
      continue;
    }

    counts[row.project_id] = (counts[row.project_id] ?? 0) + 1;
  }

  return Object.entries(counts).map(([project_id, count]) => ({
    project_id,
    count,
  }));
}

export async function updateTaskDeadline(
  taskId: string,
  deadlineAt: string | null
): Promise<Task> {
  await requireBillingAccess();

  const { supabase, workspace } = await getAppContext();

  const { data: previousTask } = await supabase
    .from("tasks")
    .select("id, project_id, deadline_at")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

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

  await createActivityLogSafely({
    entityType: "task",
    entityId: taskId,
    projectId: mappedTask.project_id,
    taskId,
    action: "task_deadline_updated",
    title: "Дедлайн задачи изменён",
    description: "Обновлена дата выполнения задачи",
    metadata: {
      previousDeadline:
        (previousTask as { deadline_at?: string | null } | null)?.deadline_at ??
        null,
      nextDeadline: deadlineAt,
    },
  });

  return {
    ...mappedTask,
    assignees,
  };
}

export async function updateTaskPositions(
  updates: UpdateTaskPositionInput[]
): Promise<void> {
  await requireBillingAccess();

  const { supabase, workspace } = await getAppContext();

  const normalizedUpdates = updates.filter((item) => item.taskId);

  if (normalizedUpdates.length === 0) {
    return;
  }

  const { data: existingTasks, error: existingTasksError } = await supabase
    .from("tasks")
    .select("id")
    .eq("workspace_id", workspace.id)
    .in(
      "id",
      normalizedUpdates.map((item) => item.taskId)
    );

  if (existingTasksError) {
    throw new Error(`РћС€РёР±РєР° РїСЂРѕРІРµСЂРєРё РїРѕРґР·Р°РґР°С‡: ${existingTasksError.message}`);
  }

  if ((existingTasks ?? []).length !== normalizedUpdates.length) {
    throw new Error("РћРґРЅР° РёР· РїРѕРґР·Р°РґР°С‡ РЅРµ РЅР°Р№РґРµРЅР° РІ С‚РµРєСѓС‰РµРј РєР°Р±РёРЅРµС‚Рµ");
  }

  const results = await Promise.all(
    normalizedUpdates.map((item) =>
      supabase
        .from("tasks")
        .update({
          position: item.position,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.taskId)
        .eq("workspace_id", workspace.id)
    )
  );

  const failedResult = results.find((result) => result.error);

  if (failedResult?.error) {
    throw new Error(`РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РїРѕСЂСЏРґРєР° РїРѕРґР·Р°РґР°С‡: ${failedResult.error.message}`);
  }
}
