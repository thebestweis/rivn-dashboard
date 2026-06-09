"use client";

import { type ReactNode, useMemo, useState } from "react";
import { formatDisplayDate } from "../../lib/storage";

interface PayrollAccrualRow {
  id: string;
  employee: string;
  client: string;
  project: string;
  amount: string;
  date: string;
  status: "accrued" | "paid";
}

interface PayrollAccrualsTableProps {
  items: PayrollAccrualRow[];
  onEdit?: (item: PayrollAccrualRow) => void;
  onDelete?: (id: string) => void;
  onPay?: (id: string) => void;
  canManagePayroll?: boolean;
}

const accrualStatusLabels: Record<PayrollAccrualRow["status"], string> = {
  accrued: "Начислено",
  paid: "Выплачено",
};

type SortKey = "employee" | "client" | "project" | "date" | "amount" | "status";

function parseAmount(value: string) {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}

export function PayrollAccrualsTable({
  items,
  onEdit,
  onDelete,
  onPay,
  canManagePayroll = false,
}: PayrollAccrualsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aValue = sortKey === "amount" ? parseAmount(a.amount) : String(a[sortKey] ?? "");
      const bValue = sortKey === "amount" ? parseAmount(b.amount) : String(b[sortKey] ?? "");
      const result =
        typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue), "ru");

      return sortDirection === "asc" ? result : -result;
    });
  }, [items, sortDirection, sortKey]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function SortHeader({ sort, children }: { sort: SortKey; children: ReactNode }) {
    const isActive = sortKey === sort;

    return (
      <button
        type="button"
        onClick={() => handleSort(sort)}
        className="inline-flex items-center justify-center gap-1 transition hover:text-white"
      >
        <span>{children}</span>
        <span className={isActive ? "text-[#00f5a8]" : "text-white/25"}>
          {isActive ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    );
  }

  return (
    <div className="rivn-card p-4 sm:p-5">
      <div className="text-sm text-white/50">Начисления</div>

      <div className="mt-5 overflow-x-auto rounded-[24px] border border-white/8">
        <table className="w-full min-w-[920px] text-center text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium"><SortHeader sort="employee">Сотрудник</SortHeader></th>
              <th className="px-4 py-3 font-medium"><SortHeader sort="client">Клиент</SortHeader></th>
              <th className="px-4 py-3 font-medium"><SortHeader sort="project">Проект</SortHeader></th>
              <th className="px-4 py-3 font-medium"><SortHeader sort="date">Дата</SortHeader></th>
              <th className="px-4 py-3 font-medium"><SortHeader sort="amount">Сумма</SortHeader></th>
              <th className="px-4 py-3 font-medium"><SortHeader sort="status">Статус</SortHeader></th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>

          <tbody>
            {sortedItems.map((item) => (
              <tr
                key={item.id}
                className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-medium">{item.employee}</td>
                <td className="px-4 py-3 text-white/75">{item.client}</td>
                <td className="px-4 py-3 text-white/75">{item.project}</td>
                <td className="px-4 py-3 text-white/75">{formatDisplayDate(item.date)}</td>
                <td className="px-4 py-3 font-medium text-violet-300">{item.amount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      item.status === "accrued"
                        ? "bg-violet-500/15 text-violet-300"
                        : "bg-emerald-500/15 text-emerald-300"
                    }`}
                  >
                    {accrualStatusLabels[item.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {canManagePayroll ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit?.(item)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition hover:text-white"
                      >
                        Редактировать
                      </button>

                      {item.status === "accrued" ? (
                        <button
                          type="button"
                          onClick={() => onPay?.(item.id)}
                          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 transition hover:bg-emerald-500/15"
                        >
                          Выплатить
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => onDelete?.(item.id)}
                        className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 transition hover:bg-rose-500/15"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-white/30">Только просмотр</span>
                  )}
                </td>
              </tr>
            ))}

            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-white/45">
                  Начислений пока нет.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
