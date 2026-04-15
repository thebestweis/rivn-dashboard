"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  createTask,
  getAllTasks,
  updateTaskDeadline,
  updateTaskStatus,
  type Task,
  type TaskStatus,
} from "../supabase/tasks";

export function useTasksQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: getAllTasks,
    enabled,
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTask,
    onSuccess: (createdTask) => {
      queryClient.setQueryData<Task[]>(queryKeys.tasks, (prev = []) => [
        createdTask,
        ...prev,
      ]);

      queryClient.setQueryData<Task[]>(
        queryKeys.projectTasks(createdTask.project_id),
        (prev = []) => [createdTask, ...prev]
      );
    },
  });
}

export function useUpdateTaskDeadlineMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      deadlineAt,
    }: {
      taskId: string;
      deadlineAt: string;
    }) => updateTaskDeadline(taskId, deadlineAt),
    onSuccess: (updatedTask) => {
      syncTaskAcrossCaches(queryClient, updatedTask);
    },
  });
}

export function useUpdateTaskStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      task,
      nextStatus,
    }: {
      task: Task;
      nextStatus: TaskStatus;
    }) => updateTaskStatus(task.id, nextStatus),
    onSuccess: (_, variables) => {
      patchTaskStatusInCaches(queryClient, variables.task, variables.nextStatus);
    },
  });
}

export function syncTaskAcrossCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  updatedTask: Task
) {
  queryClient.setQueryData<Task[]>(queryKeys.tasks, (prev = []) => {
    const exists = prev.some((task) => task.id === updatedTask.id);

    if (!exists) {
      return [updatedTask, ...prev];
    }

    return prev.map((task) =>
      task.id === updatedTask.id ? updatedTask : task
    );
  });

  queryClient.setQueryData<Task[]>(
    queryKeys.projectTasks(updatedTask.project_id),
    (prev = []) => {
      const exists = prev.some((task) => task.id === updatedTask.id);

      if (!exists) {
        return [updatedTask, ...prev];
      }

      return prev.map((task) =>
        task.id === updatedTask.id ? updatedTask : task
      );
    }
  );
}

export function patchTaskStatusInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  task: Task,
  status: TaskStatus
) {
  const patch = (list: Task[] = []) =>
    list.map((item) =>
      item.id === task.id
        ? {
            ...item,
            status,
            updated_at: new Date().toISOString(),
          }
        : item
    );

  queryClient.setQueryData<Task[]>(queryKeys.tasks, patch);
  queryClient.setQueryData<Task[]>(queryKeys.projectTasks(task.project_id), patch);
}