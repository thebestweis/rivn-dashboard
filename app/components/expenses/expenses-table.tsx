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
  canManageExpenses?: boolean;
  isDeletingExpense?: boolean;
  deletingExpenseId?: string | null;
}

export function ExpensesTable({
  items,
  onEdit,
  onDelete,
  canManageExpenses = false,
  isDeletingExpense = false,
  deletingExpenseId = null,
}: ExpensesTableProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-white/50">Список расходов</div>

        {!canManageExpenses ? (
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/50">
            Только просмотр
          </div>
        ) : null}
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Расход</th>
              <th className="px-4 py-3 font-medium">Категория</th>
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Сумма</th>
              {canManageExpenses ? (
                <th className="px-4 py-3 font-medium">Действия</th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {items.map((item) => {
              const isDeleting = deletingExpenseId === item.id;

              return (
                <tr
                  key={item.id}
                  className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
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
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit?.(item)}
                          disabled={isDeletingExpense}
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Редактировать
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete?.(item.id)}
                          disabled={isDeletingExpense}
                          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
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