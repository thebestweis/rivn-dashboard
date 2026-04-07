"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { AppSidebar } from "../components/layout/app-sidebar";
import { CustomSelect } from "../components/ui/custom-select";
import { TaskModal } from "../components/tasks/task-modal";
import { getProjects, type Project } from "../lib/supabase/projects";
import {
  createTask,
  getAllTasks,
  updateTaskDeadline,
  updateTaskStatus,
  type Task,
  type TaskStatus,
} from "../lib/supabase/tasks";

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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectsById, setProjectsById] = useState<Record<string, Project>>({});
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
const [projectFilter, setProjectFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const [creatingDayKey, setCreatingDayKey] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskProjectId, setQuickTaskProjectId] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
const [dragOverDayKey, setDragOverDayKey] = useState<string | null>(null);

useEffect(() => {
  setSelectedTaskId(null);
}, []);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const [allTasks, projectsData] = await Promise.all([
          getAllTasks(),
          getProjects(),
        ]);

        if (!isMounted) return;

        const nextProjectsById = projectsData.reduce<Record<string, Project>>(
          (acc, project) => {
            acc[project.id] = project;
            return acc;
          },
          {}
        );

        setTasks(allTasks);
        setProjectsById(nextProjectsById);
        setProjectsList(projectsData);

        if (projectsData.length > 0) {
          setQuickTaskProjectId(projectsData[0].id);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить задачи";

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

    return matchesSearch && matchesStatus && matchesProject;
  });
}, [tasks, searchQuery, statusFilter, projectFilter]);

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
  if (!selectedTaskId) {
    return null;
  }

  return tasks.find((task) => task.id === selectedTaskId) ?? null;
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
    setTasks((prev) =>
      prev.map((task) => (task.id === updatedTask.id ? updatedTask : task))
    );
  }

  function handleTaskCreated(createdTask: Task) {
    setTasks((prev) => [createdTask, ...prev]);
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
    const trimmedTitle = quickTaskTitle.trim();

    if (!trimmedTitle) {
      window.alert("Укажи название задачи");
      return;
    }

    if (!quickTaskProjectId) {
      window.alert("Сначала выбери проект");
      return;
    }

    try {
      setIsCreatingTask(true);

      const createdTask = await createTask({
        project_id: quickTaskProjectId,
        title: trimmedTitle,
        deadline_at: createDeadlineForDay(day),
      });

      handleTaskCreated(createdTask);
      setCreatingDayKey(null);
      setQuickTaskTitle("");
    } catch (error) {
      console.error(error);
      window.alert("Не удалось создать задачу");
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function handleQuickToggle(task: Task) {
    const nextStatus = getNextStatusAfterQuickComplete(task.status);

    try {
      setUpdatingTaskId(task.id);
      await updateTaskStatus(task.id, nextStatus);

      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: nextStatus,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );
    } catch (error) {
      console.error(error);
      window.alert("Не удалось обновить статус задачи");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleDropTaskToDay(taskId: string, day: Date) {
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

    const updatedTask = await updateTaskDeadline(taskId, nextDeadline.toISOString());

    setTasks((prev) =>
      prev.map((item) => (item.id === updatedTask.id ? updatedTask : item))
    );
  } catch (error) {
  console.error(error);

  const message =
    error instanceof Error
      ? error.message
      : "Не удалось перенести задачу на другой день";

  window.alert(message);
} finally {
    setUpdatingTaskId(null);
    setDraggedTaskId(null);
    setDragOverDayKey(null);
  }
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

const statusOptions = [
  { value: "all", label: "Все статусы" },
  { value: "todo", label: "К работе" },
  { value: "in_progress", label: "В работе" },
  { value: "done", label: "Готово" },
];

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-6 py-6 md:px-8">
            <div className="flex w-full flex-col gap-6">
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
        onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
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
        className="h-11 w-full xl:w-[360px] rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-white/30"
      />

      <div className="flex flex-wrap items-center gap-3">
        <CustomSelect
          value={projectFilter}
          onChange={setProjectFilter}
          options={projectOptions}
        />

        <CustomSelect
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as "all" | TaskStatus)}
          options={statusOptions}
        />

        <button
          type="button"
          onClick={() => {
            setSearchQuery("");
            setProjectFilter("all");
            setStatusFilter("all");
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
              ) : errorMessage ? (
                <section className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                  {errorMessage}
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
    event.preventDefault();
    setDragOverDayKey(dayKey);
  }}
  onDragLeave={() => {
    setDragOverDayKey((prev) => (prev === dayKey ? null : prev));
  }}
  onDrop={(event) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;

    if (!taskId) {
      return;
    }

    handleDropTaskToDay(taskId, day.date);
  }}
>
                            <div className="mb-3 px-1">
  <div
    className={`text-sm font-medium ${
      isSameDay(day.date, today) ? "text-sky-300" : "text-white/45"
    }`}
  >
    {format(day.date, "EEEE", { locale: ru })}
  </div>
  <div
    className={`mt-1 text-base font-semibold ${
      isSameDay(day.date, today) ? "text-sky-300" : "text-white"
    }`}
  >
    {format(day.date, "d MMMM", { locale: ru })}
  </div>
</div>

                            <div
  className={`rounded-[24px] border p-3 transition ${
    dragOverDayKey === dayKey
      ? "border-sky-400/40 bg-sky-400/[0.06]"
      : isSameDay(day.date, today)
      ? "border-sky-400/20 bg-sky-400/[0.03]"
      : "border-white/10 bg-[#0F1724]"
  }`}
>
                              {isCreatingHere ? (
                                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                                  <input
                                    type="text"
                                    value={quickTaskTitle}
                                    onChange={(event) => setQuickTaskTitle(event.target.value)}
                                    placeholder="Название задачи"
                                    className="h-10 w-full rounded-xl bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/30"
                                  />

                                  <select
                                    value={quickTaskProjectId}
                                    onChange={(event) =>
                                      setQuickTaskProjectId(event.target.value)
                                    }
                                    className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none"
                                  >
                                    {projectsList.length === 0 ? (
                                      <option value="">Нет проектов</option>
                                    ) : (
                                      projectsList.map((project) => (
                                        <option key={project.id} value={project.id}>
                                          {project.name}
                                        </option>
                                      ))
                                    )}
                                  </select>

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
                                      disabled={isCreatingTask}
                                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                                    >
                                      {isCreatingTask ? "Создаём..." : "Создать"}
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
                              )}

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
  draggable
  onDragStart={(event) => {
    setDraggedTaskId(task.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  }}
  onDragEnd={() => {
    setDraggedTaskId(null);
    setDragOverDayKey(null);
  }}
  onClick={() => handleTaskOpen(task.id)}
  onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
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
                                            onClick={(event) => event.stopPropagation()}
                                            className="mt-2 inline-block text-xs text-white/50 transition hover:text-white"
                                          >
                                            {projectsById[task.project_id]?.name ?? "Без проекта"}
                                          </Link>
                                        </div>

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
                                      </div>

                                      <div className="mt-4 flex items-center justify-between gap-3">
                                        <span
                                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusClasses(
                                            task.status
                                          )}`}
                                        >
                                          {getStatusLabel(task.status)}
                                        </span>

                                        {subtasks.length > 0 ? (
                                          <span className="text-[11px] text-white/45">
                                            {doneSubtasks}/{subtasks.length}
                                          </span>
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
        </div>
      </div>

      <TaskModal
  isOpen={Boolean(selectedTask)}
  projectId={selectedTask?.project_id ?? ""}
  task={selectedTask}
  tasks={tasks}
  onClose={handleTaskClose}
  onTaskUpdated={handleTaskUpdated}
  onTaskCreated={handleTaskCreated}
  onTaskOpen={handleTaskOpen}
/>
    </div>
  );
}