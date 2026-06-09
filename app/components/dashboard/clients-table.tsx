import Link from "next/link";
import { useMemo } from "react";
import { formatDisplayDate } from "../../lib/storage";

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
    <div className="rivn-card rivn-card-interactive p-4 sm:p-5">
      <div className="grid gap-2.5 md:hidden">
        {clients.length > 0 ? (
          clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 transition hover:-translate-y-0.5 hover:border-[#00f5a8]/30 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-[#F4F5F1]">
                    {client.name}
                  </div>
                  <div className="mt-1 text-xs text-[#AEAFB2]/70">
                    {getOwnerName(client, employeesMap)}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                    client.status === "active"
                      ? "bg-[#99D32A]/15 text-[#B7EA55]"
                      : client.status === "paused"
                        ? "bg-[#D8C45E]/15 text-[#E3D47C]"
                        : client.status === "problem"
                          ? "bg-[#E87979]/15 text-[#F39B9B]"
                          : "bg-[#2D342A] text-[#CECED0]"
                  }`}
                >
                  {CLIENT_STATUS_LABELS[client.status]}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-[#2D342A] bg-[#11130F] p-2.5">
                  <div className="text-xs text-[#AEAFB2]/65">Сумма</div>
                  <div className="mt-1 font-medium text-[#F4F5F1]">{client.amount}</div>
                </div>
                <div className="rounded-xl border border-[#2D342A] bg-[#11130F] p-2.5">
                  <div className="text-xs text-[#AEAFB2]/65">Прибыль</div>
                  <div className="mt-1 font-medium text-[#99D32A]">
                    {client.profit}
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.035] px-4 py-8 text-center text-sm text-white/45">
            Клиентов пока нет.
          </div>
        )}
      </div>

      <div className="rivn-table-wrap hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-center text-sm">
          <thead className="rivn-table-head text-[11px] uppercase tracking-[0.12em]">
            <tr>
              <th className="px-3.5 py-2.5 font-medium">Клиент</th>
              <th className="px-3.5 py-2.5 font-medium">Статус</th>
              <th className="px-3.5 py-2.5 font-medium">Ответственный</th>
              <th className="px-3.5 py-2.5 font-medium">Модель</th>
              <th className="px-3.5 py-2.5 font-medium">День оплаты</th>
              <th className="px-3.5 py-2.5 font-medium">Сумма</th>
              <th className="px-3.5 py-2.5 font-medium">Прибыль</th>
              <th className="px-3.5 py-2.5 font-medium">Действия</th>
            </tr>
          </thead>

          <tbody>
            {clients.length > 0 ? (
              clients.map((client) => (
                <tr
                  key={client.id}
                  className="rivn-table-row"
                >
                  <td className="px-3.5 py-3 font-medium text-[#F4F5F1]">
                    <Link
                      href={`/clients/${client.id}`}
                      className="group inline-flex items-center justify-center gap-2 transition hover:text-[#43ffc2]"
                      title="Открыть карточку клиента"
                    >
                      <span>{client.name}</span>
                      <span className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-[#43ffc2]">
                        →
                      </span>
                    </Link>
                  </td>

                  <td className="px-3.5 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        client.status === "active"
                          ? "bg-[#00f5a8]/15 text-[#43ffc2]"
                          : client.status === "paused"
                            ? "bg-[#D8C45E]/15 text-[#E3D47C]"
                            : client.status === "problem"
                              ? "bg-[#E87979]/15 text-[#F39B9B]"
                              : "bg-[#2D342A] text-[#CECED0]"
                      }`}
                    >
                      {CLIENT_STATUS_LABELS[client.status]}
                    </span>
                  </td>

                  <td className="px-3.5 py-3 text-[#CECED0]">
                    {getOwnerName(client, employeesMap)}
                  </td>
                  <td className="px-3.5 py-3 text-[#CECED0]">{client.model}</td>
                  <td className="px-3.5 py-3 text-[#CECED0]">{formatDisplayDate(client.nextInvoice)}</td>
                  <td className="px-3.5 py-3 text-[#CECED0]">{client.amount}</td>
                  <td className="px-3.5 py-3 font-medium text-[#43ffc2]">
                    {client.profit}
                  </td>
                  <td className="px-3.5 py-3">
                    {canManageClients ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit?.(client.id)}
                          className="rivn-button px-3 py-2 text-xs"
                        >
                          Редактировать
                        </button>

                        <button
                          type="button"
                          onClick={() => onDelete?.(client.id)}
                          className="rounded-xl border border-[#E87979]/25 bg-[#E87979]/10 px-3 py-2 text-xs text-[#F39B9B] transition hover:-translate-y-0.5 hover:bg-[#E87979]/15"
                        >
                          Удалить
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-[#AEAFB2]/45">Только просмотр</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-[#AEAFB2]/45"
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
