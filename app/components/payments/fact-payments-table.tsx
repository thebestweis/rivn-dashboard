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
      className="inline-flex items-center gap-1 text-left font-medium transition hover:text-white"
    >
      <span>{label}</span>
      <span className={isActive ? "text-emerald-300" : "text-white/25"}>
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
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-5">
      <div className="text-sm text-white/50">Фактические оплаты</div>

      <div className="mt-5 overflow-x-auto rounded-[24px] border border-white/8">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3">
                <SortHeader field="client" label="Клиент" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3">
                <SortHeader field="project" label="Проект" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3">
                <SortHeader field="paid_date" label="Дата оплаты" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3">
                <SortHeader field="amount" label="Сумма" sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />
              </th>
              <th className="px-4 py-3 font-medium">Источник</th>
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
                <td className="px-4 py-3 text-white/75">
                  {formatDisplayDate(item.paidAt)}
                </td>
                <td className="px-4 py-3 font-medium text-emerald-300">
                  {item.amount}
                </td>
                <td className="px-4 py-3 text-white/75">{item.source}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onEdit?.(item)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 hover:text-white"
                      >
                        Редактировать
                      </button>
                      <button
                        disabled={deletingPaymentId === item.id}
                        onClick={() => onDelete?.(item.id)}
                        className={`rounded-xl px-3 py-2 text-xs transition ${
                          deletingPaymentId === item.id
                            ? "cursor-not-allowed bg-white/[0.04] text-white/35"
                            : "border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
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
