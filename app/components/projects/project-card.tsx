import Link from "next/link";

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

export function ProjectCard({
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
  return (
    <Link
      href={`/projects/${id}`}
      className="group rounded-[24px] border border-white/10 bg-[#0F1724] p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#111C2B]"
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

      <div className="mt-4 space-y-3">
        <div>
          <div className="text-xs text-white/40">Клиент</div>
          <div className="mt-1 truncate text-sm text-white/90">{clientName}</div>
        </div>

        <div>
          <div className="text-xs text-white/40">Дата начала работ</div>
          <div className="mt-1 text-sm text-white/90">
            {formatProjectDate(startDate)}
          </div>
        </div>

        <div>
          <div className="text-xs text-white/40">Активные задачи</div>
          <div className="mt-1 text-sm text-white/90">{activeTasksCount}</div>
        </div>
      </div>

      <div className="mt-4 border-t border-white/5 pt-4">
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
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
              >
                Редактировать
              </button>
            ) : null}

            {onDelete ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  const isConfirmed = window.confirm(
                    `Удалить проект "${name}"?`
                  );

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