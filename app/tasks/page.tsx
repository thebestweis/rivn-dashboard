"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { CustomSelect } from "../components/ui/custom-select";
import { AppToast } from "../components/ui/app-toast";
import { TaskModal } from "../components/tasks/task-modal";
import { canEditTasks, isAppRole, type AppRole } from "../lib/permissions";
import { useAppContextState } from "../providers/app-context-provider";
import { getBillingErrorMessage } from "../lib/billing-errors";
import { type Project } from "../lib/supabase/projects";
import { type Task, type TaskStatus } from "../lib/supabase/tasks";
import { BillingAccessBanner } from "../components/ui/billing-access-banner";
import { useProjectsQuery } from "../lib/queries/use-projects-query";
import {
  patchTaskStatusInCaches,
  syncTaskAcrossCaches,
  useCreateTaskMutation,
  useTasksQuery,
  useUpdateTaskDeadlineMutation,
  useUpdateTaskStatusMutation,
} from "../lib/queries/use-tasks-query";
import { useActiveWorkspaceMembers } from "../lib/queries/use-workspace-members-query";

import { queryKeys } from "../lib/query-keys";
import { getProjectById } from "../lib/supabase/projects";
import { getTasksByProject } from "../lib/supabase/tasks";

type DayColumn = {
  key: string;
  date: Date;
};

function getStatusLabel(status: TaskStatus) {
  switch (status) {
    case "todo":
      return "К работе";
    case "in_progress":
      return "В работе";
    case "done":
      return "Готово";
    default:
      return status;
  }
}

function getStatusClasses(status: TaskStatus) {
  switch (status) {
    case "todo":
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";
    case "in_progress":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "done":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function getNextStatusAfterQuickComplete(status: TaskStatus): TaskStatus {
  if (status === "done") {
    return "todo";
  }

  return "done";
}

function formatTaskTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "HH:mm");
}

function isTaskOverdue(task: Task) {
  if (!task.deadline_at || task.status === "done") {
    return false;
  }

  const deadline = new Date(task.deadline_at);

  if (Number.isNaN(deadline.getTime())) {
    return false;
  }

  return deadline.getTime() < Date.now();
}

function createDeadlineForDay(day: Date) {
  const next = new Date(day);
  next.setHours(12, 0, 0, 0);
  return next.toISOString();
}

export default function TasksPage() {
  const queryClient = useQueryClient();

  const {
    role,
    billingAccess,
    isLoading: isAppContextLoading,
  } = useAppContextState();

  const currentRole: AppRole | null = isAppRole(role) ? role : null;
  const canManageTasks = currentRole ? canEditTasks(currentRole) : false;
  const isBillingReadOnly = billingAccess?.isReadOnly ?? false;
  const canManageTasksWithBilling = canManageTasks && !isBillingReadOnly;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const [creatingDayKey, setCreatingDayKey] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskProjectId, setQuickTaskProjectId] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverDayKey, setDragOverDayKey] = useState<string | null>(null);

  useEffect(() => {
    if (canManageTasksWithBilling) return;

    setCreatingDayKey(null);
    setDraggedTaskId(null);
    setDragOverDayKey(null);
  }, [canManageTasksWithBilling]);

  const {
    data: tasks = [],
    isLoading: isTasksLoading,
    error: tasksError,
  } = useTasksQuery(!isAppContextLoading);

  const {
    data: projectsList = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useProjectsQuery(!isAppContextLoading);

  const {
    activeMembers: workspaceMembers,
    isLoading: isWorkspaceMembersLoading,
    error: workspaceMembersError,
  } = useActiveWorkspaceMembers(!isAppContextLoading);

  const createTaskMutation = useCreateTaskMutation();
  const updateTaskDeadlineMutation = useUpdateTaskDeadlineMutation();
  const updateTaskStatusMutation = useUpdateTaskStatusMutation();

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!quickTaskProjectId && projectsList.length > 0) {
      setQuickTaskProjectId(projectsList[0].id);
    }
  }, [projectsList, quickTaskProjectId]);

  const isLoading =
    isTasksLoading || isProjectsLoading || isWorkspaceMembersLoading;

  const combinedError = tasksError || projectsError || workspaceMembersError;

  const projectsById = useMemo(() => {
    return projectsList.reduce<Record<string, Project>>((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {});
  }, [projectsList]);

  const rootTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (task.parent_task_id !== null || task.is_archived) {
        return false;
      }

      const matchesSearch =
        searchQuery.trim().length === 0 ||
        task.title.toLowerCase().includes(searchQuery.trim().toLowerCase());

      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;

      const matchesProject =
        projectFilter === "all" || task.project_id === projectFilter;

      const matchesAssignee =
        assigneeFilter === "all"
          ? true
          : assigneeFilter === "unassigned"
            ? !task.assignees || task.assignees.length === 0
            : Boolean(
                task.assignees?.some(
                  (assignee) => assignee.workspace_member_id === assigneeFilter
                )
              );

      return matchesSearch && matchesStatus && matchesProject && matchesAssignee;
    });
  }, [tasks, searchQuery, statusFilter, projectFilter, assigneeFilter]);

  const subtasksByParentId = useMemo(() => {
    const map: Record<string, Task[]> = {};

    for (const task of tasks) {
      if (!task.parent_task_id || task.is_archived) continue;

      if (!map[task.parent_task_id]) {
        map[task.parent_task_id] = [];
      }

      map[task.parent_task_id].push(task);
    }

    return map;
  }, [tasks]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId || tasks.length === 0) {
      return null;
    }

    const foundTask = tasks.find((task) => task.id === selectedTaskId);

    return foundTask ?? null;
  }, [tasks, selectedTaskId]);

  const weekDays = useMemo<DayColumn[]>(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const date = addDays(weekStart, index);

      return {
        key: format(date, "yyyy-MM-dd"),
        date,
      };
    });
  }, [weekStart]);

  const today = new Date();

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};

    for (const day of weekDays) {
      map[day.key] = [];
    }

    for (const task of rootTasks) {
      if (!task.deadline_at) continue;

      const deadline = new Date(task.deadline_at);
      if (Number.isNaN(deadline.getTime())) continue;

      const matchedDay = weekDays.find((day) => isSameDay(day.date, deadline));

      if (matchedDay) {
        map[matchedDay.key].push(task);
      }
    }

    for (const day of weekDays) {
      map[day.key].sort((a, b) => {
        const aTime = a.deadline_at ? new Date(a.deadline_at).getTime() : 0;
        const bTime = b.deadline_at ? new Date(b.deadline_at).getTime() : 0;
        return aTime - bTime;
      });
    }

    return map;
  }, [rootTasks, weekDays]);

  function handleTaskOpen(taskId: string) {
    setSelectedTaskId(taskId);
  }

  function handleTaskClose() {
    setSelectedTaskId(null);
  }

  function handleTaskUpdated(updatedTask: Task) {
    syncTaskAcrossCaches(queryClient, updatedTask);
  }

  function handleTaskCreated(createdTask: Task) {
    syncTaskAcrossCaches(queryClient, createdTask);
  }

  function handleStartQuickCreate(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    setCreatingDayKey(key);
    setQuickTaskTitle("");

    if (!quickTaskProjectId && projectsList.length > 0) {
      setQuickTaskProjectId(projectsList[0].id);
    }
  }

  function handleCancelQuickCreate() {
    setCreatingDayKey(null);
    setQuickTaskTitle("");
  }

  async function handleCreateTaskForDay(day: Date) {
    if (!canManageTasks) {
      setToastType("error");
      setToastMessage("У тебя нет прав на создание задач");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    const trimmedTitle = quickTaskTitle.trim();

    if (!trimmedTitle) {
      setToastType("error");
      setToastMessage("Укажи название задачи");
      return;
    }

    if (!quickTaskProjectId) {
      setToastType("error");
      setToastMessage("Сначала выбери проект");
      return;
    }

    try {
      await createTaskMutation.mutateAsync({
        project_id: quickTaskProjectId,
        title: trimmedTitle,
        deadline_at: createDeadlineForDay(day),
      });

      setCreatingDayKey(null);
      setQuickTaskTitle("");

      setToastType("success");
      setToastMessage("Задача создана");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    }
  }

  async function handleQuickToggle(task: Task) {
    if (!canManageTasks) {
      setToastType("error");
      setToastMessage("У тебя нет прав на изменение задач");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    const nextStatus = getNextStatusAfterQuickComplete(task.status);

    try {
      setUpdatingTaskId(task.id);

      await updateTaskStatusMutation.mutateAsync({
        task,
        nextStatus,
      });
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleDropTaskToDay(taskId: string, day: Date) {
    if (!canManageTasks) {
      setToastType("error");
      setToastMessage("У тебя нет прав на изменение задач");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    const task = tasks.find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    const nextDeadline = new Date(day);

    if (task.deadline_at) {
      const currentDeadline = new Date(task.deadline_at);

      if (!Number.isNaN(currentDeadline.getTime())) {
        nextDeadline.setHours(
          currentDeadline.getHours(),
          currentDeadline.getMinutes(),
          0,
          0
        );
      } else {
        nextDeadline.setHours(12, 0, 0, 0);
      }
    } else {
      nextDeadline.setHours(12, 0, 0, 0);
    }

    try {
      setUpdatingTaskId(taskId);

      await updateTaskDeadlineMutation.mutateAsync({
        taskId,
        deadlineAt: nextDeadline.toISOString(),
      });
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setUpdatingTaskId(null);
      setDraggedTaskId(null);
      setDragOverDayKey(null);
    }
  }

  function getMemberLabel(memberId: string, fallbackEmail?: string | null) {
    const member = workspaceMembers.find((item) => item.id === memberId);

    if (member?.email) {
      return member.email;
    }

    if (fallbackEmail) {
      return fallbackEmail;
    }

    return "Неизвестный участник";
  }

  const weekLabel = `${format(weekDays[0].date, "d MMM", {
    locale: ru,
  })} — ${format(weekDays[6].date, "d MMM yyyy", {
    locale: ru,
  })}`;

  const projectOptions = [
    { value: "all", label: "Все проекты" },
    ...projectsList.map((project) => ({
      value: project.id,
      label: project.name,
    })),
  ];

  const quickProjectOptions = projectsList.map((project) => ({
  value: project.id,
  label: project.name,
}));

  const assigneeOptions = [
    { value: "all", label: "Все исполнители" },
    { value: "unassigned", label: "Без исполнителя" },
    ...workspaceMembers.map((member) => ({
      value: member.id,
      label: member.email || "Без email",
    })),
  ];

  const statusOptions = [
    { value: "all", label: "Все статусы" },
    { value: "todo", label: "К работе" },
    { value: "in_progress", label: "В работе" },
    { value: "done", label: "Готово" },
  ];

  const pageErrorMessage = useMemo(() => {
    if (combinedError instanceof Error) {
      return combinedError.message;
    }

    if (combinedError) {
      return "Не удалось загрузить задачи";
    }

    return "";
  }, [combinedError]);

  function prefetchProjectData(projectId: string) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => getProjectById(projectId),
    staleTime: 1000 * 60,
  });

  void queryClient.prefetchQuery({
    queryKey: queryKeys.projectTasks(projectId),
    queryFn: () => getTasksByProject(projectId),
    staleTime: 1000 * 60,
  });
}

  return (
    <>
      <main className="flex-1 px-6 py-6 md:px-8">
        <div className="flex w-full flex-col gap-6">
          <BillingAccessBanner
            isLoading={isAppContextLoading}
            isBillingReadOnly={isBillingReadOnly}
            canManage={canManageTasks}
            readOnlyMessage="Подписка неактивна. Раздел задач работает только в режиме просмотра, пока тариф не будет активирован."
            roleRestrictedMessage="У тебя доступ только на просмотр задач. Создание, перенос и изменение статуса недоступны."
          />

          <section className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white">
                    Все задачи
                  </h1>
                  <p className="mt-2 text-sm text-white/60">
                    Недельный календарь задач по всем проектам
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setWeekStart((prev) => addDays(prev, -7))}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                  >
                    Назад
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
                    }
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                  >
                    Сегодня
                  </button>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
                    {weekLabel}
                  </div>

                  <button
                    type="button"
                    onClick={() => setWeekStart((prev) => addDays(prev, 7))}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                  >
                    Вперёд
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-1 flex-col gap-3 xl:flex-row xl:items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Поиск по названию задачи"
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-white/30 xl:w-[360px]"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <CustomSelect
                      value={projectFilter}
                      onChange={setProjectFilter}
                      options={projectOptions}
                    />

                    <CustomSelect
                      value={assigneeFilter}
                      onChange={setAssigneeFilter}
                      options={assigneeOptions}
                    />

                    <CustomSelect
                      value={statusFilter}
                      onChange={(value) =>
                        setStatusFilter(value as "all" | TaskStatus)
                      }
                      options={statusOptions}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setProjectFilter("all");
                        setStatusFilter("all");
                        setAssigneeFilter("all");
                      }}
                      className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                    >
                      Сбросить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {isLoading ? (
            <section className="rounded-[28px] border border-white/10 bg-[#121826] p-6 text-sm text-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              Загрузка задач...
            </section>
          ) : pageErrorMessage ? (
            <section className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              {pageErrorMessage}
            </section>
          ) : (
            <section className="rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              <div className="overflow-x-auto">
                <div className="grid min-w-[1680px] grid-cols-7 gap-4">
                  {weekDays.map((day) => {
                    const dayKey = day.key;
                    const dayTasks = tasksByDay[dayKey] ?? [];
                    const isCreatingHere = creatingDayKey === dayKey;

                    return (
                      <div
                        key={dayKey}
                        className="flex min-h-[720px] flex-col"
                        onDragOver={(event) => {
                          if (!canManageTasksWithBilling) return;
                          event.preventDefault();
                          setDragOverDayKey(dayKey);
                        }}
                        onDragLeave={() => {
                          setDragOverDayKey((prev) =>
                            prev === dayKey ? null : prev
                          );
                        }}
                        onDrop={(event) => {
                          if (!canManageTasksWithBilling) return;

                          event.preventDefault();
                          const taskId =
                            event.dataTransfer.getData("text/plain") ||
                            draggedTaskId;

                          if (!taskId) {
                            return;
                          }

                          handleDropTaskToDay(taskId, day.date);
                        }}
                      >
                        <div className="mb-3 px-1">
                          <div
                            className={`text-sm font-medium ${
                              isSameDay(day.date, today)
                                ? "text-sky-300"
                                : "text-white/45"
                            }`}
                          >
                            {format(day.date, "EEEE", { locale: ru })}
                          </div>
                          <div
                            className={`mt-1 text-base font-semibold ${
                              isSameDay(day.date, today)
                                ? "text-sky-300"
                                : "text-white"
                            }`}
                          >
                            {format(day.date, "d MMMM", { locale: ru })}
                          </div>
                        </div>

                        <div
                          className={`rounded-[24px] border p-3 transition ${
                            dragOverDayKey === dayKey && canManageTasksWithBilling
                              ? "border-sky-400/40 bg-sky-400/[0.06]"
                              : isSameDay(day.date, today)
                                ? "border-sky-400/20 bg-sky-400/[0.03]"
                                : "border-white/10 bg-[#0F1724]"
                          }`}
                        >
                          {canManageTasksWithBilling ? (
                            isCreatingHere ? (
                              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                                <input
                                  type="text"
                                  value={quickTaskTitle}
                                  onChange={(event) =>
                                    setQuickTaskTitle(event.target.value)
                                  }
                                  placeholder="Название задачи"
                                  className="h-10 w-full rounded-xl bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/30"
                                />

                                <CustomSelect
  value={quickTaskProjectId}
  onChange={setQuickTaskProjectId}
  options={quickProjectOptions}
  placeholder={
    projectsList.length === 0 ? "Нет проектов" : "Выбери проект"
  }
  disabled={projectsList.length === 0 || createTaskMutation.isPending}
  className="mt-2"
  buttonClassName="h-10 rounded-xl px-3 text-sm"
  dropdownClassName="w-full"
/>

                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCancelQuickCreate}
                                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                                  >
                                    Отмена
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCreateTaskForDay(day.date)}
                                    disabled={createTaskMutation.isPending}
                                    className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                                  >
                                    {createTaskMutation.isPending
                                      ? "Создаём..."
                                      : "Создать"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartQuickCreate(day.date)}
                                className="flex h-11 w-full items-center rounded-[18px] border border-white/10 bg-white/[0.03] px-4 text-left text-sm text-white/45 transition hover:bg-white/[0.05] hover:text-white/80"
                              >
                                Добавить задачу
                              </button>
                            )
                          ) : null}

                          <div className="mt-3 space-y-3">
                            {dayTasks.map((task) => {
                              const subtasks = subtasksByParentId[task.id] ?? [];
                              const doneSubtasks = subtasks.filter(
                                (subtask) => subtask.status === "done"
                              ).length;
                              const progress =
                                subtasks.length > 0
                                  ? Math.round(
                                      (doneSubtasks / subtasks.length) * 100
                                    )
                                  : 0;

                              const isOverdue = isTaskOverdue(task);

                              return (
                                <article
                                  key={task.id}
                                  role="button"
                                  tabIndex={0}
                                  draggable={canManageTasksWithBilling}
                                  onDragStart={(event) => {
                                    if (!canManageTasksWithBilling) {
                                      event.preventDefault();
                                      return;
                                    }

                                    setDraggedTaskId(task.id);
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData(
                                      "text/plain",
                                      task.id
                                    );
                                  }}
                                  onDragEnd={() => {
                                    setDraggedTaskId(null);
                                    setDragOverDayKey(null);
                                  }}
                                  onClick={() => handleTaskOpen(task.id)}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      handleTaskOpen(task.id);
                                    }
                                  }}
                                  className={`cursor-pointer rounded-[20px] border p-4 transition hover:border-white/20 hover:bg-[#111C2B] ${
                                    isOverdue
                                      ? "border-red-500/25 bg-red-500/[0.04]"
                                      : "border-white/10 bg-[#121826]"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-[11px] text-white/35">
                                        {formatTaskTime(task.deadline_at)}
                                      </div>

                                      <div className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-white">
                                        {task.title}
                                      </div>

                                      <Link
  href={`/projects/${task.project_id}`}
  onMouseEnter={() => prefetchProjectData(task.project_id)}
  onFocus={() => prefetchProjectData(task.project_id)}
  onClick={(event) => event.stopPropagation()}
  className="mt-2 inline-block text-xs text-white/50 transition hover:text-white"
>
  {projectsById[task.project_id]?.name ?? "Без проекта"}
</Link>
                                    </div>

                                    {canManageTasksWithBilling ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleQuickToggle(task);
                                        }}
                                        disabled={updatingTaskId === task.id}
                                        className={`mt-1 h-5 w-5 shrink-0 rounded-full border transition ${
                                          task.status === "done"
                                            ? "border-emerald-400 bg-emerald-400"
                                            : "border-white/30 bg-transparent hover:border-white/60"
                                        }`}
                                      />
                                    ) : null}
                                  </div>

                                  <div className="mt-4 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusClasses(
                                            task.status
                                          )}`}
                                        >
                                          {getStatusLabel(task.status)}
                                        </span>

                                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/55">
                                          {task.assignees?.length
                                            ? `Исполнителей: ${task.assignees.length}`
                                            : "Без исполнителя"}
                                        </span>
                                      </div>

                                      {subtasks.length > 0 ? (
                                        <span className="text-[11px] text-white/45">
                                          {doneSubtasks}/{subtasks.length}
                                        </span>
                                      ) : null}
                                    </div>

                                    {task.assignees && task.assignees.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {task.assignees.slice(0, 2).map((assignee) => (
                                          <span
                                            key={assignee.id}
                                            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/50"
                                          >
                                            {getMemberLabel(
                                              assignee.workspace_member_id,
                                              assignee.workspace_member?.email
                                            )}
                                          </span>
                                        ))}

                                        {task.assignees.length > 2 ? (
                                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/40">
                                            +{task.assignees.length - 2}
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>

                                  {subtasks.length > 0 ? (
                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                                      <div
                                        className="h-full rounded-full bg-emerald-400 transition-all"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })}

                            {dayTasks.length === 0 && !isCreatingHere ? (
                              <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-white/30">
                                На этот день задач нет
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {selectedTask ? (
        <TaskModal
          isOpen={true}
          projectId={selectedTask.project_id}
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