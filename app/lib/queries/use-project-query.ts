"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { getProjectById } from "../supabase/projects";

export function useProjectQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => getProjectById(projectId),
    enabled: Boolean(projectId) && enabled,
  });
}