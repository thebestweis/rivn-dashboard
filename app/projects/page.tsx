"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CreateProjectModal,
  type CreateProjectFormValues,
} from "../components/projects/create-project-modal";
import { ProjectCard } from "../components/projects/project-card";
import { ProjectsFilters } from "../components/projects/projects-filters";
import { ProjectsStats } from "../components/projects/projects-stats";
import { canEditProjects, isAppRole, type AppRole } from "../lib/permissions";
import { useAppContextState } from "../providers/app-context-provider";

import { Skeleton } from "../components/ui/skeleton";

import { type Project, type ProjectStatus } from "../lib/supabase/projects";
import {
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useProjectsQuery,
  useUpdateProjectMutation,
} from "../lib/queries/use-projects-query";
import { useTasksQuery } from "../lib/queries/use-tasks-query";
import { useClientsQuery } from "../lib/queries/use-clients-query";
import { useActiveWorkspaceMembers } from "../lib/queries/use-workspace-members-query";

type StatusFilter = "all" | ProjectStatus;

type ClientOption = {
  id: string;
  name: string;
};

type MemberOption = {
  id: string;
  name: string;
};

export default function ProjectsPage() {
  const { role, isLoading: isAppContextLoading } = useAppContextState();

  const currentRole: AppRole | null = isAppRole(role) ? role : null;
  const canManageProjects = currentRole ? canEditProjects(currentRole) : false;

  const isProjectsAccessResolved = !isAppContextLoading;
const showManageProjectsActions = isProjectsAccessResolved && canManageProjects;

  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNoClientsModalOpen, setIsNoClientsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    if (canManageProjects) return;

    setIsCreateModalOpen(false);
    setEditingProject(null);
  }, [canManageProjects]);

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useProjectsQuery(!isAppContextLoading);

  const {
    data: tasks = [],
    isLoading: isTasksLoading,
    error: tasksError,
  } = useTasksQuery(!isAppContextLoading);

  const {
    data: clientsData = [],
    isLoading: isClientsLoading,
    error: clientsError,
  } = useClientsQuery(!isAppContextLoading);

  const {
    activeMembers: workspaceMembersData,
    isLoading: isWorkspaceMembersLoading,
    error: workspaceMembersError,
  } = useActiveWorkspaceMembers(!isAppContextLoading);

  const createProjectMutation = useCreateProjectMutation();
  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const isLoading =
    isProjectsLoading ||
    isTasksLoading ||
    isClientsLoading ||
    isWorkspaceMembersLoading;

  const combinedError =
    projectsError || tasksError || clientsError || workspaceMembersError;

  const clients: ClientOption[] = useMemo(
    () =>
      clientsData.map((client) => ({
        id: client.id,
        name: client.name,
      })),
    [clientsData]
  );

  const employees: MemberOption[] = useMemo(
    () =>
      workspaceMembersData.map((member) => ({
        id: member.id,
        name: member.display_name || member.email || "Без имени",
      })),
    [workspaceMembersData]
  );

  const clientNamesById = useMemo(
    () =>
      clientsData.reduce<Record<string, string>>((acc, client) => {
        acc[client.id] = client.name;
        return acc;
      }, {}),
    [clientsData]
  );

  const totalProjects = useMemo(() => projects.length, [projects]);

  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === "active").length,
    [projects]
  );

  const activeTaskCountByProjectId = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const task of tasks) {
      const isRootTask = task.parent_task_id === null;
      const isActiveTask =
        task.status === "todo" || task.status === "in_progress";

      if (!isRootTask || task.is_archived || !isActiveTask) {
        continue;
      }

      if (!task.project_id) {
  return;
}

counts[task.project_id] = (counts[task.project_id] ?? 0) + 1;
    }

    return counts;
  }, [tasks]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return projects.filter((project) => {
      const clientName = clientNamesById[project.client_id] ?? "Без клиента";

      const matchesSearch =
        normalizedQuery.length === 0 ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        clientName.toLowerCase().includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "all" || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, clientNamesById, searchQuery, statusFilter]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || statusFilter !== "all";

  const isSubmittingProject =
    createProjectMutation.isPending || updateProjectMutation.isPending;

  const pageErrorMessage = useMemo(() => {
    if (errorMessage) {
      return errorMessage;
    }

    if (combinedError instanceof Error) {
      return combinedError.message;
    }

    if (combinedError) {
      return "Не удалось загрузить проекты";
    }

    return "";
  }, [combinedError, errorMessage]);

  function openCreateProjectFlow() {
    if (!canManageProjects) {
      setErrorMessage("У тебя нет прав на создание проектов");
      return;
    }

    if (clients.length === 0) {
      setIsNoClientsModalOpen(true);
      return;
    }

    setErrorMessage("");
    setEditingProject(null);
    setIsCreateModalOpen(true);
  }

  async function handleSubmitProject(values: CreateProjectFormValues) {
    if (!canManageProjects) {
      setErrorMessage("У тебя нет прав на изменение проектов");
      return;
    }

    try {
      setErrorMessage("");

      if (editingProject) {
        await updateProjectMutation.mutateAsync({
          projectId: editingProject.id,
          values: {
            name: values.name,
            client_id: values.client_id,
            employee_id: values.employee_id || null,
            status: values.status,
            start_date: values.start_date,
            revenue: values.revenue,
            profit: values.profit,
            description: values.description,
            project_overview: values.project_overview,
            important_links: values.important_links,
          },
        });

        setEditingProject(null);
        setIsCreateModalOpen(false);
        return;
      }

      await createProjectMutation.mutateAsync({
        name: values.name,
        client_id: values.client_id,
        employee_id: values.employee_id || null,
        status: values.status,
        start_date: values.start_date,
        revenue: values.revenue,
        profit: values.profit,
        description: values.description,
        project_overview: values.project_overview,
        important_links: values.important_links,
      });

      setIsCreateModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось сохранить проект";
      setErrorMessage(message);
    }
  }

  async function handleDeleteProject(projectId: string) {
    if (!canManageProjects) {
      setErrorMessage("У тебя нет прав на удаление проектов");
      return;
    }

    try {
      setDeletingProjectId(projectId);
      setErrorMessage("");

      await deleteProjectMutation.mutateAsync(projectId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось удалить проект";

      setErrorMessage(message);
    } finally {
      setDeletingProjectId(null);
    }
  }

  function handleStartEdit(projectId: string) {
    if (!canManageProjects) {
      setErrorMessage("У тебя нет прав на редактирование проектов");
      return;
    }

    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      return;
    }

    setErrorMessage("");
    setEditingProject(project);
    setIsCreateModalOpen(true);
  }

  return (
    <>
      <main className="flex-1 px-6 py-6 md:px-8">
        <div className="flex w-full flex-col gap-6">
          {isProjectsAccessResolved && !canManageProjects ? (
  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
    У тебя доступ только на просмотр списка проектов. Создание,
    редактирование и удаление проектов недоступны на этой странице.
  </div>
) : null}

          <section className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  Проекты
                </h1>
                <p className="mt-2 text-sm text-white/60">
                  Управление проектами и рабочими направлениями по клиентам
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/tasks"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Все задачи
                </Link>

                {showManageProjectsActions ? (
  <button
    type="button"
    onClick={openCreateProjectFlow}
    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
  >
    Добавить проект
  </button>
) : null}
              </div>
            </div>
          </section>

          <ProjectsStats
            totalProjects={totalProjects}
            activeProjects={activeProjects}
            isLoading={isLoading}
          />

          <ProjectsFilters
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            isLoading={isLoading}
            resultsCount={filteredProjects.length}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={setSearchQuery}
            onStatusChange={setStatusFilter}
            onReset={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
          />

          <section className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div
                    key={index}
                    className="min-h-[280px] rounded-[24px] border border-white/10 bg-[#0F1724] p-5"
                  >
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="mt-4 h-7 w-3/4" />
                    <Skeleton className="mt-3 h-4 w-2/3" />
                    <Skeleton className="mt-6 h-10 w-full" />
                    <div className="mt-6 space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pageErrorMessage ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {pageErrorMessage}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
                <div className="text-lg font-medium text-white">
                  {hasActiveFilters
                    ? "Ничего не найдено по текущим фильтрам"
                    : "У вас пока нет проектов"}
                </div>

                <p className="mt-2 max-w-md text-sm text-white/55">
                  {hasActiveFilters
                    ? "Попробуй изменить поиск или выбрать другой статус."
                    : canManageProjects
                      ? "Создайте первый проект, чтобы начать вести направления, задачи и внутреннюю информацию по клиентам."
                      : "В этом кабинете пока нет доступных проектов."}
                </p>

                {!hasActiveFilters && showManageProjectsActions ? (
  <button
    type="button"
    onClick={openCreateProjectFlow}
    className="mt-5 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
  >
    Создать проект
  </button>
) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    clientName={clientNamesById[project.client_id] ?? "Без клиента"}
                    status={project.status}
                    startDate={project.start_date}
                    activeTasksCount={activeTaskCountByProjectId?.[project.id] ?? 0}
                    onDelete={handleDeleteProject}
                    onEdit={handleStartEdit}
                    isDeleting={deletingProjectId === project.id}
                    canManageProject={canManageProjects}
                  />
                ))}

                {showManageProjectsActions ? (
  <button
    type="button"
    onClick={openCreateProjectFlow}
    className="flex min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-5 text-center transition hover:border-white/20 hover:bg-white/[0.04]"
  >
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80">
      Добавить проект
    </div>
    <div className="mt-4 text-sm text-white/55">
      Создай новый проект прямо из сетки
    </div>
  </button>
) : null}
              </div>
            )}
          </section>
        </div>
      </main>

      {showManageProjectsActions ? (
  <CreateProjectModal
    isOpen={isCreateModalOpen}
    clients={clients}
    employees={employees}
    isSubmitting={isSubmittingProject}
    mode={editingProject ? "edit" : "create"}
    initialProject={editingProject}
    onClose={() => {
      if (!isSubmittingProject) {
        setIsCreateModalOpen(false);
        setEditingProject(null);
      }
    }}
    onSubmit={handleSubmitProject}
  />
) : null}

      {isNoClientsModalOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Отсутствуют активные клиенты
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/65">
                  Перед добавлением проекта вам нужно завести клиента в систему.
                  Для добавления клиента нажимайте{" "}
                  <Link
                    href="/clients"
                    className="font-medium text-white underline underline-offset-4"
                    onClick={() => setIsNoClientsModalOpen(false)}
                  >
                    сюда
                  </Link>
                  .
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsNoClientsModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <Link
                href="/clients"
                onClick={() => setIsNoClientsModalOpen(false)}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Перейти к клиентам
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}