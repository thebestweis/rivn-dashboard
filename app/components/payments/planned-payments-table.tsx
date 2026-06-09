import { formatDisplayDate } from "../../lib/storage";

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
  sortBy: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
  processingPaymentId?: string | null;
  deletingPaymentId?: string | null;
  canManagePayments?: boolean;
}

function SortHeader({
  field,
  label,
  sortBy,
  sortDirection,
  onSort,
}: {
  field: string;
  label: string;
  sortBy: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
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

export function PlannedPaymentsTable({
  items,
  onMarkPaid,
  onEdit,
  onDelete,
  sortBy,
  sortDirection,
  onSort,
  processingPaymentId,
  deletingPaymentId,
  canManagePayments,
}: PlannedPaymentsTableProps) {
  return (
    <div className="rivn-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/35">
            Ожидаемые поступления
          </div>
          <div className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
            Плановые счета
          </div>
        </div>

        {!canManagePayments ? (
          <div className="rivn-pill px-3 py-1 text-xs text-white/50">
            Только просмотр
          </div>
        ) : null}
      </div>

      <div className="rivn-table-wrap mt-5">
        <table className="w-full min-w-[980px] text-center text-sm">
          <thead className="rivn-table-head">
            <tr>
              <th className="px-4 py-3 text-center">
                <SortHeader field="client" label="Клиент" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="project" label="Проект" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="created_at" label="Дата счёта" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="due_date" label="Дата оплаты" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="amount" label="Сумма" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="status" label="Статус" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center font-medium">Комментарий</th>
              <th className="px-4 py-3 text-center font-medium">Документ</th>
              {canManagePayments ? (
                <th className="px-4 py-3 text-center font-medium">Действия</th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="rivn-table-row border-t border-white/[0.06]"
              >
                <td className="px-4 py-3 font-medium">{item.client}</td>
                <td className="px-4 py-3 text-white/75">{item.project}</td>
                <td className="px-4 py-3 text-white/75">{formatDisplayDate(item.invoiceDate)}</td>
                <td className="px-4 py-3 text-white/75">{formatDisplayDate(item.paymentDate)}</td>
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
                    className="text-[#77d8ff] underline underline-offset-2 transition hover:text-white"
                    >
                      Открыть
                    </a>
                  ) : (
                    "—"
                  )}
                </td>

                {canManagePayments ? (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() => onEdit(item.id)}
                        className="rivn-button px-3 py-1.5 text-xs font-medium text-white/80"
                      >
                        Редактировать
                      </button>

                      {item.status !== "paid" ? (
                        <button
                          disabled={processingPaymentId === item.id}
                          onClick={() => onMarkPaid(item.id)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            processingPaymentId === item.id
                              ? "cursor-not-allowed bg-white/[0.04] text-white/35"
                              : "border border-[#00f5a8]/35 bg-[#00f5a8]/10 text-[#43ffc2] hover:-translate-y-0.5 hover:bg-[#00f5a8]/18"
                          }`}
                        >
                          {processingPaymentId === item.id ? "Обработка..." : "Оплачено"}
                        </button>
                      ) : (
                        <span className="text-xs text-white/35">—</span>
                      )}

                      <button
                        disabled={deletingPaymentId === item.id}
                        onClick={() => onDelete(item.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          deletingPaymentId === item.id
                            ? "cursor-not-allowed bg-white/[0.04] text-white/35"
                            : "border border-rose-400/30 bg-rose-500/10 text-rose-300 hover:-translate-y-0.5 hover:bg-rose-500/18"
                        }`}
                      >
                        {deletingPaymentId === item.id ? "Удаление..." : "Удалить"}
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
