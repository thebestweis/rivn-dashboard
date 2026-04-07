"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "../components/layout/app-sidebar";
import {
  CreateProjectModal,
  type CreateProjectFormValues,
} from "../components/projects/create-project-modal";
import { ProjectCard } from "../components/projects/project-card";
import { ProjectsFilters } from "../components/projects/projects-filters";
import { ProjectsStats } from "../components/projects/projects-stats";
import { fetchClientsFromSupabase } from "../lib/supabase/clients";
import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
  type Project,
  type ProjectStatus,
} from "../lib/supabase/projects";

type StatusFilter = "all" | ProjectStatus;

type ClientOption = {
  id: string;
  name: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientNamesById, setClientNamesById] = useState<Record<string, string>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNoClientsModalOpen, setIsNoClientsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const [projectsData, clientsData] = await Promise.all([
          getProjects(),
          fetchClientsFromSupabase(),
        ]);

        if (!isMounted) return;

        const nextClients: ClientOption[] = clientsData.map((client) => ({
          id: client.id,
          name: client.name,
        }));

        const nextClientNamesById = clientsData.reduce<Record<string, string>>(
          (acc, client) => {
            acc[client.id] = client.name;
            return acc;
          },
          {}
        );

        setProjects(projectsData);
        setClients(nextClients);
        setClientNamesById(nextClientNamesById);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить проекты";

        if (isMounted) {
          setErrorMessage(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalProjects = useMemo(() => projects.length, [projects]);

  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === "active").length,
    [projects]
  );

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

  function openCreateProjectFlow() {
    if (clients.length === 0) {
      setIsNoClientsModalOpen(true);
      return;
    }

    setEditingProject(null);
    setIsCreateModalOpen(true);
  }

  async function handleSubmitProject(values: CreateProjectFormValues) {
    try {
      setIsCreatingProject(true);
      setErrorMessage("");

      if (editingProject) {
        const updatedProject = await updateProject(editingProject.id, {
          name: values.name,
          client_id: values.client_id,
          status: values.status,
          start_date: values.start_date,
          active_tasks_count: values.active_tasks_count,
          revenue: values.revenue,
          profit: values.profit,
          description: values.description,
          project_overview: values.project_overview,
          important_links: values.important_links,
        });

        setProjects((prev) =>
          prev.map((project) =>
            project.id === updatedProject.id ? updatedProject : project
          )
        );

        setEditingProject(null);
        setIsCreateModalOpen(false);
        return;
      }

      const createdProject = await createProject({
        name: values.name,
        client_id: values.client_id,
        status: values.status,
        start_date: values.start_date,
        active_tasks_count: values.active_tasks_count,
        revenue: values.revenue,
        profit: values.profit,
        description: values.description,
        project_overview: values.project_overview,
        important_links: values.important_links,
      });

      setProjects((prev) => [createdProject, ...prev]);
      setIsCreateModalOpen(false);
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function handleDeleteProject(projectId: string) {
    try {
      setDeletingProjectId(projectId);
      setErrorMessage("");

      await deleteProject(projectId);

      setProjects((prev) => prev.filter((project) => project.id !== projectId));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось удалить проект";

      setErrorMessage(message);
    } finally {
      setDeletingProjectId(null);
    }
  }

  function handleStartEdit(projectId: string) {
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      return;
    }

    setEditingProject(project);
    setIsCreateModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-6 py-6 md:px-8">
            <div className="flex w-full flex-col gap-6">
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

                    <button
                      type="button"
                      onClick={openCreateProjectFlow}
                      className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                    >
                      Добавить проект
                    </button>
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
                  <div className="text-sm text-white/60">Загрузка проектов...</div>
                ) : errorMessage ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                    {errorMessage}
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
                        : "Создайте первый проект, чтобы начать вести направления, задачи и внутреннюю информацию по клиентам."}
                    </p>

                    {!hasActiveFilters ? (
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
                        clientName={
                          clientNamesById[project.client_id] ?? "Без клиента"
                        }
                        status={project.status}
                        startDate={project.start_date}
                        activeTasksCount={project.active_tasks_count}
                        onDelete={handleDeleteProject}
                        onEdit={handleStartEdit}
                        isDeleting={deletingProjectId === project.id}
                      />
                    ))}

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
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        clients={clients}
        isSubmitting={isCreatingProject}
        mode={editingProject ? "edit" : "create"}
        initialProject={editingProject}
        onClose={() => {
          if (!isCreatingProject) {
            setIsCreateModalOpen(false);
            setEditingProject(null);
          }
        }}
        onSubmit={handleSubmitProject}
      />

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
    </div>
  );
}