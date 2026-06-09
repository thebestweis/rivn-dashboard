"use client";

import Link from "next/link";
import { memo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import { getProjectById } from "../../lib/supabase/projects";
import { getTasksByProject } from "../../lib/supabase/tasks";
import { useConfirmDialog } from "../ui/confirm-dialog-provider";

export type ProjectCardStatus = "active" | "paused" | "completed";

type ProjectCardProps = {
  id: string;
  name: string;
  clientName: string;
  status: ProjectCardStatus;
  startDate: string | null;
  activeTasksCount: number;
  onDelete?: (projectId: string) => void;
  onEdit?: (projectId: string) => void;
  isDeleting?: boolean;
  canManageProject?: boolean;
};

function getStatusLabel(status: ProjectCardStatus) {
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

function getStatusClasses(status: ProjectCardStatus) {
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

function formatProjectDate(value: string | null) {
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

function ProjectCardComponent({
  id,
  name,
  clientName,
  status,
  startDate,
  activeTasksCount,
  onDelete,
  onEdit,
  isDeleting = false,
  canManageProject = false,
}: ProjectCardProps) {
  const { confirm } = useConfirmDialog();
  const queryClient = useQueryClient();
  const hasPrefetchedRef = useRef(false);

  function handlePrefetch() {
    if (hasPrefetchedRef.current) {
      return;
    }

    hasPrefetchedRef.current = true;

    void queryClient.prefetchQuery({
      queryKey: queryKeys.project(id),
      queryFn: () => getProjectById(id),
      staleTime: 1000 * 60,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.projectTasks(id),
      queryFn: () => getTasksByProject(id),
      staleTime: 1000 * 60,
    });
  }

  return (
    <Link
      href={`/projects/${id}`}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      draggable={false}
      className="group flex h-full min-h-[280px] flex-col rounded-[28px] border border-white/12 bg-[linear-gradient(145deg,rgba(20,43,58,0.9),rgba(18,24,43,0.86))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-[#00f5a8]/28 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_28px_80px_rgba(0,245,168,0.08),0_22px_70px_rgba(0,0,0,0.34)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
            Проект
          </div>

          <div className="mt-2 line-clamp-2 text-lg font-semibold text-white transition group-hover:text-white/95">
            {name}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusClasses(
            status
          )}`}
        >
          {getStatusLabel(status)}
        </span>
      </div>

      <div className="mt-4 grid gap-2.5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.065] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/35">Клиент</div>
          <div className="mt-1 truncate text-sm text-white/90">{clientName}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.065] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/35">Старт</div>
          <div className="mt-1 text-sm text-white/90">
            {formatProjectDate(startDate)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.065] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/35">Активные задачи</div>
          <div className="mt-1 text-lg font-semibold tracking-[-0.04em] text-[#43ffc2]">
            {activeTasksCount}
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-white/5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-white/35">Открыть проект</span>

          <span className="text-sm text-white/45 transition group-hover:translate-x-0.5 group-hover:text-white/80">
            →
          </span>
        </div>

        {canManageProject ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onEdit(id);
                }}
                className="rivn-button px-3 py-1.5 text-xs font-medium"
              >
                Редактировать
              </button>
            ) : null}

            {onDelete ? (
              <button
                type="button"
                onClick={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  const isConfirmed = await confirm({
                    title: "Удалить проект?",
                    description: `Проект "${name}" будет удалён. Это действие нельзя отменить.`,
                    confirmLabel: "Удалить",
                    tone: "danger",
                  });

                  if (!isConfirmed || isDeleting) {
                    return;
                  }

                  onDelete(id);
                }}
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDeleting}
              >
                {isDeleting ? "Удаляем..." : "Удалить"}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 text-xs text-white/30">Только просмотр</div>
        )}
      </div>
    </Link>
  );
}

export const ProjectCard = memo(ProjectCardComponent);
