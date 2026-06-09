"use client";

import { type ReactNode, useEffect, useState } from "react";

interface PayrollPageHeaderProps {
  activeTab: "accruals" | "payouts" | "extra";
  setActiveTab: (value: "accruals" | "payouts" | "extra") => void;
  onAddPayout: () => void;
  onAccrueSalaries: () => void;
  search: string;
  setSearch: (value: string) => void;
  searchPlaceholder?: string;
  employeeFilterControl?: ReactNode;
  canManagePayroll?: boolean;
}

const tabs = [
  { value: "accruals", label: "Начисления" },
  { value: "payouts", label: "Выплаты" },
  { value: "extra", label: "Внеплановые" },
] as const;

const placeholders = {
  accruals: "Поиск по пользователю, клиенту, проекту...",
  payouts: "Поиск по пользователю...",
  extra: "Поиск по пользователю, причине...",
} as const;

export function PayrollPageHeader({
  activeTab,
  setActiveTab,
  onAddPayout,
  onAccrueSalaries,
  search,
  setSearch,
  employeeFilterControl,
  canManagePayroll = false,
}: PayrollPageHeaderProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const resolvedCanManagePayroll = isMounted ? canManagePayroll : false;

  return (
    <div className="rivn-panel p-4 sm:p-5">
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="min-w-[220px]">
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Зарплаты
          </h1>
        </div>

        <div className="flex flex-col items-stretch gap-3 xl:flex-row xl:items-center 2xl:min-w-[1040px]">
          <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:w-auto">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`h-11 rounded-xl px-3 text-xs font-medium transition sm:min-w-[118px] sm:text-sm ${
                  activeTab === tab.value
                    ? "bg-[#00f5a8] text-[#06101d] shadow-[0_14px_34px_rgba(0,245,168,0.24)]"
                    : "text-white/58 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={placeholders[activeTab]}
            className="rivn-field xl:min-w-[320px] xl:flex-1"
          />

          {employeeFilterControl ? (
            <div className="xl:w-[220px]">{employeeFilterControl}</div>
          ) : null}

          <button
            type="button"
            onClick={onAccrueSalaries}
            disabled={!resolvedCanManagePayroll}
            className={`h-11 rounded-2xl border px-4 text-sm font-medium transition ${
              resolvedCanManagePayroll
                ? "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.07] hover:text-white"
                : "cursor-not-allowed border-white/10 bg-white/[0.04] text-white/35"
            }`}
          >
            Начислить оклады
          </button>

          <button
            type="button"
            onClick={onAddPayout}
            disabled={!resolvedCanManagePayroll}
            className={`h-11 rounded-2xl px-4 text-sm font-semibold transition ${
              resolvedCanManagePayroll
                ? "bg-[#00f5a8] text-[#06101d] shadow-[0_16px_38px_rgba(0,245,168,0.24)] hover:translate-y-[-1px] hover:shadow-[0_18px_44px_rgba(0,245,168,0.32)]"
                : "cursor-not-allowed border border-white/10 bg-white/[0.04] text-white/35"
            }`}
          >
            Добавить выплату
          </button>
        </div>
      </div>
    </div>
  );
}
