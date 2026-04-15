"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppContextState } from "../../providers/app-context-provider";
import { queryKeys } from "../query-keys";
import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
  type Project,
} from "../supabase/projects";

export function useProjectsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: workspaceId
      ? queryKeys.projectsByWorkspace(workspaceId)
      : queryKeys.projects,
    queryFn: getProjects,
    enabled: enabled && Boolean(workspaceId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: createProject,
    onSuccess: (createdProject) => {
      if (!workspaceId) return;

      queryClient.setQueryData<Project[]>(
        queryKeys.projectsByWorkspace(workspaceId),
        (prev = []) => [createdProject, ...prev]
      );
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: ({
      projectId,
      values,
    }: {
      projectId: string;
      values: Parameters<typeof updateProject>[1];
    }) => updateProject(projectId, values),
    onSuccess: (updatedProject) => {
      if (workspaceId) {
        queryClient.setQueryData<Project[]>(
          queryKeys.projectsByWorkspace(workspaceId),
          (prev = []) =>
            prev.map((project) =>
              project.id === updatedProject.id ? updatedProject : project
            )
        );
      }

      queryClient.setQueryData(
        queryKeys.project(updatedProject.id),
        updatedProject
      );
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: (_, deletedProjectId) => {
      if (workspaceId) {
        queryClient.setQueryData<Project[]>(
          queryKeys.projectsByWorkspace(workspaceId),
          (prev = []) => prev.filter((project) => project.id !== deletedProjectId)
        );
      }

      queryClient.removeQueries({
        queryKey: queryKeys.project(deletedProjectId),
      });

      queryClient.removeQueries({
        queryKey: queryKeys.projectTasks(deletedProjectId),
      });
    },
  });
}