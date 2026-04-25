"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  createTask,
  getActiveRootTaskCountsByProject,
  getAllTasks,
  updateTaskDeadline,
  updateTaskPositions,
  updateTaskStatus,
  type Task,
  type TaskStatus,
  type ActiveTaskCountByProject,
} from "../supabase/tasks";
import { useAppContextState } from "../../providers/app-context-provider";

const STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 30;

export function useTasksQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: getAllTasks,
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useActiveTaskCountsByProjectQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery<ActiveTaskCountByProject[]>({
    queryKey: queryKeys.activeTaskCountsByProject(workspaceId),
    queryFn: getActiveRootTaskCountsByProject,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
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

      if (createdTask.project_id) {
        queryClient.setQueryData<Task[]>(
          queryKeys.projectTasks(createdTask.project_id),
          (prev = []) => [createdTask, ...prev]
        );
      }
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

  if (updatedTask.project_id) {
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

  if (task.project_id) {
    queryClient.setQueryData<Task[]>(
      queryKeys.projectTasks(task.project_id),
      patch
    );
  }
}

export function useUpdateTaskPositionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTaskPositions,
    onSuccess: (_result, updates) => {
      patchTaskPositionsInCaches(queryClient, updates);
    },
  });
}

export function patchTaskPositionsInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  updates: Array<{ taskId: string; position: number }>
) {
  const positionByTaskId = new Map(
    updates.map((item) => [item.taskId, item.position])
  );

  const patch = (list: Task[] = []) =>
    list.map((task) => {
      const nextPosition = positionByTaskId.get(task.id);

      if (nextPosition === undefined) {
        return task;
      }

      return {
        ...task,
        position: nextPosition,
        updated_at: new Date().toISOString(),
      };
    });

  queryClient.setQueryData<Task[]>(queryKeys.tasks, patch);

  queryClient
    .getQueryCache()
    .findAll({ queryKey: ["tasks", "project"] })
    .forEach((query) => {
      queryClient.setQueryData<Task[]>(query.queryKey, patch);
    });
}
