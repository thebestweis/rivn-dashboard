"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, type DragEvent } from "react";
import { motion } from "framer-motion";
import {
  CreateProjectModal,
  type CreateProjectFormValues,
} from "../components/projects/create-project-modal";
import { ProjectCard } from "../components/projects/project-card";
import { ProjectsFilters } from "../components/projects/projects-filters";
import { canEditProjects, isAppRole, type AppRole } from "../lib/permissions";
import { useAppContextState } from "../providers/app-context-provider";

import { Skeleton } from "../components/ui/skeleton";

import { type Project, type ProjectStatus } from "../lib/supabase/projects";
import {
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useProjectsQuery,
  useUpdateProjectOrderMutation,
  useUpdateProjectMutation,
} from "../lib/queries/use-projects-query";
import { useActiveTaskCountsByProjectQuery } from "../lib/queries/use-tasks-query";
import { useClientsQuery } from "../lib/queries/use-clients-query";
import { useActiveWorkspaceMembers } from "../lib/queries/use-workspace-members-query";
import { getWorkspaceMemberDisplayName } from "../lib/supabase/workspace-members";

type StatusFilter = "all" | ProjectStatus;

type ClientOption = {
  id: string;
  name: string;
};

type MemberOption = {
  id: string;
  name: string;
};

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);

  if (!movedItem) {
    return items;
  }

  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

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
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [orderedProjectIds, setOrderedProjectIds] = useState<string[]>([]);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);

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
    data: activeTaskCounts = [],
  } = useActiveTaskCountsByProjectQuery(!isAppContextLoading);

  const {
    data: clientsData = [],
    isLoading: isClientsLoading,
    error: clientsError,
  } = useClientsQuery(!isAppContextLoading);

  const {
    activeMembers: workspaceMembersData,
  } = useActiveWorkspaceMembers(!isAppContextLoading && isCreateModalOpen);

  const createProjectMutation = useCreateProjectMutation();
  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();
  const updateProjectOrderMutation = useUpdateProjectOrderMutation();

  const isLoadingProjectsList = isProjectsLoading || isClientsLoading;

  const combinedError = projectsError || clientsError;

  useEffect(() => {
    setOrderedProjectIds((currentIds) => {
      const nextProjectIds = projects.map((project) => project.id);
      const nextProjectIdSet = new Set(nextProjectIds);
      const preservedIds = currentIds.filter((id) => nextProjectIdSet.has(id));
      const addedIds = nextProjectIds.filter((id) => !preservedIds.includes(id));

      return [...preservedIds, ...addedIds];
    });
  }, [projects]);

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
        name: getWorkspaceMemberDisplayName(member),
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

  const activeTaskCountByProjectId = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const item of activeTaskCounts) {
      counts[item.project_id] = item.count;
    }

    return counts;
  }, [activeTaskCounts]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    const orderIndexByProjectId = new Map(
      orderedProjectIds.map((id, index) => [id, index])
    );

    return [...projects].sort((a, b) => {
      const aIndex = orderIndexByProjectId.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderIndexByProjectId.get(b.id) ?? Number.MAX_SAFE_INTEGER;

      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }

      return a.sort_order - b.sort_order;
    }).filter((project) => {
      const clientName = clientNamesById[project.client_id] ?? "Без клиента";

      const matchesSearch =
        normalizedQuery.length === 0 ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        clientName.toLowerCase().includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "all" || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, clientNamesById, orderedProjectIds, deferredSearchQuery, statusFilter]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || statusFilter !== "all";

  const activeProjectsCount = useMemo(
    () => projects.filter((project) => project.status === "active").length,
    [projects]
  );

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

  function handleProjectDragOver(targetProjectId: string) {
    if (!draggedProjectId || draggedProjectId === targetProjectId) {
      return;
    }

    setOrderedProjectIds((currentIds) => {
      const fromIndex = currentIds.indexOf(draggedProjectId);
      const toIndex = currentIds.indexOf(targetProjectId);

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return currentIds;
      }

      return moveItem(currentIds, fromIndex, toIndex);
    });
  }

  async function handleProjectDrop() {
    if (!draggedProjectId) {
      return;
    }

    const orderedProjects = orderedProjectIds
      .map((projectId) => projects.find((project) => project.id === projectId))
      .filter((project): project is Project => Boolean(project));

    setDraggedProjectId(null);

    try {
      await updateProjectOrderMutation.mutateAsync(
        orderedProjects.map((project, index) => ({
          projectId: project.id,
          sortOrder: (index + 1) * 1000,
        }))
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить порядок проектов"
      );
    }
  }

  return (
    <>
      <main className="flex-1">
        <div className="rivn-page-shell mx-3 my-3 flex w-auto flex-col gap-5 px-4 py-4 sm:mx-4 sm:my-4 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
          {isProjectsAccessResolved && !canManageProjects ? (
  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
    У тебя доступ только на просмотр списка проектов. Создание,
    редактирование и удаление проектов недоступны на этой странице.
  </div>
) : null}

          <section className="rivn-card rivn-card-interactive p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.22em] text-[#43ffc2]">Рабочие направления</div>
                <h1 className="mt-1 text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">
                  Проекты
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-white/55">
                  Управление проектами и рабочими направлениями по клиентам
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">

                <ProjectsFilters
                  searchQuery={searchQuery}
                  statusFilter={statusFilter}
                  isLoading={isLoadingProjectsList}
                  resultsCount={filteredProjects.length}
                  activeProjectsCount={activeProjectsCount}
                  hasActiveFilters={hasActiveFilters}
                  onSearchChange={setSearchQuery}
                  onStatusChange={setStatusFilter}
                  onReset={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                />

                {showManageProjectsActions ? (
  <button
    type="button"
    onClick={openCreateProjectFlow}
    className="rivn-button rivn-button-primary h-11 px-4 text-sm font-semibold"
  >
    Добавить проект
  </button>
) : null}
              </div>
            </div>

          </section>

          <section className="rivn-card p-4 sm:p-5">
            {isLoadingProjectsList ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div
                    key={index}
                    className="min-h-[280px] rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
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

                {!hasActiveFilters && canManageProjects ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-white/55">
                    {["1. Создай клиента", "2. Добавь проект", "3. Поставь задачи"].map(
                      (step) => (
                        <span
                          key={step}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1"
                        >
                          {step}
                        </span>
                      )
                    )}
                  </div>
                ) : null}

                {!hasActiveFilters && showManageProjectsActions ? (
  <button
    type="button"
    onClick={openCreateProjectFlow}
    className="rivn-button rivn-button-primary mt-5 px-4 py-3 text-sm font-semibold"
  >
    Создать проект
  </button>
) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredProjects.map((project) => (
                  <motion.div
                    key={project.id}
                    layout
                    transition={{
                      layout: {
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      },
                    }}
                    draggable={showManageProjectsActions && !hasActiveFilters}
                    onDragStart={(event) => {
                      if (!showManageProjectsActions || hasActiveFilters) {
                        event.preventDefault();
                        return;
                      }

                      const dragEvent =
                        event as unknown as DragEvent<HTMLDivElement>;

                      setDraggedProjectId(project.id);
                      dragEvent.dataTransfer.effectAllowed = "move";
                      dragEvent.dataTransfer.setData("text/plain", project.id);
                    }}
                    onDragOver={(event) => {
                      if (!draggedProjectId || hasActiveFilters) return;

                      event.preventDefault();
                      handleProjectDragOver(project.id);
                    }}
                    onDrop={(event) => {
                      if (hasActiveFilters) return;

                      event.preventDefault();
                    }}
                    onDragEnd={() => {
                      void handleProjectDrop();
                    }}
                    className={`h-full ${
                      showManageProjectsActions && !hasActiveFilters
                        ? "cursor-grab active:cursor-grabbing"
                        : ""
                    } ${
                      draggedProjectId === project.id
                        ? "scale-[0.98] opacity-70"
                        : ""
                    }`}
                  >
                  <ProjectCard
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
                  </motion.div>
                ))}

                {showManageProjectsActions ? (
  <button
    type="button"
    onClick={openCreateProjectFlow}
    className="group flex min-h-[280px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/12 bg-white/[0.035] p-5 text-center transition duration-300 hover:-translate-y-0.5 hover:border-[#00f5a8]/28 hover:bg-white/[0.055]"
  >
    <div className="rivn-button px-4 py-2 text-sm font-medium group-hover:border-[#00f5a8]/28">
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
          <div className="rivn-panel w-full max-w-xl p-6">
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
                className="rivn-button-primary rounded-2xl px-4 py-2 text-sm"
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
