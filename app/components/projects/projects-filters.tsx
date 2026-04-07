type StatusFilter = "all" | "active" | "paused" | "completed";

type ProjectsFiltersProps = {
  searchQuery: string;
  statusFilter: StatusFilter;
  isLoading: boolean;
  resultsCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onReset: () => void;
};

export function ProjectsFilters({
  searchQuery,
  statusFilter,
  isLoading,
  resultsCount,
  hasActiveFilters,
  onSearchChange,
  onStatusChange,
  onReset,
}: ProjectsFiltersProps) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-4 md:flex-row">
        <input
          type="text"
          placeholder="Поиск по проекту или клиенту"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-11 flex-1 rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/35"
        />

        <select
          className="h-11 rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none md:w-[220px]"
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
        >
          <option value="all">Все статусы</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-white/45">
          {isLoading ? "Загружаем проекты..." : `Найдено проектов: ${resultsCount}`}
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="text-sm font-medium text-white/65 transition hover:text-white"
          >
            Сбросить фильтры
          </button>
        ) : null}
      </div>
    </section>
  );
}