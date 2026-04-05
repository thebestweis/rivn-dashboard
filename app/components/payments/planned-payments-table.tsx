interface PlannedPaymentRow {
  id: string;
  client: string;
  project: string;
  invoiceDate: string;
  paymentDate: string;
  amount: string;
  status: "planned" | "waiting" | "overdue" | "paid";
  notes: string;
  documentUrl: string;
}

interface PlannedPaymentsTableProps {
  items: PlannedPaymentRow[];
  onMarkPaid: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PlannedPaymentsTable({
  items,
  onMarkPaid,
  onEdit,
  onDelete,
}: PlannedPaymentsTableProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Плановые счета</div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Проект</th>
              <th className="px-4 py-3 font-medium">Дата счёта</th>
              <th className="px-4 py-3 font-medium">Дата оплаты</th>
              <th className="px-4 py-3 font-medium">Сумма</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Комментарий</th>
              <th className="px-4 py-3 font-medium">Документ</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-medium">{item.client}</td>
                <td className="px-4 py-3 text-white/75">{item.project}</td>
                <td className="px-4 py-3 text-white/75">{item.invoiceDate}</td>
                <td className="px-4 py-3 text-white/75">{item.paymentDate}</td>
                <td className="px-4 py-3 text-white/75">{item.amount}</td>

                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      item.status === "planned"
                        ? "bg-violet-500/15 text-violet-300"
                        : item.status === "waiting"
                          ? "bg-amber-500/15 text-amber-300"
                          : item.status === "overdue"
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-emerald-500/15 text-emerald-300"
                    }`}
                  >
                    {item.status === "planned"
                      ? "Ожидается"
                      : item.status === "overdue"
                        ? "Просрочен"
                        : item.status === "paid"
                          ? "Оплачен"
                          : "Ожидается"}
                  </span>
                </td>

                <td className="px-4 py-3 text-white/60">
                  {item.notes || "—"}
                </td>

                <td className="px-4 py-3 text-white/60">
                  {item.documentUrl ? (
                    <a
                      href={item.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
                    >
                      Открыть
                    </a>
                  ) : (
                    "—"
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onEdit(item.id)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.08]"
                    >
                      Редактировать
                    </button>

                    {item.status !== "paid" ? (
                      <button
                        onClick={() => onMarkPaid(item.id)}
                        className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                      >
                        Оплачено
                      </button>
                      
                    ) : (
                      <span className="text-xs text-white/35">—</span>
                    )}
                    <button
  onClick={() => onDelete(item.id)}
  className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
>
  Удалить
</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}