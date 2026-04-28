"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, MessageCircle, Paperclip, Send, X } from "lucide-react";
import {
  CreateProjectModal,
  type CreateProjectFormValues,
} from "../../components/projects/create-project-modal";
import { ProjectTasksBoard } from "../../components/tasks/project-tasks-board";
import { TaskModal } from "../../components/tasks/task-modal";
import {
  canEditProjectDetails,
  isAppRole,
  type AppRole,
} from "../../lib/permissions";
import { useAppContextState } from "../../providers/app-context-provider";
import { queryKeys } from "../../lib/query-keys";
import { type Project } from "../../lib/supabase/projects";
import { type Task, type TaskStatus } from "../../lib/supabase/tasks";
import { useProjectQuery } from "../../lib/queries/use-project-query";
import { useProjectTasksQuery } from "../../lib/queries/use-project-tasks-query";
import { useClientsQuery } from "../../lib/queries/use-clients-query";
import { useActiveWorkspaceMembers } from "../../lib/queries/use-workspace-members-query";
import { useUpdateProjectMutation } from "../../lib/queries/use-projects-query";
import { syncTaskAcrossCaches } from "../../lib/queries/use-tasks-query";
import { getWorkspaceMemberDisplayName } from "../../lib/supabase/workspace-members";
import {
  createProjectComment,
  formatChatAttachmentSize,
  getProjectComments,
  type ProjectComment,
} from "../../lib/supabase/project-comments";
import {
  getActivityLogs,
  type ActivityLog,
} from "../../lib/supabase/activity-logs";
import { getBillingErrorMessage } from "../../lib/billing-errors";

import { Skeleton } from "../../components/ui/skeleton";
import { AppToast } from "../../components/ui/app-toast";

type ClientOption = {
  id: string;
  name: string;
};

type MemberOption = {
  id: string;
  name: string;
};

function getStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "Активный";
    case "paused":
      return "Пауза";
    case "completed":
      return "Завершён";
    default:
      return status;
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "paused":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "completed":
      return "border-sky-500/20 bg-sky-500/10 text-sky-300";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function formatDate(value: string | null) {
  if (!value) return "Не указана";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Не указана";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMessageDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeLinks(raw: string | null) {
  if (!raw?.trim()) return [];

  return raw
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((value, index) => {
      const href =
        value.startsWith("http://") || value.startsWith("https://")
          ? value
          : `https://${value}`;

      return {
        id: `${index}-${value}`,
        label: value,
        href,
      };
    });
}

function PencilButton({
  onClick,
  title,
}: {
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-4 w-4"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
      </svg>
    </button>
  );
}

export default function ProjectPage() {
  const {
    role,
    membership,
    billingAccess,
    isLoading: isAppContextLoading,
  } = useAppContextState();
  const queryClient = useQueryClient();

  const currentRole: AppRole | null = isAppRole(role) ? role : null;
  const canManageProjectDetails = currentRole
    ? canEditProjectDetails(currentRole)
    : false;

  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params?.id as string;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState("");
  const [linksDraft, setLinksDraft] = useState("");
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isProjectChatOpen, setIsProjectChatOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [projectCommentDraft, setProjectCommentDraft] = useState("");
  const [projectCommentAttachment, setProjectCommentAttachment] =
    useState<File | null>(null);
  const projectCommentAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const {
    data: project,
    isLoading: isProjectLoading,
    error: projectError,
  } = useProjectQuery(projectId, !isAppContextLoading);

  const {
    data: tasks = [],
    isLoading: isTasksLoading,
    error: tasksError,
  } = useProjectTasksQuery(projectId, !isAppContextLoading);

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

  const updateProjectMutation = useUpdateProjectMutation();
  const isBillingReadOnly = billingAccess?.isReadOnly ?? false;
  const canUseProjectChat =
    Boolean(currentRole) && currentRole !== "analyst" && !isBillingReadOnly;

  const projectCommentsQueryKey = useMemo(
    () => ["project-comments", projectId],
    [projectId]
  );
  const projectActivityLogsQueryKey = useMemo(
    () => ["activity-logs", "project", projectId],
    [projectId]
  );

  const {
    data: projectComments = [],
    isLoading: isProjectCommentsLoading,
  } = useQuery({
    queryKey: projectCommentsQueryKey,
    queryFn: () => getProjectComments(projectId),
    enabled: Boolean(projectId) && !isAppContextLoading,
    staleTime: 1000 * 30,
  });

  const {
    data: projectActivityLogs = [],
    isLoading: isProjectActivityLogsLoading,
  } = useQuery({
    queryKey: projectActivityLogsQueryKey,
    queryFn: () =>
      getActivityLogs({
        entityType: "project",
        entityId: projectId,
      }),
    enabled: Boolean(projectId) && !isAppContextLoading,
    staleTime: 1000 * 30,
  });

  const createProjectCommentMutation = useMutation({
    mutationFn: (params: { text: string; attachment: File | null }) =>
      createProjectComment({
        projectId,
        text: params.text,
        attachment: params.attachment,
      }),
    onSuccess: (createdComment) => {
      queryClient.setQueryData<ProjectComment[]>(
        projectCommentsQueryKey,
        (prev = []) => [...prev, createdComment]
      );
      queryClient.invalidateQueries({ queryKey: projectActivityLogsQueryKey });
    },
  });

  const isLoading =
    !mounted ||
    isAppContextLoading ||
    isProjectLoading ||
    isTasksLoading ||
    isClientsLoading ||
    isWorkspaceMembersLoading;
  const combinedError =
    projectError || tasksError || clientsError || workspaceMembersError;

  const clients: ClientOption[] = useMemo(
    () =>
      clientsData.map((item) => ({
        id: item.id,
        name: item.name,
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

  const workspaceMembersById = useMemo(() => {
    return new Map(workspaceMembersData.map((member) => [member.id, member]));
  }, [workspaceMembersData]);

  const currentMemberId = membership?.id ?? null;

  function getProjectCommentAuthorLabel(comment: ProjectComment) {
    const member = comment.author_member_id
      ? workspaceMembersById.get(comment.author_member_id)
      : null;

    return member ? getWorkspaceMemberDisplayName(member) : "Участник команды";
  }

  function getProjectActivityAuthorLabel(log: ActivityLog) {
    const member = log.actor_member_id
      ? workspaceMembersById.get(log.actor_member_id)
      : null;

    return member ? getWorkspaceMemberDisplayName(member) : "Участник команды";
  }

  const client = useMemo(() => {
    if (!project) return null;
    return clientsData.find((item) => item.id === project.client_id) ?? null;
  }, [clientsData, project]);

  const clientName = client?.name ?? "Без клиента";
  const clientId = client?.id ?? null;

  useEffect(() => {
    if (!project || isEditingOverview) {
      return;
    }

    setOverviewDraft(
      project.project_overview?.trim() || project.description?.trim() || ""
    );
  }, [project, isEditingOverview]);

  useEffect(() => {
    if (!project || isEditingLinks) {
      return;
    }

    setLinksDraft(project.important_links ?? "");
  }, [project, isEditingLinks]);

  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");

    if (!taskIdFromUrl) {
      setSelectedTaskId(null);
      return;
    }

    const taskExists = tasks.some((task) => task.id === taskIdFromUrl);

    if (taskExists) {
      setSelectedTaskId(taskIdFromUrl);
    } else {
      setSelectedTaskId(null);
    }
  }, [searchParams, tasks]);

  useEffect(() => {
  setMounted(true);
}, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const assignedEmployeeName = useMemo(() => {
    if (!project?.employee_id) return "Не назначен";

    const member = employees.find((item) => item.id === project.employee_id);
    return member?.name ?? "Не назначен";
  }, [employees, project?.employee_id]);

  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId) ?? null
    : null;

  const links = useMemo(
    () => normalizeLinks(project?.important_links ?? null),
    [project?.important_links]
  );

  function handleTaskCreated(task: Task) {
    syncTaskAcrossCaches(queryClient, task);
  }

  function handleTaskStatusChanged(taskId: string, status: TaskStatus) {
    queryClient.setQueryData<Task[]>(
      queryKeys.projectTasks(projectId),
      (prev = []) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status,
                updated_at: new Date().toISOString(),
              }
            : task
        )
    );

    queryClient.setQueryData<Task[]>(queryKeys.tasks, (prev = []) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              updated_at: new Date().toISOString(),
            }
          : task
      )
    );
  }

  function handleTaskUpdated(updatedTask: Task) {
    syncTaskAcrossCaches(queryClient, updatedTask);
  }

  function handleTaskOpen(taskId: string) {
    setSelectedTaskId(taskId);
    router.replace(`/projects/${projectId}?taskId=${taskId}`, { scroll: false });
  }

  function handleTaskClose() {
    setSelectedTaskId(null);
    router.replace(`/projects/${projectId}`, { scroll: false });
  }

  async function handleSaveOverview() {
    if (!project) return;

    if (!canManageProjectDetails) {
      window.alert("У тебя нет прав на редактирование этого проекта");
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        projectId: project.id,
        values: {
          name: project.name,
          client_id: project.client_id,
          employee_id: project.employee_id ?? null,
          status: project.status,
          start_date: project.start_date,
          revenue: project.revenue,
          profit: project.profit,
          description: project.description ?? "",
          project_overview: overviewDraft,
          important_links: project.important_links ?? "",
        },
      });

      setIsEditingOverview(false);
    } catch (error) {
      console.error(error);
      window.alert("Не удалось сохранить основную информацию");
    }
  }

  async function handleSaveLinks() {
    if (!project) return;

    if (!canManageProjectDetails) {
      window.alert("У тебя нет прав на редактирование этого проекта");
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        projectId: project.id,
        values: {
          name: project.name,
          client_id: project.client_id,
          employee_id: project.employee_id ?? null,
          status: project.status,
          start_date: project.start_date,
          revenue: project.revenue,
          profit: project.profit,
          description: project.description ?? "",
          project_overview: project.project_overview ?? "",
          important_links: linksDraft,
        },
      });

      setIsEditingLinks(false);
    } catch (error) {
      console.error(error);
      window.alert("Не удалось сохранить ссылки");
    }
  }

  async function handleSubmitProject(values: CreateProjectFormValues) {
    if (!project) return;

    if (!canManageProjectDetails) {
      throw new Error("У тебя нет прав на редактирование этого проекта");
    }

    try {
      await updateProjectMutation.mutateAsync({
        projectId: project.id,
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

      setIsEditProjectModalOpen(false);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async function handleSendProjectComment() {
    const text = projectCommentDraft.trim();

    if ((!text && !projectCommentAttachment) || !canUseProjectChat) {
      return;
    }

    try {
      await createProjectCommentMutation.mutateAsync({
        text,
        attachment: projectCommentAttachment,
      });
      setProjectCommentDraft("");
      setProjectCommentAttachment(null);
      if (projectCommentAttachmentInputRef.current) {
        projectCommentAttachmentInputRef.current.value = "";
      }
      setToastType("success");
      setToastMessage("Сообщение отправлено");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    }
  }

  const pageErrorMessage = useMemo(() => {
    if (project === null && !isLoading && !combinedError) {
      return "Проект не найден";
    }

    if (combinedError instanceof Error) {
      return combinedError.message;
    }

    if (combinedError) {
      return "Не удалось загрузить проект";
    }

    return "";
  }, [combinedError, isLoading, project]);

  return (
    <>
      <main className="flex-1 px-6 py-6 md:px-8">
        <div className="flex w-full flex-col gap-6">
          {isLoading ? (
            <section className="rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              <div className="overflow-x-auto">
                <div className="grid min-w-[1680px] grid-cols-7 gap-4">
                  {Array.from({ length: 7 }).map((_, dayIndex) => (
                    <div key={dayIndex} className="flex min-h-[720px] flex-col">
                      <div className="mb-3 px-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="mt-2 h-5 w-28" />
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-[#0F1724] p-3">
                        <Skeleton className="h-11 w-full" />

                        <div className="mt-3 space-y-3">
                          {Array.from({ length: 3 }).map((_, cardIndex) => (
                            <div
                              key={cardIndex}
                              className="rounded-[20px] border border-white/10 bg-[#121826] p-4"
                            >
                              <Skeleton className="h-3 w-12" />
                              <Skeleton className="mt-3 h-5 w-5/6" />
                              <Skeleton className="mt-3 h-4 w-1/2" />

                              <div className="mt-4 flex gap-2">
                                <Skeleton className="h-6 w-20 rounded-full" />
                                <Skeleton className="h-6 w-24 rounded-full" />
                              </div>

                              <Skeleton className="mt-4 h-2 w-full rounded-full" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : pageErrorMessage ? (
            <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              {pageErrorMessage}
            </div>
          ) : project ? (
            <>
              <section className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr_0.8fr]">
                  <div>
                    <div className="text-sm text-white/40">Паспорт проекта</div>

                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                      {project.name}
                    </h1>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/60">
                      <span>Клиент: {clientName}</span>
                      <span className="text-white/25">•</span>
                      <span>Дата старта: {formatDate(project.start_date)}</span>
                      <span className="text-white/25">•</span>
                      <span>Ответственный: {assignedEmployeeName}</span>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex rounded-full border px-4 py-2 text-sm font-medium ${getStatusClasses(
                          project.status
                        )}`}
                      >
                        {getStatusLabel(project.status)}
                      </span>

                      {clientId ? (
                        <Link
                          href="/clients"
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                        >
                          Открыть клиента
                        </Link>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setIsProjectChatOpen(true)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Чат проекта
                        {projectComments.length > 0 ? (
                          <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[11px] font-semibold text-[#07131F]">
                            {projectComments.length}
                          </span>
                        ) : null}
                      </button>

                      {canManageProjectDetails ? (
                        <button
                          type="button"
                          onClick={() => setIsEditProjectModalOpen(true)}
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                        >
                          Редактировать паспорт
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-[#0F1724] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-white/45">
                        Основная информация по проекту
                      </div>

                      {canManageProjectDetails ? (
                        <PencilButton
                          onClick={() => {
                            setOverviewDraft(
                              project.project_overview?.trim() ||
                                project.description?.trim() ||
                                ""
                            );
                            setIsEditingOverview(true);
                          }}
                          title="Редактировать информацию"
                        />
                      ) : null}
                    </div>

                    {isEditingOverview ? (
                      <div className="mt-4">
                        <textarea
                          value={overviewDraft}
                          onChange={(event) =>
                            setOverviewDraft(event.target.value)
                          }
                          rows={10}
                          placeholder="Добавь основную информацию по проекту"
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/30"
                        />

                        <div className="mt-4 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setOverviewDraft(
                                project.project_overview?.trim() ||
                                  project.description?.trim() ||
                                  ""
                              );
                              setIsEditingOverview(false);
                            }}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                          >
                            Отмена
                          </button>

                          <button
                            type="button"
                            onClick={handleSaveOverview}
                            disabled={updateProjectMutation.isPending}
                            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                          >
                            {updateProjectMutation.isPending
                              ? "Сохраняем..."
                              : "Сохранить"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                        <div className="max-h-[192px] overflow-y-auto whitespace-pre-line pr-2 text-sm leading-6 text-white/90 scrollbar-thin">
                          {project.project_overview?.trim() ||
                            project.description?.trim() ||
                            "Основная информация по проекту пока не заполнена."}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-[#0F1724] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-white/45">Важные ссылки</div>

                      {canManageProjectDetails ? (
                        <PencilButton
                          onClick={() => {
                            setLinksDraft(project.important_links ?? "");
                            setIsEditingLinks(true);
                          }}
                          title="Редактировать ссылки"
                        />
                      ) : null}
                    </div>

                    {isEditingLinks ? (
                      <div className="mt-4">
                        <textarea
                          value={linksDraft}
                          onChange={(event) => setLinksDraft(event.target.value)}
                          rows={10}
                          placeholder="Вставь ссылки через новую строку"
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/30"
                        />

                        <div className="mt-4 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setLinksDraft(project.important_links ?? "");
                              setIsEditingLinks(false);
                            }}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                          >
                            Отмена
                          </button>

                          <button
                            type="button"
                            onClick={handleSaveLinks}
                            disabled={updateProjectMutation.isPending}
                            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                          >
                            {updateProjectMutation.isPending
                              ? "Сохраняем..."
                              : "Сохранить"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        {links.length > 0 ? (
                          <div className="max-h-[204px] space-y-3 overflow-y-auto pr-2 scrollbar-thin">
                            {links.map((link) => (
                              <a
                                key={link.id}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/85 transition hover:bg-white/[0.06] hover:text-white"
                              >
                                {link.label}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-white/35">
                            Ссылки пока не добавлены
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                <div className="mb-6">
                  <div className="text-sm text-white/45">Задачи проекта</div>
                  <div className="mt-2 text-sm text-white/65">
                    Управляй задачами по проекту в формате kanban-доски.
                  </div>
                </div>

                <ProjectTasksBoard
                  projectId={project.id}
                  tasks={tasks}
                  onTaskCreated={handleTaskCreated}
                  onTaskStatusChanged={handleTaskStatusChanged}
                  onTaskOpen={handleTaskOpen}
                  onSubtaskToggle={handleTaskStatusChanged}
                />
              </section>

            </>
          ) : null}
        </div>
      </main>

      <AnimatePresence>
        {project && isProjectChatOpen ? (
          <motion.div
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsProjectChatOpen(false)}
          >
            <motion.aside
              className="absolute right-0 top-0 flex h-full w-full max-w-[540px] flex-col border-l border-white/10 bg-[#0F1724] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/10 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
                      Чат проекта
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {project.name}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      Командная переписка по проекту: решения, вопросы и
                      договорённости в одном месте.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsProjectChatOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                    aria-label="Закрыть чат проекта"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
                {isProjectCommentsLoading ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/45">
                    Загружаем чат...
                  </div>
                ) : projectComments.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-200">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-sm font-medium text-white">
                      Сообщений пока нет
                    </div>
                    <div className="mt-2 text-sm leading-6 text-white/45">
                      Начни обсуждение, чтобы команда видела решения и не
                      теряла важные договорённости.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectComments.map((comment) => {
                      const isOwnMessage =
                        Boolean(currentMemberId) &&
                        comment.author_member_id === currentMemberId;

                      return (
                        <div
                          key={comment.id}
                          className={`flex ${
                            isOwnMessage ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[86%] rounded-3xl border px-4 py-3 ${
                              isOwnMessage
                                ? "border-emerald-400/20 bg-emerald-400/10"
                                : "border-white/10 bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={
                                  isOwnMessage
                                    ? "font-medium text-emerald-200"
                                    : "font-medium text-white/75"
                                }
                              >
                                {isOwnMessage
                                  ? "Вы"
                                  : getProjectCommentAuthorLabel(comment)}
                              </span>
                              <span className="text-white/30">
                                {formatMessageDate(comment.created_at)}
                              </span>
                            </div>
                            <div className="mt-2 whitespace-pre-line text-sm leading-6 text-white/90">
                              {comment.text}
                            </div>
                            {comment.attachments.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {comment.attachments.map((attachment) => (
                                  <a
                                    key={attachment.id}
                                    href={attachment.signed_url ?? "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-left transition hover:bg-white/[0.04]"
                                  >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70">
                                      <FileText className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium text-white/85">
                                        {attachment.file_name}
                                      </span>
                                      <span className="text-xs text-white/35">
                                        {formatChatAttachmentSize(
                                          attachment.file_size
                                        ) || "Файл"}
                                      </span>
                                    </span>
                                  </a>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white/80">
                        История проекта
                      </div>
                      <div className="mt-1 text-xs text-white/35">
                        Важные изменения, сообщения и файлы по проекту.
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/45">
                      {projectActivityLogs.length}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {isProjectActivityLogsLoading ? (
                      <div className="text-sm text-white/35">
                        Загружаем историю...
                      </div>
                    ) : projectActivityLogs.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/35">
                        История пока пустая. Новые изменения появятся здесь.
                      </div>
                    ) : (
                      projectActivityLogs.slice(0, 8).map((log) => (
                        <div
                          key={log.id}
                          className="rounded-2xl border border-white/10 bg-[#0B1220] px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-medium text-white/85">
                              {log.title}
                            </div>
                            <div className="text-xs text-white/30">
                              {formatMessageDate(log.created_at)}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-white/40">
                            {getProjectActivityAuthorLabel(log)}
                          </div>
                          {log.description ? (
                            <div className="mt-2 text-sm leading-6 text-white/60">
                              {log.description}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 bg-[#0B1220]/95 px-6 py-5">
                {canUseProjectChat ? (
                  <>
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-2">
                      <textarea
                        value={projectCommentDraft}
                        onChange={(event) =>
                          setProjectCommentDraft(event.target.value)
                        }
                        rows={3}
                        placeholder="Напиши сообщение по проекту"
                        className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/30"
                      />
                      {projectCommentAttachment ? (
                        <div className="mx-2 mb-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                          <FileText className="h-4 w-4 shrink-0 text-white/45" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-white/80">
                              {projectCommentAttachment.name}
                            </div>
                            <div className="text-xs text-white/35">
                              {formatChatAttachmentSize(
                                projectCommentAttachment.size
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setProjectCommentAttachment(null);
                              if (projectCommentAttachmentInputRef.current) {
                                projectCommentAttachmentInputRef.current.value =
                                  "";
                              }
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/45 transition hover:bg-white/10 hover:text-white"
                            aria-label="Убрать файл"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <input
                          ref={projectCommentAttachmentInputRef}
                          type="file"
                          className="hidden"
                          onChange={(event) =>
                            setProjectCommentAttachment(
                              event.target.files?.[0] ?? null
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            projectCommentAttachmentInputRef.current?.click()
                          }
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
                        >
                          <Paperclip className="h-4 w-4" />
                          Файл
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleSendProjectComment}
                        disabled={
                          createProjectCommentMutation.isPending ||
                          (!projectCommentDraft.trim() &&
                            !projectCommentAttachment)
                        }
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
                        {createProjectCommentMutation.isPending
                          ? "Отправляем..."
                          : "Отправить"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45">
                    Сейчас чат доступен только участникам с правами работы по
                    проекту.
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {project && canManageProjectDetails ? (
        <CreateProjectModal
          isOpen={isEditProjectModalOpen}
          clients={clients}
          employees={employees}
          isSubmitting={updateProjectMutation.isPending}
          mode="edit"
          initialProject={project}
          onClose={() => {
            if (!updateProjectMutation.isPending) {
              setIsEditProjectModalOpen(false);
            }
          }}
          onSubmit={handleSubmitProject}
        />
      ) : null}

      {selectedTask ? (
        <TaskModal
          isOpen={true}
          projectId={projectId}
          task={selectedTask}
          tasks={tasks}
          onClose={handleTaskClose}
          onTaskUpdated={handleTaskUpdated}
          onTaskCreated={handleTaskCreated}
          onTaskOpen={handleTaskOpen}
        />
      ) : null}

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}
