import { CustomSelect } from "../ui/custom-select";

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

        <CustomSelect
          value={statusFilter}
          onChange={(value) => onStatusChange(value as StatusFilter)}
          options={[
            { value: "all", label: "Все статусы" },
            { value: "active", label: "Активный" },
            { value: "paused", label: "На паузе" },
            { value: "completed", label: "Завершён" },
          ]}
          className="md:w-[220px]"
          buttonClassName="bg-[#0F1724] dark:bg-[#0F1724]"
        />
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
