import { requireBillingAccess } from "../billing-guards";
import { createClient } from "./client";

export type TaskComment = {
  id: string;
  task_id: string;
  text: string;
  created_at: string;
};

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Ошибка загрузки комментариев: ${error.message}`);
  }

  return (data ?? []) as TaskComment[];
}

export async function createTaskComment(
  taskId: string,
  text: string
): Promise<TaskComment> {
  await requireBillingAccess();

  const supabase = createClient();

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      text,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Ошибка создания комментария: ${error.message}`);
  }

  return data as TaskComment;
}