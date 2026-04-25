"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppContextState } from "../../providers/app-context-provider";
import { queryKeys } from "../query-keys";
import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
  updateProjectOrder,
  type Project,
} from "../supabase/projects";

const STALE_TIME = 1000 * 60 * 10;
const GC_TIME = 1000 * 60 * 60;

export function useProjectsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: workspaceId
      ? queryKeys.projectsByWorkspace(workspaceId)
      : queryKeys.projects,
    queryFn: getProjects,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previousData) => previousData,
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
        (prev = []) => [createdProject, ...prev].sort((a, b) => a.sort_order - b.sort_order)
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

export function useUpdateProjectOrderMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: updateProjectOrder,
    onMutate: async (updates) => {
      if (!workspaceId) return;

      await queryClient.cancelQueries({
        queryKey: queryKeys.projectsByWorkspace(workspaceId),
      });

      const previousProjects = queryClient.getQueryData<Project[]>(
        queryKeys.projectsByWorkspace(workspaceId)
      );

      const orderByProjectId = new Map(
        updates.map((item) => [item.projectId, item.sortOrder])
      );

      queryClient.setQueryData<Project[]>(
        queryKeys.projectsByWorkspace(workspaceId),
        (prev = []) =>
          prev
            .map((project) => ({
              ...project,
              sort_order: orderByProjectId.get(project.id) ?? project.sort_order,
            }))
            .sort((a, b) => a.sort_order - b.sort_order)
      );

      return { previousProjects };
    },
    onError: (_error, _updates, context) => {
      if (!workspaceId || !context?.previousProjects) return;

      queryClient.setQueryData(
        queryKeys.projectsByWorkspace(workspaceId),
        context.previousProjects
      );
    },
  });
}
