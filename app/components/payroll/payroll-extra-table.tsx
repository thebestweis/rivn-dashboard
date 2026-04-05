interface PayrollExtraRow {
  id: string;
  employee: string;
  reason: string;
  date: string;
  amount: string;
}

interface PayrollExtraTableProps {
  items: PayrollExtraRow[];
}

export function PayrollExtraTable({ items }: PayrollExtraTableProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Внеплановые выплаты</div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Сотрудник</th>
              <th className="px-4 py-3 font-medium">Причина</th>
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Сумма</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-medium">{item.employee}</td>
                <td className="px-4 py-3 text-white/75">{item.reason}</td>
                <td className="px-4 py-3 text-white/75">{item.date}</td>
                <td className="px-4 py-3 font-medium text-amber-300">{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}