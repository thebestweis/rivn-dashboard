"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { getTasksByProject } from "../supabase/tasks";

export function useProjectTasksQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.projectTasks(projectId),
    queryFn: () => getTasksByProject(projectId),
    enabled: Boolean(projectId) && enabled,
  });
}