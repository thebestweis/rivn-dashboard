"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { CustomSelect } from "../ui/custom-select";

type StatusFilter = "all" | "active" | "paused" | "completed";

type ProjectsFiltersProps = {
  searchQuery: string;
  statusFilter: StatusFilter;
  isLoading: boolean;
  resultsCount: number;
  activeProjectsCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onReset: () => void;
};

function formatProjectsCount(count: number) {
  const abs = Math.abs(count);
  const lastTwo = abs % 100;
  const last = abs % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return `${count} проектов`;
  }

  if (last === 1) {
    return `${count} проект`;
  }

  if (last >= 2 && last <= 4) {
    return `${count} проекта`;
  }

  return `${count} проектов`;
}

export function ProjectsFilters({
  searchQuery,
  statusFilter,
  isLoading,
  resultsCount,
  activeProjectsCount,
  hasActiveFilters,
  onSearchChange,
  onStatusChange,
  onReset,
}: ProjectsFiltersProps) {
  const [isActiveCountVisible, setIsActiveCountVisible] = useState(false);
  const displayedCount = isActiveCountVisible ? activeProjectsCount : resultsCount;

  return (
    <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
      <div className="contents">
        <label className="rivn-field flex h-11 items-center gap-3 lg:w-[300px] xl:w-[340px]">
          <Search className="h-4 w-4 shrink-0 text-white/35" />
          <input
            type="text"
            placeholder="Поиск по проекту или клиенту"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </label>

        <CustomSelect
          value={statusFilter}
          onChange={(value) => onStatusChange(value as StatusFilter)}
          options={[
            { value: "all", label: "Все статусы" },
            { value: "active", label: "Активный" },
            { value: "paused", label: "На паузе" },
            { value: "completed", label: "Завершён" },
          ]}
          className="w-full lg:w-[190px]"
          buttonClassName="h-11 bg-white/[0.045] dark:bg-white/[0.045]"
        />

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="rivn-button h-11 px-4 text-sm font-semibold"
          >
            Сбросить
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsActiveCountVisible((value) => !value)}
            className="rivn-pill hidden h-11 min-w-[132px] items-center justify-center px-4 text-sm transition hover:border-[#00f5a8]/30 hover:text-white xl:inline-flex"
            title={
              isActiveCountVisible
                ? "Показать все проекты"
                : "Показать активные проекты"
            }
          >
            {isLoading ? "Загружаем..." : formatProjectsCount(displayedCount)}
          </button>
        )}
      </div>
    </div>
  );
}
