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
}

export function PayrollPayoutsTable({
  items,
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
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}