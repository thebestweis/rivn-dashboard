"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
  type Project,
} from "../supabase/projects";

export function useProjectsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: getProjects,
    enabled,
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: (createdProject) => {
      queryClient.setQueryData<Project[]>(queryKeys.projects, (prev = []) => [
        createdProject,
        ...prev,
      ]);
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      values,
    }: {
      projectId: string;
      values: Parameters<typeof updateProject>[1];
    }) => updateProject(projectId, values),
    onSuccess: (updatedProject) => {
      queryClient.setQueryData<Project[]>(queryKeys.projects, (prev = []) =>
        prev.map((project) =>
          project.id === updatedProject.id ? updatedProject : project
        )
      );

      queryClient.setQueryData(
        queryKeys.project(updatedProject.id),
        updatedProject
      );
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: (_, deletedProjectId) => {
      queryClient.setQueryData<Project[]>(queryKeys.projects, (prev = []) =>
        prev.filter((project) => project.id !== deletedProjectId)
      );

      queryClient.removeQueries({
        queryKey: queryKeys.project(deletedProjectId),
      });

      queryClient.removeQueries({
        queryKey: queryKeys.projectTasks(deletedProjectId),
      });
    },
  });
}