"use client";

import { type ReactNode, useMemo, useState } from "react";
import { formatDisplayDate } from "../../lib/storage";

interface PayrollExtraRow {
  id: string;
  employee: string;
  reason: string;
  date: string;
  amount: string;
}

interface PayrollExtraTableProps {
  items: PayrollExtraRow[];
  onEdit?: (item: PayrollExtraRow) => void;
  onDelete?: (id: string) => void;
  canManagePayroll?: boolean;
}

type SortKey = "employee" | "reason" | "date" | "amount";

function parseAmount(value: string) {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}

export function PayrollExtraTable({
  items,
  onEdit,
  onDelete,
  canManagePayroll = false,
}: PayrollExtraTableProps) {
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
      <div className="text-sm text-white/50">Внеплановые выплаты</div>

      <div className="mt-5 overflow-x-auto rounded-[24px] border border-white/8">
        <table className="w-full min-w-[720px] text-center text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium"><SortHeader sort="employee">Сотрудник</SortHeader></th>
              <th className="px-4 py-3 font-medium"><SortHeader sort="reason">Причина</SortHeader></th>
              <th className="px-4 py-3 font-medium"><SortHeader sort="date">Дата</SortHeader></th>
              <th className="px-4 py-3 font-medium"><SortHeader sort="amount">Сумма</SortHeader></th>
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
                <td className="px-4 py-3 text-white/75">{item.reason}</td>
                <td className="px-4 py-3 text-white/75">{formatDisplayDate(item.date)}</td>
                <td className="px-4 py-3 font-medium text-amber-300">{item.amount}</td>
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
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-white/45">
                  Внеплановых выплат пока нет.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
