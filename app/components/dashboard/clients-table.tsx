import Link from "next/link";
import { useMemo } from "react";

interface ClientRow {
  id: string;
  name: string;
  status: "active" | "paused" | "problem" | "completed";
  owner: string;
  ownerId?: string | null;
  model: string;
  nextInvoice: string;
  amount: string;
  profit: string;
}

interface EmployeeRow {
  id: string;
  name: string;
}

interface ClientsTableProps {
  clients: ClientRow[];
  employees?: EmployeeRow[];
  onDelete?: (clientId: string) => void;
  onEdit?: (clientId: string) => void;
  canManageClients?: boolean;
}

const CLIENT_STATUS_LABELS = {
  active: "Активный",
  paused: "На паузе",
  problem: "Проблемный",
  completed: "Завершён",
};

function getOwnerName(
  client: ClientRow,
  employeesMap: Map<string, EmployeeRow>
) {
  if (!client.ownerId) {
    return client.owner || "Не назначен";
  }

  return employeesMap.get(client.ownerId)?.name ?? client.owner ?? "Не назначен";
}

export function ClientsTable({
  clients,
  employees = [],
  onDelete,
  onEdit,
  canManageClients = false,
}: ClientsTableProps) {
  const employeesMap = useMemo(() => {
    return new Map(employees.map((employee) => [employee.id, employee]));
  }, [employees]);

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h2 className="mt-1 text-xl font-semibold">Клиенты</h2>
        </div>

        <Link
          href="/clients"
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
        >
          Смотреть все
        </Link>
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Ответственный</th>
              <th className="px-4 py-3 font-medium">Модель</th>
              <th className="px-4 py-3 font-medium">День оплаты</th>
              <th className="px-4 py-3 font-medium">Сумма</th>
              <th className="px-4 py-3 font-medium">Прибыль</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>

          <tbody>
            {clients.length > 0 ? (
              clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/clients/${client.id}`}
                      className="group inline-flex items-center gap-2 transition hover:text-violet-300"
                      title="Открыть карточку клиента"
                    >
                      <span>{client.name}</span>
                      <span className="text-white/25 transition group-hover:translate-x-0.5 group-hover:text-violet-300">
                        →
                      </span>
                    </Link>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        client.status === "active"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : client.status === "paused"
                            ? "bg-amber-500/15 text-amber-300"
                            : client.status === "problem"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-white/10 text-white/60"
                      }`}
                    >
                      {CLIENT_STATUS_LABELS[client.status]}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-white/75">
                    {getOwnerName(client, employeesMap)}
                  </td>
                  <td className="px-4 py-3 text-white/75">{client.model}</td>
                  <td className="px-4 py-3 text-white/75">{client.nextInvoice}</td>
                  <td className="px-4 py-3 text-white/75">{client.amount}</td>
                  <td className="px-4 py-3 font-medium text-emerald-300">
                    {client.profit}
                  </td>
                  <td className="px-4 py-3">
                    {canManageClients ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit?.(client.id)}
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/75 transition hover:bg-white/[0.08] hover:text-white"
                        >
                          Редактировать
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete?.(client.id)}
                          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 transition hover:bg-rose-500/15"
                        >
                          Удалить
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-white/30">Только просмотр</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-white/35"
                >
                  Клиентов пока нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}