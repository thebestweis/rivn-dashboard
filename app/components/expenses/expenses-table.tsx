import { formatDisplayDate } from "../../lib/storage";

const expenseCategoryLabels: Record<string, string> = {
  marketing: "Маркетинг",
  contractor: "Подрядчики",
  service: "Сервисы",
  tax: "Налоги",
  other: "Прочее",
};

interface ExpenseRow {
  id: string;
  title: string;
  category: "marketing" | "contractor" | "service" | "tax" | "other";
  amount: string;
  date: string;
  client: string;
}

interface ExpensesTableProps {
  items: ExpenseRow[];
  onEdit?: (expense: ExpenseRow) => void;
  onDelete?: (expenseId: string) => void;
  sortBy: "title" | "category" | "date" | "client" | "amount";
  sortDirection: "asc" | "desc";
  onSort: (field: "title" | "category" | "date" | "client" | "amount") => void;
  canManageExpenses?: boolean;
  isDeletingExpense?: boolean;
  deletingExpenseId?: string | null;
}

function SortHeader({
  field,
  label,
  sortBy,
  sortDirection,
  onSort,
}: {
  field: "title" | "category" | "date" | "client" | "amount";
  label: string;
  sortBy: "title" | "category" | "date" | "client" | "amount";
  sortDirection: "asc" | "desc";
  onSort: (field: "title" | "category" | "date" | "client" | "amount") => void;
}) {
  const isActive = sortBy === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center justify-center gap-1 text-center font-medium transition duration-300 hover:text-white"
    >
      <span>{label}</span>
      <span className={isActive ? "text-[#00f5a8]" : "text-white/25"}>
        {isActive ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

export function ExpensesTable({
  items,
  onEdit,
  onDelete,
  sortBy,
  sortDirection,
  onSort,
  canManageExpenses = false,
  isDeletingExpense = false,
  deletingExpenseId = null,
}: ExpensesTableProps) {
  return (
    <div className="rivn-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/35">
            Детализация
          </div>
          <div className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
            Список расходов
          </div>
        </div>

        {!canManageExpenses ? (
          <div className="rivn-pill px-3 py-1 text-xs text-white/50">
            Только просмотр
          </div>
        ) : null}
      </div>

      <div className="rivn-table-wrap mt-5">
        <table className="w-full min-w-[760px] text-center text-sm">
          <thead className="rivn-table-head">
            <tr>
              <th className="px-4 py-3 text-center">
                <SortHeader field="title" label="Расход" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="category" label="Категория" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="date" label="Дата" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="client" label="Клиент" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="amount" label="Сумма" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              {canManageExpenses ? (
                <th className="px-4 py-3 text-center font-medium">Действия</th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {items.map((item) => {
              const isDeleting = deletingExpenseId === item.id;

              return (
                <tr
                  key={item.id}
                  className="rivn-table-row border-t border-white/[0.06]"
                >
                  <td className="px-4 py-3 font-medium">{item.title}</td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        item.category === "marketing"
                          ? "bg-violet-500/15 text-violet-300"
                          : item.category === "contractor"
                            ? "bg-amber-500/15 text-amber-300"
                            : item.category === "service"
                              ? "bg-sky-500/15 text-sky-300"
                              : item.category === "tax"
                                ? "bg-rose-500/15 text-rose-300"
                                : "bg-white/10 text-white/60"
                      }`}
                    >
                      {expenseCategoryLabels[item.category] ?? item.category}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-white/75">
                    {formatDisplayDate(item.date)}
                  </td>
                  <td className="px-4 py-3 text-white/75">{item.client}</td>
                  <td className="px-4 py-3 font-medium text-rose-300">
                    {item.amount}
                  </td>

                  {canManageExpenses ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit?.(item)}
                          disabled={isDeletingExpense}
                          className="rivn-button px-3 py-2 text-xs text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Редактировать
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete?.(item.id)}
                          disabled={isDeletingExpense}
                          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 transition duration-300 hover:-translate-y-0.5 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeleting ? "Удаляем..." : "Удалить"}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
