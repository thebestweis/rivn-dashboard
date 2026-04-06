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
}

const payoutStatusLabels: Record<PayrollPayoutRow["status"], string> = {
  scheduled: "Запланировано",
  paid: "Выплачено",
};

export function PayrollPayoutsTable({
  items,
  onEdit,
  onDelete,
}: PayrollPayoutsTableProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Выплаты</div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Сотрудник</th>
              <th className="px-4 py-3 font-medium">Месяц</th>
              <th className="px-4 py-3 font-medium">Дата выплаты</th>
              <th className="px-4 py-3 font-medium">Сумма</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-medium">{item.employee}</td>
                <td className="px-4 py-3 text-white/75">{item.month}</td>
                <td className="px-4 py-3 text-white/75">
                  {formatDisplayDate(item.payoutDate)}
                </td>
                <td className="px-4 py-3 font-medium text-emerald-300">
                  {item.amount}
                </td>
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
                  <div className="flex gap-2">
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
                </td>
              </tr>
            ))}

            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-white/45"
                >
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