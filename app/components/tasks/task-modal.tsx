"use client";

import "react-day-picker/dist/style.css";

import { ru } from "date-fns/locale";
import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DayPicker } from "react-day-picker";
import { AppToast } from "../ui/app-toast";
import {
  createSubtask,
  updateTask,
  updateTaskStatus,
  type Task,
  type TaskStatus,
} from "../../lib/supabase/tasks";
import {
  createTaskComment,
  getTaskComments,
  type TaskComment,
} from "../../lib/supabase/task-comments";
import {
  type WorkspaceMemberItem,
} from "../../lib/supabase/workspace-members";
import { canEditTasks, isAppRole, type AppRole } from "../../lib/permissions";
import { useAppContextState } from "../../providers/app-context-provider";
import { getBillingErrorMessage } from "../../lib/billing-errors";
import { BillingAccessBanner } from "../ui/billing-access-banner";
import { useActiveWorkspaceMembers } from "../../lib/queries/use-workspace-members-query";
import {
  patchTaskStatusInCaches,
  syncTaskAcrossCaches,
} from "../../lib/queries/use-tasks-query";

type TaskModalProps = {
  isOpen: boolean;
  projectId: string;
  task: Task | null;
  tasks: Task[];
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
  onTaskCreated: (task: Task) => void;
  onTaskOpen: (taskId: string) => void;
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

function getStatusButtonClasses(status: TaskStatus, current: TaskStatus) {
  const isActive = status === current;

  if (!isActive) {
    return "border-white/10 bg-white/5 text-white/65 hover:bg-white/10";
  }

  if (status === "done") {
    return "border-emerald-400/30 bg-emerald-400/15 text-emerald-300";
  }

  if (status === "in_progress") {
    return "border-amber-400/30 bg-amber-400/15 text-amber-300";
  }

  return "border-sky-400/30 bg-sky-400/15 text-sky-300";
}

function getNextSubtaskStatus(status: TaskStatus): TaskStatus {
  return status === "done" ? "todo" : "done";
}

function formatCommentDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseDeadlineToParts(value: string | null) {
  if (!value) {
    return {
      date: undefined as Date | undefined,
      time: "",
    };
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return {
      date: undefined as Date | undefined,
      time: "",
    };
  }

  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return {
    date: parsed,
    time: `${hours}:${minutes}`,
  };
}

function combineDateAndTime(date: Date | undefined, time: string) {
  if (!date) {
    return null;
  }

  const next = new Date(date);

  if (time) {
    const [hours, minutes] = time.split(":").map(Number);
    next.setHours(Number.isFinite(hours) ? hours : 0);
    next.setMinutes(Number.isFinite(minutes) ? minutes : 0);
    next.setSeconds(0);
    next.setMilliseconds(0);
  } else {
    next.setHours(12);
    next.setMinutes(0);
    next.setSeconds(0);
    next.setMilliseconds(0);
  }

  return next.toISOString();
}

function getMemberLabel(member: WorkspaceMemberItem) {
  return member.email || "Без email";
}

export function TaskModal({
  isOpen,
  projectId,
  task,
  tasks,
  onClose,
  onTaskUpdated,
  onTaskCreated,
  onTaskOpen,
}: TaskModalProps) {
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(undefined);
  const [deadlineTime, setDeadlineTime] = useState("");
  const [isDeadlinePickerOpen, setIsDeadlinePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);

  const [isAssigneesDropdownOpen, setIsAssigneesDropdownOpen] = useState(false);
  const assigneesDropdownRef = useRef<HTMLDivElement | null>(null);

  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false);
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<string | null>(null);

  const [commentDraft, setCommentDraft] = useState("");
  const [isCreatingComment, setIsCreatingComment] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const commentsQueryKey = useMemo(
    () => ["task-comments", task?.id ?? "unknown"],
    [task?.id]
  );

  const {
    activeMembers: activeWorkspaceMembers,
    isLoading: isLoadingMembers,
  } = useActiveWorkspaceMembers(isOpen && !isAppContextLoading);

  const {
    data: comments = [],
    isLoading: isLoadingComments,
  } = useQuery({
    queryKey: commentsQueryKey,
    queryFn: () => getTaskComments(task!.id),
    enabled: isOpen && Boolean(task?.id),
    staleTime: 1000 * 30,
  });

  const createCommentMutation = useMutation({
    mutationFn: (text: string) => createTaskComment(task!.id, text),
    onSuccess: (createdComment) => {
      queryClient.setQueryData<TaskComment[]>(commentsQueryKey, (prev = []) => [
        ...prev,
        createdComment,
      ]);
    },
  });

  const subtasks = useMemo(() => {
    if (!task) return [];
    return tasks.filter(
      (item) => item.parent_task_id === task.id && !item.is_archived
    );
  }, [task, tasks]);

  const doneSubtasksCount = useMemo(
    () => subtasks.filter((subtask) => subtask.status === "done").length,
    [subtasks]
  );

  const selectedAssigneeLabels = useMemo(() => {
    if (selectedAssigneeIds.length === 0) {
      return [];
    }

    const membersMap = new Map(
      activeWorkspaceMembers.map((member) => [member.id, member])
    );

    return selectedAssigneeIds
      .map((id) => membersMap.get(id))
      .filter((member): member is WorkspaceMemberItem => Boolean(member))
      .map(getMemberLabel);
  }, [activeWorkspaceMembers, selectedAssigneeIds]);

  const assigneesFieldLabel = useMemo(() => {
    if (isLoadingMembers) {
      return "Загружаем участников...";
    }

    if (selectedAssigneeLabels.length === 0) {
      return "Выбрать исполнителей";
    }

    if (selectedAssigneeLabels.length === 1) {
      return selectedAssigneeLabels[0];
    }

    if (selectedAssigneeLabels.length === 2) {
      return `${selectedAssigneeLabels[0]}, ${selectedAssigneeLabels[1]}`;
    }

    return `${selectedAssigneeLabels[0]}, ${selectedAssigneeLabels[1]} + ещё ${
      selectedAssigneeLabels.length - 2
    }`;
  }, [isLoadingMembers, selectedAssigneeLabels]);

  const deadlineLabel = useMemo(() => {
    if (!deadlineDate) {
      return "Выбрать дедлайн";
    }

    const dateLabel = format(deadlineDate, "dd MMMM yyyy", { locale: ru });

    if (!deadlineTime) {
      return dateLabel;
    }

    return `${dateLabel}, ${deadlineTime}`;
  }, [deadlineDate, deadlineTime]);

  useEffect(() => {
    if (!isOpen || !task) {
      return;
    }

    const parsedDeadline = parseDeadlineToParts(task.deadline_at);

    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setDeadlineDate(parsedDeadline.date);
    setDeadlineTime(parsedDeadline.time);
    setSelectedAssigneeIds(
      (task.assignees ?? []).map((assignee) => assignee.workspace_member_id)
    );
    setSubtaskDraft("");
    setCommentDraft("");
    setIsDeadlinePickerOpen(false);
    setIsAssigneesDropdownOpen(false);
  }, [isOpen, task]);

  useEffect(() => {
    if (canManageTasksWithBilling) return;

    setIsDeadlinePickerOpen(false);
    setIsAssigneesDropdownOpen(false);
  }, [canManageTasksWithBilling]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!assigneesDropdownRef.current) return;

      if (!assigneesDropdownRef.current.contains(event.target as Node)) {
        setIsAssigneesDropdownOpen(false);
      }
    }

    if (isAssigneesDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAssigneesDropdownOpen]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  function handleToggleAssignee(memberId: string) {
    if (!canManageTasksWithBilling) {
      return;
    }

    setSelectedAssigneeIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  async function handleSave() {
    if (!task) {
      return;
    }

    if (!canManageTasks) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование задач");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setToastType("error");
      setToastMessage("Укажи название задачи");
      return;
    }

    try {
      setIsSaving(true);

      const updatedTask = await updateTask(task.id, {
        title: trimmedTitle,
        description: description.trim() || null,
        status,
        deadline_at: combineDateAndTime(deadlineDate, deadlineTime),
        assignee_ids: selectedAssigneeIds,
      });

      onTaskUpdated(updatedTask);
      setToastType("success");
      setToastMessage("Задача сохранена");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateSubtask() {
    if (!task) {
      return;
    }

    if (!canManageTasks) {
      setToastType("error");
      setToastMessage("У тебя нет прав на создание подзадач");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    const nextTitle = subtaskDraft.trim();

    if (!nextTitle) {
      return;
    }

    try {
      setIsCreatingSubtask(true);

      const createdSubtask = await createSubtask(task.id, projectId, nextTitle);
      onTaskCreated(createdSubtask);
      setSubtaskDraft("");
      setToastType("success");
      setToastMessage("Подзадача создана");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setIsCreatingSubtask(false);
    }
  }

  async function handleToggleSubtask(subtask: Task) {
    if (!canManageTasks) {
      setToastType("error");
      setToastMessage("У тебя нет прав на изменение подзадач");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    const nextStatus = getNextSubtaskStatus(subtask.status);

    try {
      setUpdatingSubtaskId(subtask.id);

      await updateTaskStatus(subtask.id, nextStatus);

      const updatedSubtask = {
        ...subtask,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      patchTaskStatusInCaches(queryClient, subtask, nextStatus);
      onTaskUpdated(updatedSubtask);
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setUpdatingSubtaskId(null);
    }
  }

  async function handleCreateComment() {
    if (!task) {
      return;
    }

    if (!canManageTasks) {
      setToastType("error");
      setToastMessage("У тебя нет прав на добавление комментариев");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    const nextText = commentDraft.trim();

    if (!nextText) {
      return;
    }

    try {
      setIsCreatingComment(true);

      await createCommentMutation.mutateAsync(nextText);
      setCommentDraft("");
      setToastType("success");
      setToastMessage("Комментарий добавлен");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setIsCreatingComment(false);
    }
  }

  if (!isOpen || !task) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/55">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute left-1/2 top-6 flex h-[calc(100vh-48px)] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#121826] shadow-[0_24px_100px_rgba(0,0,0,0.55)]">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white/40">Задача</div>

              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                readOnly={!canManageTasksWithBilling}
                className="mt-2 w-full bg-transparent text-3xl font-semibold tracking-tight text-white outline-none placeholder:text-white/20 read-only:cursor-default"
                placeholder="Название задачи"
              />

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {(["todo", "in_progress", "done"] as TaskStatus[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      if (!canManageTasksWithBilling) return;
                      setStatus(item);
                    }}
                    disabled={!canManageTasksWithBilling}
                    className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${getStatusButtonClasses(
                      item,
                      status
                    )} ${
                      !canManageTasksWithBilling ? "cursor-default opacity-80" : ""
                    }`}
                  >
                    {getStatusLabel(item)}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <BillingAccessBanner
              isLoading={isAppContextLoading}
              isBillingReadOnly={isBillingReadOnly}
              canManage={canManageTasks}
              readOnlyMessage="Подписка неактивна. Задача доступна только для просмотра, пока тариф не будет активирован."
              roleRestrictedMessage="У тебя доступ только на просмотр задачи. Редактирование, подзадачи и комментарии недоступны."
            />

            <section className="rounded-[24px] border border-white/10 bg-[#0F1724] p-5">
              <div className="text-sm text-white/45">Исполнители</div>

              <div className="mt-4 relative" ref={assigneesDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (!canManageTasksWithBilling || activeWorkspaceMembers.length === 0) {
                      return;
                    }

                    setIsAssigneesDropdownOpen((prev) => !prev);
                  }}
                  disabled={
                    !canManageTasksWithBilling ||
                    isLoadingMembers ||
                    activeWorkspaceMembers.length === 0
                  }
                  className="flex h-12 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-left text-sm text-white transition hover:bg-white/[0.06] disabled:cursor-default disabled:opacity-70"
                >
                  <span
                    className={
                      selectedAssigneeIds.length > 0 ? "text-white" : "text-white/35"
                    }
                  >
                    {activeWorkspaceMembers.length === 0 && !isLoadingMembers
                      ? "Нет доступных исполнителей"
                      : assigneesFieldLabel}
                  </span>

                  <span className="ml-3 text-white/35">
                    {isAssigneesDropdownOpen ? "−" : "+"}
                  </span>
                </button>

                {isAssigneesDropdownOpen ? (
                  <div className="absolute left-0 right-0 top-[56px] z-30 max-h-[280px] overflow-y-auto rounded-[24px] border border-white/10 bg-[#121826] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                    {activeWorkspaceMembers.map((member) => {
                      const isSelected = selectedAssigneeIds.includes(member.id);

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleToggleAssignee(member.id)}
                          className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                            isSelected
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "text-white/75 hover:bg-white/[0.05] hover:text-white"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {getMemberLabel(member)}
                            </div>
                            <div className="mt-1 text-xs text-white/40">
                              {member.role}
                            </div>
                          </div>

                          <div
                            className={`ml-3 h-4 w-4 shrink-0 rounded-full border ${
                              isSelected
                                ? "border-emerald-400 bg-emerald-400"
                                : "border-white/25"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 text-xs leading-5 text-white/35">
                Можно выбрать одного или нескольких исполнителей.
              </div>

              {selectedAssigneeLabels.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedAssigneeLabels.map((label) => (
                    <div
                      key={label}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-white/30">
                  Исполнители пока не назначены
                </div>
              )}
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[#0F1724] p-5">
              <div className="text-sm text-white/45">Дедлайн</div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!canManageTasksWithBilling) return;
                    setIsDeadlinePickerOpen((prev) => !prev);
                  }}
                  disabled={!canManageTasksWithBilling}
                  className="flex h-11 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-left text-sm text-white transition hover:bg-white/[0.06] disabled:cursor-default disabled:opacity-80"
                >
                  <span className={deadlineDate ? "text-white" : "text-white/35"}>
                    {deadlineLabel}
                  </span>
                  <span className="text-white/35">
                    {canManageTasksWithBilling ? "Открыть" : "Просмотр"}
                  </span>
                </button>
              </div>

              {isDeadlinePickerOpen ? (
                <div className="mt-4 rounded-[24px] border border-white/10 bg-[#121826] p-4">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1420] p-3">
                    <DayPicker
                      mode="single"
                      selected={deadlineDate}
                      onSelect={setDeadlineDate}
                      locale={ru}
                      showOutsideDays
                      className="text-white"
                      classNames={{
                        months: "flex flex-col",
                        month: "space-y-4",
                        caption: "flex items-center justify-between px-1 py-1",
                        caption_label: "text-sm font-medium text-white",
                        nav: "flex items-center gap-2",
                        nav_button:
                          "flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10",
                        table: "w-full border-separate border-spacing-1",
                        head_row: "",
                        head_cell:
                          "h-9 w-10 text-center align-middle text-[11px] font-medium text-white/35",
                        row: "",
                        cell: "h-10 w-10 text-center align-middle",
                        day: "h-10 w-10 rounded-xl text-sm text-white transition hover:bg-white/10",
                        day_selected: "bg-white text-black hover:bg-white/90",
                        day_today: "border border-white/20 bg-white/[0.05]",
                        day_outside: "text-white/20",
                      }}
                    />
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-white/40">Время</div>
                    <input
                      type="time"
                      value={deadlineTime}
                      onChange={(event) => setDeadlineTime(event.target.value)}
                      className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setDeadlineDate(undefined);
                        setDeadlineTime("");
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      Сбросить
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsDeadlinePickerOpen(false)}
                      className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                    >
                      Готово
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 text-xs leading-5 text-white/35">
                Дата и время создания задачи фиксируются автоматически.
              </div>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[#0F1724] p-5">
              <div className="text-sm text-white/45">Описание</div>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                readOnly={!canManageTasksWithBilling}
                placeholder="Опиши задачу, контекст, критерии готовности и важные детали"
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/30 read-only:cursor-default"
              />
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[#0F1724] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-white/45">Подзадачи</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
                  {doneSubtasksCount}/{subtasks.length}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{
                    width:
                      subtasks.length > 0
                        ? `${(doneSubtasksCount / subtasks.length) * 100}%`
                        : "0%",
                  }}
                />
              </div>

              <div className="mt-4 space-y-2">
                {subtasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/35">
                    Подзадач пока нет
                  </div>
                ) : (
                  subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3"
                    >
                      {canManageTasksWithBilling ? (
                        <button
                          type="button"
                          onClick={() => handleToggleSubtask(subtask)}
                          disabled={updatingSubtaskId === subtask.id}
                          className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border transition ${
                            subtask.status === "done"
                              ? "border-emerald-400 bg-emerald-400"
                              : "border-white/30 bg-transparent hover:border-white/60"
                          }`}
                        />
                      ) : (
                        <div
                          className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border ${
                            subtask.status === "done"
                              ? "border-emerald-400 bg-emerald-400"
                              : "border-white/30 bg-transparent"
                          }`}
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => onTaskOpen(subtask.id)}
                        className={`min-w-0 flex-1 text-left text-sm leading-6 text-white transition hover:text-white/80 ${
                          subtask.status === "done" ? "line-through opacity-55" : ""
                        }`}
                      >
                        {subtask.title}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {canManageTasksWithBilling ? (
                <>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                    <input
                      type="text"
                      value={subtaskDraft}
                      onChange={(event) => setSubtaskDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleCreateSubtask();
                        }
                      }}
                      placeholder="Новая подзадача"
                      className="h-10 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/30"
                    />
                  </div>

                  {isCreatingSubtask ? (
                    <div className="mt-2 text-xs text-white/35">
                      Создаём подзадачу...
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[#0F1724] p-5">
              <div className="text-sm text-white/45">Комментарии</div>

              <div className="mt-4 space-y-3">
                {isLoadingComments ? (
                  <div className="text-sm text-white/35">
                    Загрузка комментариев...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/35">
                    Комментариев пока нет
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <div className="text-sm leading-6 text-white/90">
                        {comment.text}
                      </div>
                      <div className="mt-2 text-xs text-white/35">
                        {formatCommentDate(comment.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {canManageTasksWithBilling ? (
                <>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                    <textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      rows={3}
                      placeholder="Напиши комментарий по задаче"
                      className="w-full bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/30"
                    />
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateComment}
                      disabled={isCreatingComment}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {isCreatingComment ? "Отправляем..." : "Добавить комментарий"}
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          </div>
        </div>

        <div className="border-t border-white/10 px-6 py-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              Закрыть
            </button>

            {canManageTasksWithBilling ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !title.trim()}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </div>
  );
}