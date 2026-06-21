"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditClientModal } from "../../components/clients/edit-client-modal";
import { AppToast } from "../../components/ui/app-toast";

import {
  CLIENT_STATUS_LABELS,
  formatDisplayDate,
  parseRubAmount,
  formatRub,
  type StoredClient,
  type StoredEmployee,
} from "../../lib/storage";

import {
  fetchClientByIdFromSupabase,
  updateClientInSupabase,
} from "../../lib/supabase/clients";

import { fetchEmployeesFromSupabase } from "../../lib/supabase/employees";
import { getPaymentsFromSupabase } from "../../lib/supabase/payments";
import { getExpensesFromSupabase } from "../../lib/supabase/expenses";
import { fetchPayrollAccrualsFromSupabase } from "../../lib/supabase/payroll";
import {
  ClientFinancialChart,
  type ClientMetricSeries,
} from "../../components/clients/client-financial-chart";
import {
  canEditClients,
  canManageFinance,
  isAppRole,
  type AppRole,
} from "../../lib/permissions";
import { useAppContextState } from "../../providers/app-context-provider";

type ChartPeriod = "30d" | "90d" | "all";

type SupabasePaymentItem = {
  id: string;
  client_id: string | null;
  period_label: string | null;
  paid_date: string | null;
  amount: number | string;
  notes: string | null;
  status: string;
};

type SupabaseExpenseItem = {
  id: string;
  title: string;
  client_id: string | null;
  expense_date: string;
  amount: number | string;
  notes?: string | null;
};

type SupabasePayrollAccrualItem = {
  id: string;
  employee: string;
  employeeId?: string | null;
  client: string;
  clientId?: string | null;
  project: string;
  projectId?: string | null;
  paymentId?: string | null;
  amount: string;
  date: string;
  status: "accrued" | "paid";
};

function parseDisplayDateToDate(value: string) {
  if (!value) return null;

  if (value.includes(".")) {
    const [day, month, year] = value.split(".");
    if (!day || !month || !year) return null;

    const date = new Date(Number(year), Number(month) - 1, Number(day));
    date.setHours(0, 0, 0, 0);
    return date;
  }

  if (value.includes("-")) {
    const [year, month, day] = value.split("-");
    if (!day || !month || !year) return null;

    const date = new Date(Number(year), Number(month) - 1, Number(day));
    date.setHours(0, 0, 0, 0);
    return date;
  }

  return null;
}

function formatSupabaseDateToDisplay(value: string | null) {
  return value ? formatDisplayDate(value) : "";
}

function groupChartData(items: Array<{ label: string; amount: number }>) {
  const grouped = new Map<string, number>();

  items.forEach((item) => {
    grouped.set(item.label, (grouped.get(item.label) ?? 0) + item.amount);
  });

  return Array.from(grouped.entries())
    .map(([label, amount]) => ({
      label,
      amount,
    }))
    .sort((a, b) => {
      const first = parseDisplayDateToDate(a.label)?.getTime() ?? 0;
      const second = parseDisplayDateToDate(b.label)?.getTime() ?? 0;
      return first - second;
    });
}

export default function ClientDetailsPage() {
  const { role, isLoading: isAppContextLoading } = useAppContextState();

  const currentRole: AppRole | null = isAppRole(role) ? role : null;
  const canManageClientDetails = currentRole
    ? canEditClients(currentRole)
    : false;
  const canCreatePayments = currentRole ? canManageFinance(currentRole) : false;

  const params = useParams();
  const router = useRouter();
  const clientId = String(params.clientId ?? "");

  const [client, setClient] = useState<StoredClient | null>(null);
  const [isLoadingClient, setIsLoadingClient] = useState(true);

  const [payments, setPayments] = useState<SupabasePaymentItem[]>([]);
  const [expenses, setExpenses] = useState<SupabaseExpenseItem[]>([]);
  const [payrollAccruals, setPayrollAccruals] = useState<
    SupabasePayrollAccrualItem[]
  >([]);
  const [employees, setEmployees] = useState<StoredEmployee[]>([]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("90d");

  const [editName, setEditName] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editStatus, setEditStatus] = useState<
    "active" | "paused" | "problem" | "completed"
  >("active");
  const [editNextInvoice, setEditNextInvoice] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editProfit, setEditProfit] = useState("");

  const [clientNotes, setClientNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (canManageClientDetails) return;

    setIsEditOpen(false);
  }, [canManageClientDetails]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (isAppContextLoading) return;

    let isMounted = true;

    async function loadClientCard() {
      try {
        setIsLoadingClient(true);

        const [
          clientData,
          paymentsData,
          expensesData,
          payrollAccrualsData,
          employeesData,
        ] = await Promise.all([
          fetchClientByIdFromSupabase(clientId),
          getPaymentsFromSupabase(),
          getExpensesFromSupabase(),
          fetchPayrollAccrualsFromSupabase(),
          fetchEmployeesFromSupabase(),
        ]);

        if (!isMounted) return;

        setClient(clientData);
        setPayments((paymentsData ?? []) as SupabasePaymentItem[]);
        setExpenses((expensesData ?? []) as SupabaseExpenseItem[]);
        setPayrollAccruals(
          (payrollAccrualsData ?? []) as SupabasePayrollAccrualItem[]
        );
        setEmployees(employeesData ?? []);

        if (clientData) {
          setEditName(clientData.name);
          setEditOwner(clientData.owner);
          setEditOwnerId(clientData.ownerId ?? "");
          setEditModel(clientData.model);
          setEditStatus(clientData.status);
          setEditNextInvoice(clientData.nextInvoice);
          setEditAmount(clientData.amount);
          setEditProfit(clientData.profit);
          setClientNotes(clientData.notes ?? "");
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setToastType("error");
          setToastMessage("Не удалось загрузить карточку клиента");
        }
      } finally {
        if (isMounted) {
          setIsLoadingClient(false);
        }
      }
    }

    if (clientId) {
      loadClientCard();
    } else {
      setIsLoadingClient(false);
    }

    return () => {
      isMounted = false;
    };
  }, [clientId, isAppContextLoading]);

  const linkedPayments = useMemo(() => {
    if (!client) return [];

    return payments.filter(
      (payment) =>
        payment.status === "paid" &&
        payment.client_id &&
        payment.client_id === client.id
    );
  }, [payments, client]);

  const linkedExpenses = useMemo(() => {
    if (!client) return [];

    return expenses.filter(
      (expense) => expense.client_id && expense.client_id === client.id
    );
  }, [expenses, client]);

  const linkedPayrollAccruals = useMemo(() => {
    if (!client) return [];

    return payrollAccruals.filter((item) => {
      if (item.clientId) {
        return item.clientId === client.id;
      }

      return (
        item.client.trim().toLowerCase() === client.name.trim().toLowerCase()
      );
    });
  }, [payrollAccruals, client]);

  const clientRevenueNumber = useMemo(() => {
    return linkedPayments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
  }, [linkedPayments]);

  const clientDirectExpensesNumber = useMemo(() => {
    return linkedExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
  }, [linkedExpenses]);

  const clientFotNumber = useMemo(() => {
    return linkedPayrollAccruals.reduce(
      (sum, item) => sum + parseRubAmount(item.amount),
      0
    );
  }, [linkedPayrollAccruals]);

  const clientTotalCostsNumber = useMemo(() => {
    return clientDirectExpensesNumber + clientFotNumber;
  }, [clientDirectExpensesNumber, clientFotNumber]);

  const clientTaxNumber = useMemo(() => {
    return clientRevenueNumber * 0.07;
  }, [clientRevenueNumber]);

  const clientProfitNumber = useMemo(() => {
    return (
      clientRevenueNumber -
      clientDirectExpensesNumber -
      clientFotNumber -
      clientTaxNumber
    );
  }, [
    clientRevenueNumber,
    clientDirectExpensesNumber,
    clientFotNumber,
    clientTaxNumber,
  ]);

  const isDateInChartPeriod = useCallback((value: string) => {
    if (chartPeriod === "all") return true;

    const targetDate = parseDisplayDateToDate(value);
    if (!targetDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);

    if (chartPeriod === "30d") {
      start.setDate(today.getDate() - 29);
    }

    if (chartPeriod === "90d") {
      start.setDate(today.getDate() - 89);
    }

    return targetDate >= start && targetDate <= today;
  }, [chartPeriod]);

  const paymentsChartData = useMemo(() => {
    const prepared = linkedPayments
      .map((payment) => ({
        label: formatSupabaseDateToDisplay(payment.paid_date),
        amount: Number(payment.amount || 0),
      }))
      .filter((item) => item.label && isDateInChartPeriod(item.label));

    if (prepared.length === 0) {
      return [{ label: "Нет оплат", amount: 0 }];
    }

    return groupChartData(prepared);
  }, [isDateInChartPeriod, linkedPayments]);

  const directExpensesChartData = useMemo(() => {
    const prepared = linkedExpenses
      .map((expense) => ({
        label: formatSupabaseDateToDisplay(expense.expense_date),
        amount: Number(expense.amount || 0),
      }))
      .filter((item) => item.label && isDateInChartPeriod(item.label));

    return groupChartData(prepared);
  }, [isDateInChartPeriod, linkedExpenses]);

  const fotChartData = useMemo(() => {
    const prepared = linkedPayrollAccruals
      .map((item) => ({
        label: formatDisplayDate(item.date),
        amount: parseRubAmount(item.amount),
      }))
      .filter((item) => item.label && isDateInChartPeriod(item.label));

    return groupChartData(prepared);
  }, [isDateInChartPeriod, linkedPayrollAccruals]);

  const clientChartData = useMemo(() => {
    const byLabel = new Map<string, ClientMetricSeries>();
    const invoiceValue = parseRubAmount(editAmount || client?.amount || "0");

    function ensureLabel(label: string) {
      const existing = byLabel.get(label);
      if (existing) return existing;

      const next: ClientMetricSeries = {
        revenue: 0,
        profit: 0,
        expenses: 0,
        fot: 0,
        tax: 0,
        invoice: invoiceValue,
      };

      byLabel.set(label, next);
      return next;
    }

    paymentsChartData.forEach((item) => {
      if (item.label.startsWith("Нет ")) return;
      const target = ensureLabel(item.label);
      target.revenue += item.amount;
      target.tax += item.amount * 0.07;
    });

    directExpensesChartData.forEach((item) => {
      if (item.label.startsWith("Нет ")) return;
      ensureLabel(item.label).expenses += item.amount;
    });

    fotChartData.forEach((item) => {
      if (item.label.startsWith("Нет ")) return;
      ensureLabel(item.label).fot += item.amount;
    });

    const rows = Array.from(byLabel.entries())
      .map(([label, values]) => ({
        label,
        ...values,
        profit:
          values.revenue - values.expenses - values.fot - values.tax,
      }))
      .sort((a, b) => {
        const first = parseDisplayDateToDate(a.label)?.getTime() ?? 0;
        const second = parseDisplayDateToDate(b.label)?.getTime() ?? 0;
        return first - second;
      });

    if (rows.length > 0) return rows;

    return [
      {
        label: "Нет данных",
        revenue: 0,
        profit: 0,
        expenses: 0,
        fot: 0,
        tax: 0,
        invoice: invoiceValue,
      },
    ];
  }, [
    paymentsChartData,
    directExpensesChartData,
    fotChartData,
    editAmount,
    client?.amount,
  ]);

  const clientChartTotals = useMemo<ClientMetricSeries>(
    () => ({
      revenue: clientRevenueNumber,
      profit: clientProfitNumber,
      expenses: clientDirectExpensesNumber,
      fot: clientFotNumber,
      tax: clientTaxNumber,
      invoice: parseRubAmount(editAmount || client?.amount || "0"),
    }),
    [
      clientRevenueNumber,
      clientProfitNumber,
      clientDirectExpensesNumber,
      clientFotNumber,
      clientTaxNumber,
      editAmount,
      client?.amount,
    ]
  );

  const currentClient = useMemo(() => {
    return {
      id: client?.id ?? clientId,
      name: editName || client?.name || "Unknown client",
      status: editStatus,
      owner: editOwner || client?.owner || "—",
      ownerId: editOwnerId || client?.ownerId || null,
      model: editModel || client?.model || "—",
      nextInvoice: formatDisplayDate(editNextInvoice || client?.nextInvoice || ""),
      amount: editAmount || client?.amount || "—",
      revenue: formatRub(clientRevenueNumber),
      directExpenses: formatRub(clientDirectExpensesNumber),
      fot: formatRub(clientFotNumber),
      totalCosts: formatRub(clientTotalCostsNumber),
      tax: formatRub(clientTaxNumber),
      profit: formatRub(clientProfitNumber),
      notes: clientNotes,
    };
  }, [
    client,
    clientId,
    editName,
    editStatus,
    editOwner,
    editOwnerId,
    editModel,
    editNextInvoice,
    editAmount,
    clientRevenueNumber,
    clientDirectExpensesNumber,
    clientFotNumber,
    clientTotalCostsNumber,
    clientTaxNumber,
    clientProfitNumber,
    clientNotes,
  ]);

  async function handleSave(updatedClient: Omit<StoredClient, "id">) {
    if (!client) return;

    if (!canManageClientDetails) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование клиента");
      return;
    }

    try {
      const saved = await updateClientInSupabase(client.id, {
        ...updatedClient,
        notes: clientNotes,
      });

      setClient(saved);
      setEditName(saved.name);
      setEditOwner(saved.owner);
      setEditOwnerId(saved.ownerId ?? "");
      setEditModel(saved.model);
      setEditStatus(saved.status);
      setEditNextInvoice(saved.nextInvoice);
      setEditAmount(saved.amount);
      setEditProfit(saved.profit);

      setToastType("success");
      setToastMessage(`Клиент "${updatedClient.name}" сохранён`);
      setIsEditOpen(false);
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось сохранить клиента");
    }
  }

  async function handleSaveNotes() {
    if (!client) return;

    if (!canManageClientDetails) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование заметок клиента");
      return;
    }

    try {
      setIsSavingNotes(true);

      const saved = await updateClientInSupabase(client.id, {
        name: client.name,
        status: client.status,
        owner: client.owner,
        ownerId: client.ownerId ?? null,
        model: client.model,
        nextInvoice: client.nextInvoice,
        amount: client.amount,
        profit: client.profit,
        notes: clientNotes,
      });

      setClient(saved);
      setClientNotes(saved.notes ?? "");

      setToastType("success");
      setToastMessage("Заметки клиента сохранены");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось сохранить заметки");
    } finally {
      setIsSavingNotes(false);
    }
  }

  if (isLoadingClient || isAppContextLoading) {
    return (
      <main className="flex-1">
        <div className="px-5 py-6 lg:px-8">
          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-6 text-white/60">
            Загружаем карточку клиента...
          </div>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <>
        <main className="flex-1">
          <div className="px-5 py-6 lg:px-8">
            <div className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              <p className="text-white/70">
                Клиент с таким ID не найден. Вернись в раздел Clients и открой
                карточку из таблицы.
              </p>
            </div>
          </div>
        </main>

        {toastMessage ? (
          <AppToast message={toastMessage} type={toastType} />
        ) : null}
      </>
    );
  }

  const statusTone =
    currentClient.status === "active"
      ? "bg-emerald-500/15 text-emerald-300"
      : currentClient.status === "paused"
      ? "bg-amber-500/15 text-amber-300"
      : currentClient.status === "problem"
      ? "bg-rose-500/15 text-rose-300"
      : "bg-white/10 text-white/60";

  return (
    <>
      <main className="flex-1">
        <div className="rivn-page-shell mx-3 my-3 space-y-5 px-4 py-4 sm:mx-4 sm:my-4 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
          {!canManageClientDetails ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              У тебя доступ только на просмотр карточки клиента. Редактирование данных и заметок недоступно.
            </div>
          ) : null}

          <section className="rivn-card rivn-card-interactive p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.22em] text-[#43ffc2]">
                  Паспорт клиента
                </div>
                <h1 className="mt-1 truncate text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">
                  {currentClient.name}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusTone}`}
                  >
                    {CLIENT_STATUS_LABELS[currentClient.status]}
                  </span>

                  <span className="rivn-pill text-xs">
                    Ответственный: {currentClient.owner}
                  </span>

                  <span className="rivn-pill text-xs">
                    Модель: {currentClient.model}
                  </span>

                  <span className="rivn-pill text-xs">
                    Оплата: {currentClient.nextInvoice}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {canManageClientDetails ? (
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(true)}
                    className="rivn-button px-4 py-3 text-sm font-semibold"
                  >
                    Редактировать
                  </button>
                ) : null}

                {canCreatePayments ? (
                  <button
                    type="button"
                    onClick={() => router.push("/payments")}
                    className="rivn-button rivn-button-primary px-4 py-3 text-sm font-semibold"
                  >
                    Добавить оплату
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-white/54">
                Динамика по оплатам, расходам, ФОТ, налогу и прибыли клиента.
              </div>

              <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] p-1">
                <button
                  type="button"
                  onClick={() => setChartPeriod("30d")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    chartPeriod === "30d"
                      ? "bg-[#00f5a8] text-[#06101d] shadow-[0_0_24px_rgba(0,245,168,0.22)]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  30 дней
                </button>

                <button
                  type="button"
                  onClick={() => setChartPeriod("90d")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    chartPeriod === "90d"
                      ? "bg-[#00f5a8] text-[#06101d] shadow-[0_0_24px_rgba(0,245,168,0.22)]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  90 дней
                </button>

                <button
                  type="button"
                  onClick={() => setChartPeriod("all")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    chartPeriod === "all"
                      ? "bg-[#00f5a8] text-[#06101d] shadow-[0_0_24px_rgba(0,245,168,0.22)]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Всё время
                </button>
              </div>
            </div>

            <ClientFinancialChart
              data={clientChartData}
              totals={clientChartTotals}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <div className="space-y-6">
              <div className="rivn-card p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-white/38">История оплат</div>

                <div className="mt-4 space-y-3">
                  {linkedPayments.length > 0 ? (
                    linkedPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3"
                      >
                        <div>
                          <div className="text-sm text-white/45">
                            {formatSupabaseDateToDisplay(payment.paid_date)}
                          </div>
                          <div className="mt-1 font-medium">
                            {payment.period_label || "Оплата клиента"}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-medium text-emerald-300">
                            {formatRub(Number(payment.amount || 0))}
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            {payment.notes || "Без комментария"}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-6 text-sm text-white/45">
                      У этого клиента пока нет реальных оплат в системе.
                    </div>
                  )}
                </div>
              </div>

              <div className="rivn-card p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-white/38">Расходы по клиенту</div>

                <div className="mt-4 space-y-3">
                  {linkedExpenses.length > 0 || linkedPayrollAccruals.length > 0 ? (
                    <>
                      {linkedExpenses.map((expense) => (
                        <div
                          key={`expense_${expense.id}`}
                          className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm text-white/45">
                              {formatSupabaseDateToDisplay(expense.expense_date)}
                            </div>
                            <div className="mt-1 font-medium">{expense.title}</div>
                          </div>

                          <div className="font-medium text-rose-300">
                            {formatRub(Number(expense.amount || 0))}
                          </div>
                        </div>
                      ))}

                      {linkedPayrollAccruals.map((item) => (
                        <div
                          key={`fot_${item.id}`}
                          className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm text-white/45">{formatDisplayDate(item.date)}</div>
                            <div className="mt-1 font-medium">
                              ФОТ: {item.employee} / {item.project}
                            </div>
                          </div>

                          <div className="font-medium text-amber-300">
                            {item.amount}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-6 text-sm text-white/45">
                      У этого клиента пока нет реальных расходов в системе.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rivn-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/38">Заметки</div>

                  {canManageClientDetails ? (
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                        isSavingNotes
                          ? "cursor-not-allowed bg-white/[0.04] text-white/35"
                          : "rivn-button rivn-button-primary"
                      }`}
                    >
                      {isSavingNotes ? "Сохранение..." : "Сохранить"}
                    </button>
                  ) : (
                    <span className="text-xs text-white/30">Только просмотр</span>
                  )}
                </div>

                <textarea
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Добавь важную информацию о клиенте: договорённости, нюансы, риски, особенности коммуникации..."
                  rows={8}
                  readOnly={!canManageClientDetails}
                  className="rivn-field rivn-textarea mt-4 min-h-[260px] leading-6 placeholder:text-white/30 read-only:cursor-default read-only:opacity-80"
                />
              </div>
            </div>
          </section>

          {canManageClientDetails ? (
            <EditClientModal
              isOpen={isEditOpen}
              onClose={() => setIsEditOpen(false)}
              onSave={handleSave}
              name={editName}
              setName={setEditName}
              owner={editOwner}
              setOwner={setEditOwner}
              ownerId={editOwnerId}
              setOwnerId={setEditOwnerId}
              model={editModel}
              setModel={setEditModel}
              status={editStatus}
              setStatus={setEditStatus}
              nextInvoice={editNextInvoice}
              setNextInvoice={setEditNextInvoice}
              amount={editAmount}
              setAmount={setEditAmount}
              profit={editProfit}
              setProfit={setEditProfit}
              employees={employees}
            />
          ) : null}
        </div>
      </main>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}
