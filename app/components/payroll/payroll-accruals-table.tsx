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
}

export function PayrollAccrualsTable({
  items,
}: PayrollAccrualsTableProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Начисления</div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Сотрудник</th>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Проект</th>
              <th className="px-4 py-3 font-medium">Дата</th>
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
                <td className="px-4 py-3 text-white/75">{item.client}</td>
                <td className="px-4 py-3 text-white/75">{item.project}</td>
                <td className="px-4 py-3 text-white/75">{item.date}</td>
                <td className="px-4 py-3 font-medium text-violet-300">{item.amount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      item.status === "accrued"
                        ? "bg-violet-500/15 text-violet-300"
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