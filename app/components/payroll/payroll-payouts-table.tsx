"use client";

import { type ReactNode, useMemo, useState } from "react";
import { formatDisplayDate } from "../../lib/storage";

interface PayrollPayoutRow {
  id: string;
  employee: string;
  payoutDate: string;
  amount: string;
  month: string;
  status: "scheduled" | "paid";
}

interface PayrollPayoutsTableProps {
  items: PayrollPayoutRow[];
  onEdit?: (item: PayrollPayoutRow) => void;
  onDelete?: (id: string) => void;
  canManagePayroll?: boolean;
}

const payoutStatusLabels: Record<PayrollPayoutRow["status"], string> = {
  scheduled: "Запланировано",
  paid: "Выплачено",
};

type SortKey = "employee" | "month" | "payoutDate" | "amount" | "status";

function parseAmount(value: string) {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}

function StableSortHeader({
  sort,
  sortKey,
  sortDirection,
  onSort,
  children,
}: {
  sort: SortKey;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  onSort: (sort: SortKey) => void;
  children: ReactNode;
}) {
  const isActive = sortKey === sort;

  return (
    <button
      type="button"
      onClick={() => onSort(sort)}
      className="inline-flex items-center justify-center gap-1 transition hover:text-white"
    >
      <span>{children}</span>
      <span className={isActive ? "text-[#00f5a8]" : "text-white/25"}>
        {isActive ? (sortDirection === "asc" ? "в†‘" : "в†“") : "в†•"}
      </span>
    </button>
  );
}

export function PayrollPayoutsTable({
  items,
  onEdit,
  onDelete,
  canManagePayroll = false,
}: PayrollPayoutsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("payoutDate");
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

  return (
    <div className="rivn-card p-4 sm:p-5">
      <div className="text-sm text-white/50">Выплаты</div>

      <div className="mt-5 overflow-x-auto rounded-[24px] border border-white/8">
        <table className="w-full min-w-[760px] text-center text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium"><StableSortHeader sort="employee" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort}>Сотрудник</StableSortHeader></th>
              <th className="px-4 py-3 font-medium"><StableSortHeader sort="month" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort}>Месяц</StableSortHeader></th>
              <th className="px-4 py-3 font-medium"><StableSortHeader sort="payoutDate" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort}>Дата выплаты</StableSortHeader></th>
              <th className="px-4 py-3 font-medium"><StableSortHeader sort="amount" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort}>Сумма</StableSortHeader></th>
              <th className="px-4 py-3 font-medium"><StableSortHeader sort="status" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort}>Статус</StableSortHeader></th>
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
                <td className="px-4 py-3 text-white/75">{item.month}</td>
                <td className="px-4 py-3 text-white/75">{formatDisplayDate(item.payoutDate)}</td>
                <td className="px-4 py-3 font-medium text-emerald-300">{item.amount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      item.status === "scheduled"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-emerald-500/15 text-emerald-300"
                    }`}
                  >
                    {payoutStatusLabels[item.status]}
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
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-white/45">
                  Выплат пока нет.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
