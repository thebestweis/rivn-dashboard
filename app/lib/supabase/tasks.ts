import { createClient } from "./client";

export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  deadline_at: string | null;
  created_at: string;
  updated_at: string;
  position: number;
  is_archived: boolean;
};

export type CreateTaskInput = {
  project_id: string;
  parent_task_id?: string | null;
  title: string;
  deadline_at?: string | null;
};

function mapTask(row: any): Task {
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

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Ошибка загрузки задач: ${error.message}`);
  }

  return (data ?? []).map(mapTask);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: input.project_id,
      parent_task_id: input.parent_task_id ?? null,
      title: input.title,
      deadline_at: input.deadline_at ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Ошибка создания задачи: ${error.message}`);
  }

  return mapTask(data);
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Ошибка обновления задачи: ${error.message}`);
  }
}

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  deadline_at?: string | null;
};

export async function getTaskById(taskId: string): Promise<Task | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw new Error(`Ошибка загрузки задачи: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapTask(data);
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput
): Promise<Task> {
  const supabase = createClient();

  const payload = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.deadline_at !== undefined ? { deadline_at: input.deadline_at } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Ошибка обновления задачи: ${error.message}`);
  }

  return mapTask(data);
}

export async function createSubtask(
  parentTaskId: string,
  projectId: string,
  title: string
): Promise<Task> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      parent_task_id: parentTaskId,
      title,
      status: "todo",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Ошибка создания подзадачи: ${error.message}`);
  }

  return mapTask(data);
}

export async function getAllTasks(): Promise<Task[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("is_archived", false)
    .order("deadline_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Ошибка загрузки всех задач: ${error.message}`);
  }

  return (data ?? []).map(mapTask);
}

export async function updateTaskDeadline(
  taskId: string,
  deadlineAt: string | null
): Promise<Task> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      deadline_at: deadlineAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Ошибка обновления дедлайна: ${error.message}`);
  }

  return mapTask(data);
}