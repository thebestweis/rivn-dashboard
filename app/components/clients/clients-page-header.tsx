"use client";

import { Search, UserPlus } from "lucide-react";
import { CustomSelect } from "../ui/custom-select";

interface ClientsPageHeaderProps {
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  onAddClient: () => void;
  canAddClient?: boolean;
}

const statusOptions = [
  { value: "all", label: "Все статусы" },
  { value: "active", label: "Активный" },
  { value: "paused", label: "На паузе" },
  { value: "problem", label: "Проблемный" },
  { value: "completed", label: "Завершён" },
];

export function ClientsPageHeader({
  search,
  setSearch,
  status,
  setStatus,
  onAddClient,
  canAddClient = false,
}: ClientsPageHeaderProps) {
  return (
    <div className="rivn-card rivn-card-interactive p-4 sm:p-5">
      <div className="grid gap-3 xl:grid-cols-[minmax(180px,0.75fr)_minmax(260px,1.15fr)_220px_auto] xl:items-end">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.22em] text-[#43ffc2]">CRM</div>
          <h1 className="mt-1 text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">
            Клиенты
          </h1>
        </div>

        <label className="rivn-field flex h-12 items-center gap-3">
          <Search className="h-4 w-4 shrink-0 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по клиентам"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </label>

        <CustomSelect
          value={status}
          onChange={setStatus}
          options={statusOptions}
          className="w-full"
          buttonClassName="h-12 bg-white/[0.045] dark:bg-white/[0.045]"
        />

        {canAddClient ? (
          <button
            type="button"
            onClick={onAddClient}
            className="rivn-button rivn-button-primary w-full px-4 py-3 text-sm font-semibold sm:w-auto"
          >
            <UserPlus className="h-4 w-4" />
            Добавить клиента
          </button>
        ) : (
          <div className="rivn-pill px-4 py-3 text-sm text-white/55">
            Режим просмотра
          </div>
        )}
      </div>
    </div>
  );
}
