import { TopClientsChart } from "./top-clients-chart";
import { parseRubAmount } from "../../lib/storage";

type ClientUnitEconomicsRow = {
  clientId: string;
  clientName: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number | null;
  paidPaymentsCount: number;
  expenseItemsCount: number;
};

interface AnalyticsClientRow {
  id: string;
  name: string;
  status: "active" | "paused" | "problem" | "completed";
  owner: string;
  model: string;
  nextInvoice: string;
  amount: string;
  profit: string;
}

interface ClientsAnalyticsTabProps {
  clients: AnalyticsClientRow[];
  payments: any[];
  allPaymentRecords: any[];
  clientUnitEconomics: ClientUnitEconomicsRow[];
  topClientsByProfit: ClientUnitEconomicsRow[];
  lossMakingClients: ClientUnitEconomicsRow[];
  lowMarginClients: ClientUnitEconomicsRow[];
  highRiskClients: any[];
  clientRecommendations: any[];
}

function formatMoney(value: number) {
  return `₽${Math.round(value).toLocaleString("ru-RU")}`;
}

function getStatusLabel(status: AnalyticsClientRow["status"]) {
  switch (status) {
    case "active":
      return "Активный";
    case "paused":
      return "На паузе";
    case "problem":
      return "Проблемный";
    case "completed":
      return "Завершён";
    default:
      return status;
  }
}

function toComparableDate(value: string) {
  if (!value) return "";

  if (value.includes(".")) {
    const [day, month, year] = value.split(".");
    if (!day || !month || !year) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return value;
}

export function ClientsAnalyticsTab({
  clients,
  payments,
  allPaymentRecords,
  clientUnitEconomics,
  topClientsByProfit,
  lossMakingClients,
  lowMarginClients,
  highRiskClients,
  clientRecommendations,
}: ClientsAnalyticsTabProps) {
  const preparedClients = [...clients].map((client) => {
    const revenue = parseRubAmount(client.amount);
    const profit = parseRubAmount(client.profit);
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    return {
      ...client,
      revenue,
      profitValue: profit,
      margin,
    };
  });

  const chartData = [...preparedClients]
    .map((client) => ({
      name: client.name,
      revenue: client.revenue,
      profit: client.profitValue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const totalRevenue = preparedClients.reduce(
    (sum, client) => sum + client.revenue,
    0
  );

  const totalProfit = preparedClients.reduce(
    (sum, client) => sum + client.profitValue,
    0
  );

  const averageRevenuePerClient =
    preparedClients.length > 0 ? totalRevenue / preparedClients.length : 0;

  const averageProfitPerClient =
    preparedClients.length > 0 ? totalProfit / preparedClients.length : 0;

  const topClients = [...preparedClients]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const top3Revenue = [...preparedClients]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)
    .reduce((sum, client) => sum + client.revenue, 0);

  const top3Share =
    totalRevenue > 0 ? Math.round((top3Revenue / totalRevenue) * 100) : 0;

  const problemClientsCount = preparedClients.filter(
    (client) => client.status === "problem"
  ).length;

  const pausedClientsCount = preparedClients.filter(
    (client) => client.status === "paused"
  ).length;

  const lowMarginPreparedClients = [...preparedClients]
    .filter((client) => client.revenue > 0 && client.margin < 20)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 5);

  const clientRevenueMap = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.client] = (acc[p.client] || 0) + parseRubAmount(p.amount);
    return acc;
  }, {});

  const pendingPayments = allPaymentRecords.filter((p) => p.status === "pending");

  const overduePayments = allPaymentRecords
    .filter((p) => {
      if (p.status === "paid") return false;
      if (!p.dueDate) return false;

      const normalized = toComparableDate(p.dueDate);
      if (!normalized) return false;

      const today = new Date();
      const due = new Date(normalized);

      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);

      return due < today;
    })
    .map((p) => {
      const normalized = toComparableDate(p.dueDate);
      const today = new Date();
      const due = new Date(normalized);

      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - due.getTime();
      const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...p,
        daysOverdue,
      };
    });

  const pendingRevenue = pendingPayments.reduce(
    (sum, p) => sum + parseRubAmount(p.amount),
    0
  );

  const overdueRevenue = overduePayments.reduce(
    (sum, p) => sum + parseRubAmount(p.amount),
    0
  );

  const debtorsMap = overduePayments.reduce<
    Record<string, { client: string; amount: number; count: number }>
  >((acc, payment) => {
    const key = payment.client || "Неизвестный клиент";

    if (!acc[key]) {
      acc[key] = {
        client: key,
        amount: 0,
        count: 0,
      };
    }

    acc[key].amount += parseRubAmount(payment.amount);
    acc[key].count += 1;

    return acc;
  }, {});

  const topDebtors = Object.values(debtorsMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const clientsWithoutPayments = clients.filter((c) => !clientRevenueMap[c.name]);

  const totalClients = clients.length;
  const activeClients = Object.keys(clientRevenueMap).length;
  const inactiveClients = totalClients - activeClients;

  return (
    <div className="space-y-6">
      <TopClientsChart data={chartData} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-xs uppercase tracking-wide text-white/40">
            Средняя выручка на клиента
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {formatMoney(averageRevenuePerClient)}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-xs uppercase tracking-wide text-white/40">
            Средняя прибыль на клиента
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {formatMoney(averageProfitPerClient)}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-xs uppercase tracking-wide text-white/40">
            Доля топ-3 клиентов
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {top3Share}%
          </div>
          <div className="mt-1 text-sm text-white/45">Доля в общей выручке</div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-xs uppercase tracking-wide text-white/40">
            Риск-клиенты
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {problemClientsCount + pausedClientsCount}
          </div>
          <div className="mt-1 text-sm text-white/45">
            Проблемные и на паузе
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5">
          <div className="text-xs text-white/40">Активные клиенты</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {activeClients}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5">
          <div className="text-xs text-white/40">Без оплат</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {inactiveClients}
          </div>
          <div className="mt-1 text-sm text-white/45">
            {clientsWithoutPayments.length > 0
              ? clientsWithoutPayments.slice(0, 3).map((c) => c.name).join(", ")
              : "Все клиенты с оплатами"}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5">
          <div className="text-xs text-white/40">Ожидаемые деньги</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            ₽{pendingRevenue.toLocaleString("ru-RU")}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#121826] p-5">
          <div className="text-xs text-white/40">Просрочено</div>
          <div className="mt-2 text-2xl font-semibold text-rose-300">
            ₽{overdueRevenue.toLocaleString("ru-RU")}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-sm text-white/50">Контроль долгов</div>
          <h2 className="mt-1 text-xl font-semibold">Клиенты с просрочками</h2>

          <div className="mt-4 space-y-3">
            {topDebtors.length > 0 ? (
              topDebtors.map((debtor) => (
                <div
                  key={debtor.client}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      {debtor.client}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      Просроченных счетов: {debtor.count}
                    </div>
                  </div>

                  <div className="text-sm font-medium text-rose-300">
                    {formatMoney(debtor.amount)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">
                Просроченных счетов пока нет
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="text-sm text-white/50">Последние просрочки</div>

            <div className="mt-3 space-y-2">
              {overduePayments.length > 0 ? (
                overduePayments.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2"
                  >
                    <div>
                      <div className="text-sm text-white">{p.client}</div>
                      <div className="text-xs text-white/45">
                        {p.daysOverdue} дней просрочки
                      </div>
                    </div>

                    <div
                      className={`text-sm font-medium ${
                        p.daysOverdue > 14
                          ? "text-rose-400"
                          : p.daysOverdue > 7
                            ? "text-amber-300"
                            : "text-white/70"
                      }`}
                    >
                      {formatMoney(parseRubAmount(p.amount))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/45">Просрочек пока нет</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5">
          <div className="text-sm text-white/50">Риск-клиенты</div>

          <div className="mt-4 space-y-3">
            {highRiskClients.length > 0 ? (
              highRiskClients.slice(0, 5).map((client) => (
                <div
                  key={client.clientId}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      {client.clientName}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      Маржа: {client.margin ?? "—"}%
                    </div>
                  </div>

                  <div
                    className={`text-sm font-medium ${
                      client.risk >= 3 ? "text-rose-400" : "text-amber-300"
                    }`}
                  >
                    риск {client.risk}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">Нет клиентов с риском</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-sm text-white/50">Топ-5 клиентов по выручке</div>

          <div className="mt-4 space-y-3">
            {topClients.length > 0 ? (
              topClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      {client.name}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {getStatusLabel(client.status)}
                    </div>
                  </div>

                  <div className="text-sm text-white/75">
                    {formatMoney(client.revenue)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">Нет данных по клиентам</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
          <div className="text-sm text-white/50">Клиенты с низкой маржой</div>

          <div className="mt-4 space-y-3">
            {lowMarginPreparedClients.length > 0 ? (
              lowMarginPreparedClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-white">
                      {client.name}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      Маржа: {client.margin}%
                    </div>
                  </div>

                  <div className="text-sm text-amber-300">
                    {formatMoney(client.profitValue)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">
                Пока нет клиентов с низкой маржой
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="text-sm text-white/50">Clients analytics</div>
        <h2 className="mt-1 text-xl font-semibold">Клиенты и прибыльность</h2>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/45">
              <tr>
                <th className="px-4 py-3 font-medium">Клиент</th>
                <th className="px-4 py-3 font-medium">Выручка</th>
                <th className="px-4 py-3 font-medium">Прибыль</th>
                <th className="px-4 py-3 font-medium">Маржа</th>
                <th className="px-4 py-3 font-medium">Модель</th>
                <th className="px-4 py-3 font-medium">Следующий счёт</th>
                <th className="px-4 py-3 font-medium">Статус</th>
              </tr>
            </thead>

            <tbody>
              {preparedClients.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 font-medium text-violet-300">
                    {formatMoney(row.revenue)}
                  </td>
                  <td className="px-4 py-3 font-medium text-emerald-300">
                    {formatMoney(row.profitValue)}
                  </td>
                  <td className="px-4 py-3 text-white/75">{row.margin}%</td>
                  <td className="px-4 py-3 text-white/75">{row.model}</td>
                  <td className="px-4 py-3 text-white/75">{row.nextInvoice}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        row.status === "active"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : row.status === "paused"
                            ? "bg-amber-500/15 text-amber-300"
                            : row.status === "problem"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-white/10 text-white/60"
                      }`}
                    >
                      {getStatusLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="text-sm text-white/50">Unit economics</div>
        <h2 className="mt-1 text-xl font-semibold">
          Рейтинг клиентов по прибыли
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/45">Клиентов в прибыли</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {clientUnitEconomics.filter((client) => client.profit > 0).length}
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/45">Убыточных клиентов</div>
            <div className="mt-2 text-2xl font-semibold text-rose-300">
              {lossMakingClients.length}
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-white/45">Низкая маржа</div>
            <div className="mt-2 text-2xl font-semibold text-amber-300">
              {lowMarginClients.length}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/45">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Клиент</th>
                <th className="px-4 py-3 font-medium">Выручка</th>
                <th className="px-4 py-3 font-medium">Расходы</th>
                <th className="px-4 py-3 font-medium">Прибыль</th>
                <th className="px-4 py-3 font-medium">Маржа</th>
              </tr>
            </thead>

            <tbody>
              {topClientsByProfit.map((client, index) => (
                <tr
                  key={client.clientId}
                  className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 text-white/75">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-white">
                    {client.clientName}
                  </td>
                  <td className="px-4 py-3 text-violet-300">
                    {formatMoney(client.revenue)}
                  </td>
                  <td className="px-4 py-3 text-white/75">
                    {formatMoney(client.expenses)}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      client.profit >= 0 ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {formatMoney(client.profit)}
                  </td>
                  <td className="px-4 py-3 text-white/75">
                    {client.margin !== null ? `${client.margin}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
  <div className="text-sm text-white/50">Рекомендации</div>
  <h2 className="mt-1 text-xl font-semibold">Что делать по клиентам</h2>

  <div className="mt-4 space-y-3">
    {clientRecommendations.slice(0, 5).map((client) => (
      <div
        key={client.clientId}
        className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4"
      >
        <div className="text-sm font-medium text-white">
          {client.clientName}
        </div>

        <div className="mt-2 space-y-2">
          {client.recommendations.map(
  (
    item: { text: string; tone: "good" | "warn" | "danger" },
    index: number
  ) => (
    <div
      key={index}
      className={`rounded-xl px-3 py-2 text-sm ${
        item.tone === "danger"
          ? "bg-rose-500/10 text-rose-300"
          : item.tone === "warn"
            ? "bg-amber-500/10 text-amber-300"
            : "bg-emerald-500/10 text-emerald-300"
      }`}
    >
      {item.text}
    </div>
  )
)}
        </div>
      </div>
    ))}
  </div>
</div>
      </div>
    </div>
  );
}