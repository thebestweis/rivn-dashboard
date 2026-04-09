"use client";

import { useMemo, useState } from "react";
import {
  createTask,
  updateTaskStatus,
  type Task,
  type TaskStatus,
} from "../../lib/supabase/tasks";

type ProjectTasksBoardProps = {
  projectId: string;
  tasks: Task[];
  onTaskCreated: (task: Task) => void;
  onTaskStatusChanged: (taskId: string, status: TaskStatus) => void;
  onTaskOpen: (taskId: string) => void;
  onSubtaskToggle?: (taskId: string, status: TaskStatus) => void;
};

type ColumnConfig = {
  key: TaskStatus;
  title: string;
};

const columns: ColumnConfig[] = [
  { key: "todo", title: "К работе" },
  { key: "in_progress", title: "В работе" },
  { key: "done", title: "Готово" },
];

function formatDeadline(value: string | null) {
  if (!value) {
    return { label: "Без дедлайна", isOverdue: false };
  }

  const date = new Date(value);
  const now = new Date();

  if (Number.isNaN(date.getTime())) {
    return { label: "Без дедлайна", isOverdue: false };
  }

  const isOverdue = date.getTime() < now.getTime();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (isOverdue) {
    return {
      label: "Просрочено",
      isOverdue: true,
    };
  }

  if (diffDays === 0) {
    return {
      label: "Сегодня",
      isOverdue: false,
    };
  }

  if (diffDays === 1) {
    return {
      label: "Завтра",
      isOverdue: false,
    };
  }

  return {
    label: new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }).format(date),
    isOverdue: false,
  };
}

function getNextStatusAfterQuickComplete(status: TaskStatus): TaskStatus {
  if (status === "done") {
    return "todo";
  }

  return "done";
}

export function ProjectTasksBoard({
  projectId,
  tasks,
  onTaskCreated,
  onTaskStatusChanged,
  onTaskOpen,
  onSubtaskToggle,
}: ProjectTasksBoardProps) {
  const [draftByColumn, setDraftByColumn] = useState<Record<TaskStatus, string>>({
    todo: "",
    in_progress: "",
    done: "",
  });

  const [creatingColumn, setCreatingColumn] = useState<TaskStatus | null>(null);
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Record<string, boolean>>(
    {}
  );
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const rootTasks = useMemo(
    () => tasks.filter((task) => task.parent_task_id === null && !task.is_archived),
    [tasks]
  );

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

  const tasksByStatus = useMemo(() => {
    return {
      todo: rootTasks.filter((task) => task.status === "todo"),
      in_progress: rootTasks.filter((task) => task.status === "in_progress"),
      done: rootTasks.filter((task) => task.status === "done"),
    };
  }, [rootTasks]);

  function setTaskUpdating(taskId: string, value: boolean) {
    setUpdatingTaskIds((prev) => {
      if (value) {
        return { ...prev, [taskId]: true };
      }

      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  function isTaskUpdating(taskId: string) {
    return Boolean(updatingTaskIds[taskId]);
  }

  async function handleCreateTask(status: TaskStatus) {
    const title = draftByColumn[status].trim();

    if (!title) {
      return;
    }

    if (creatingColumn === status) {
      return;
    }

    try {
      setCreatingColumn(status);

      const createdTask = await createTask({
        project_id: projectId,
        title,
      });

      await updateTaskStatus(createdTask.id, status);

      onTaskCreated({
        ...createdTask,
        status,
      });

      setDraftByColumn((prev) => ({
        ...prev,
        [status]: "",
      }));
    } catch (error) {
      console.error(error);
      window.alert("Не удалось создать задачу");
    } finally {
      setCreatingColumn(null);
    }
  }

  async function handleQuickToggle(task: Task) {
    const nextStatus = getNextStatusAfterQuickComplete(task.status);

    if (isTaskUpdating(task.id)) {
      return;
    }

    try {
      setTaskUpdating(task.id, true);
      await updateTaskStatus(task.id, nextStatus);
      onTaskStatusChanged(task.id, nextStatus);
    } catch (error) {
      console.error(error);
      window.alert("Не удалось обновить статус задачи");
    } finally {
      setTaskUpdating(task.id, false);
    }
  }

  async function handleDropTaskToColumn(taskId: string, nextStatus: TaskStatus) {
    const task = tasks.find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    if (isTaskUpdating(taskId)) {
      return;
    }

    if (task.status === nextStatus) {
      setDraggedTaskId(null);
      setDragOverColumn(null);
      return;
    }

    try {
      setTaskUpdating(taskId, true);
      await updateTaskStatus(taskId, nextStatus);
      onTaskStatusChanged(taskId, nextStatus);
    } catch (error) {
      console.error(error);
      window.alert("Не удалось перенести задачу в другую колонку");
    } finally {
      setTaskUpdating(taskId, false);
      setDraggedTaskId(null);
      setDragOverColumn(null);
    }
  }

  async function handleToggleSubtask(subtask: Task) {
    const nextStatus: TaskStatus = subtask.status === "done" ? "todo" : "done";

    if (isTaskUpdating(subtask.id)) {
      return;
    }

    try {
      setTaskUpdating(subtask.id, true);
      await updateTaskStatus(subtask.id, nextStatus);

      if (onSubtaskToggle) {
        onSubtaskToggle(subtask.id, nextStatus);
      } else {
        onTaskStatusChanged(subtask.id, nextStatus);
      }
    } catch (error) {
      console.error(error);
      window.alert("Не удалось обновить подзадачу");
    } finally {
      setTaskUpdating(subtask.id, false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {columns.map((column) => {
        const columnTasks = tasksByStatus[column.key];

        return (
          <section
            key={column.key}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverColumn(column.key);
            }}
            onDragLeave={() => {
              setDragOverColumn((prev) => (prev === column.key ? null : prev));
            }}
            onDrop={(event) => {
              event.preventDefault();

              const taskId =
                event.dataTransfer.getData("text/plain") || draggedTaskId;

              if (!taskId) {
                return;
              }

              handleDropTaskToColumn(taskId, column.key);
            }}
            className={`rounded-[24px] border p-4 transition ${
              dragOverColumn === column.key
                ? "border-sky-400/40 bg-sky-400/[0.06]"
                : "border-white/10 bg-[#0F1724]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">{column.title}</div>
              <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/50">
                {columnTasks.length}
              </div>
            </div>

            <div className="mt-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                <input
                  type="text"
                  value={draftByColumn[column.key]}
                  disabled={creatingColumn === column.key}
                  onChange={(event) =>
                    setDraftByColumn((prev) => ({
                      ...prev,
                      [column.key]: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && creatingColumn !== column.key) {
                      event.preventDefault();
                      handleCreateTask(column.key);
                    }
                  }}
                  placeholder={
                    creatingColumn === column.key
                      ? "Создаём задачу..."
                      : "Добавить задачу"
                  }
                  className="h-10 w-full rounded-xl bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {columnTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-white/35">
                  Пока нет задач
                </div>
              ) : null}

              {columnTasks.map((task) => {
                const subtasks = subtasksByParentId[task.id] ?? [];
                const deadline = formatDeadline(task.deadline_at);
                const doneSubtasks = subtasks.filter(
                  (subtask) => subtask.status === "done"
                ).length;
                const progress =
                  subtasks.length > 0
                    ? Math.round((doneSubtasks / subtasks.length) * 100)
                    : 0;

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
                      setDragOverColumn(null);
                    }}
                    onClick={() => {
                      if (isTaskUpdating(task.id)) return;
                      onTaskOpen(task.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (isTaskUpdating(task.id)) return;
                        onTaskOpen(task.id);
                      }
                    }}
                    className={`cursor-pointer rounded-[18px] border px-4 py-3 transition hover:border-white/25 hover:bg-[#131c2a] ${
                      draggedTaskId === task.id || isTaskUpdating(task.id)
                        ? "opacity-60"
                        : ""
                    } ${
                      deadline.isOverdue
                        ? "border-red-500/20 bg-red-500/[0.03]"
                        : "border-white/10 bg-[#121826]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleQuickToggle(task);
                        }}
                        onMouseDown={(event) => {
                          event.stopPropagation();
                        }}
                        disabled={isTaskUpdating(task.id)}
                        className={`mt-1 h-5 w-5 shrink-0 rounded-full border transition ${
                          task.status === "done"
                            ? "border-emerald-400 bg-emerald-400"
                            : "border-white/30 bg-transparent hover:border-white/60"
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={`line-clamp-3 text-sm font-semibold leading-6 ${
                              task.status === "done"
                                ? "text-white/45 line-through"
                                : "text-white"
                            }`}
                          >
                            {task.title}
                          </div>

                          <div className="shrink-0">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                deadline.isOverdue
                                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                                  : "border-white/10 bg-white/5 text-white/55"
                              }`}
                            >
                              {deadline.label}
                            </span>
                          </div>
                        </div>

                        {subtasks.length > 0 ? (
                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-3 text-[11px] text-white/45">
                              <span className="font-medium">Подзадачи</span>
                              <span>
                                {doneSubtasks}/{subtasks.length}
                              </span>
                            </div>

                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-emerald-400 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>

                            <div className="mt-3 space-y-1.5">
                              {subtasks.slice(0, 4).map((subtask) => (
                                <div
                                  key={subtask.id}
                                  className="flex items-start gap-2 text-xs text-white/70"
                                >
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleToggleSubtask(subtask);
                                    }}
                                    disabled={isTaskUpdating(subtask.id)}
                                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border transition ${
                                      subtask.status === "done"
                                        ? "border-emerald-400 bg-emerald-400"
                                        : "border-white/25 bg-transparent hover:border-white/50"
                                    }`}
                                  />

                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (isTaskUpdating(subtask.id)) return;
                                      onTaskOpen(subtask.id);
                                    }}
                                    className={`text-left leading-5 transition hover:text-white ${
                                      subtask.status === "done"
                                        ? "line-through opacity-60"
                                        : ""
                                    }`}
                                  >
                                    {subtask.title}
                                  </button>
                                </div>
                              ))}

                              {subtasks.length > 4 ? (
                                <div className="pt-1 text-[11px] text-white/35">
                                  Ещё подзадач: {subtasks.length - 4}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex items-center justify-between">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                task.status === "todo"
                                  ? "border-sky-400/20 bg-sky-400/10 text-sky-300"
                                  : task.status === "in_progress"
                                    ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                                    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                              }`}
                            >
                              {task.status === "todo"
                                ? "К работе"
                                : task.status === "in_progress"
                                  ? "В работе"
                                  : "Готово"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {creatingColumn === column.key ? (
              <div className="mt-3 text-xs text-white/35">Сохранение...</div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}