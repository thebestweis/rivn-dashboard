import { formatDisplayDate } from "../../lib/storage";

interface FactPaymentRow {
  id: string;
  clientId: string;
  client: string;
  projectId: string | null;
  project: string;
  paidAt: string;
  amount: string;
  source: string;
  documentUrl: string;
}

interface FactPaymentsTableProps {
  items: FactPaymentRow[];
  onEdit?: (payment: FactPaymentRow) => void;
  onDelete?: (paymentId: string) => void;
  sortBy: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
  deletingPaymentId?: string | null;
  canManage?: boolean;
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

export function FactPaymentsTable({
  items,
  onEdit,
  onDelete,
  sortBy,
  sortDirection,
  onSort,
  deletingPaymentId,
  canManage = false,
}: FactPaymentsTableProps) {
  return (
    <div className="rivn-card p-4 sm:p-5">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-white/35">
          Деньги на счёте
        </div>
        <div className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
          Фактические оплаты
        </div>
      </div>

      <div className="rivn-table-wrap mt-5">
        <table className="w-full min-w-[760px] text-center text-sm">
          <thead className="rivn-table-head">
            <tr>
              <th className="px-4 py-3 text-center">
                <SortHeader field="client" label="Клиент" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="project" label="Проект" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="paid_date" label="Дата оплаты" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center">
                <SortHeader field="amount" label="Сумма" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-center font-medium">Источник</th>
              <th className="px-4 py-3 text-center font-medium">Действия</th>
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
                <td className="px-4 py-3 text-white/75">
                  {formatDisplayDate(item.paidAt)}
                </td>
                <td className="px-4 py-3 font-medium text-[#43ffc2]">
                  {item.amount}
                </td>
                <td className="px-4 py-3 text-white/75">{item.source}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() => onEdit?.(item)}
                        className="rivn-button px-3 py-2 text-xs text-white/80"
                      >
                        Редактировать
                      </button>
                      <button
                        disabled={deletingPaymentId === item.id}
                        onClick={() => onDelete?.(item.id)}
                        className={`rounded-xl px-3 py-2 text-xs transition ${
                          deletingPaymentId === item.id
                            ? "cursor-not-allowed bg-white/[0.04] text-white/35"
                            : "border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:-translate-y-0.5 hover:bg-rose-500/15"
                        }`}
                      >
                        {deletingPaymentId === item.id ? "Удаление..." : "Удалить"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-white/30">Только просмотр</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
