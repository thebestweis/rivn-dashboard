"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppSidebar } from "../../components/layout/app-sidebar";
import { AppTopbar } from "../../components/layout/app-topbar";
import { EditClientModal } from "../../components/clients/edit-client-modal";
import { AppToast } from "../../components/ui/app-toast";
import {
  getExpenses,
  getPayments,
  getPayrollPayouts,
  parseRubAmount,
  formatRub,
  type StoredClient,
  type StoredExpense,
  type StoredPayment,
  type StoredPayrollPayout,
} from "../../lib/storage";
import {
  fetchClientByIdFromSupabase,
  updateClientInSupabase,
} from "../../lib/supabase/clients";
import { ClientFinancialChart } from "../../components/clients/client-financial-chart";

export default function ClientDetailsPage() {
  const params = useParams();
  const clientId = String(params.clientId ?? "");

  const [client, setClient] = useState<StoredClient | null>(null);
  const [isLoadingClient, setIsLoadingClient] = useState(true);

  const [expenses] = useState<StoredExpense[]>(() => getExpenses());
  const [payments] = useState<StoredPayment[]>(() => getPayments());
  const [payrollPayouts] = useState<StoredPayrollPayout[]>(() =>
    getPayrollPayouts()
  );

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const [editName, setEditName] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editStatus, setEditStatus] = useState<
    "active" | "paused" | "problem" | "completed"
  >("active");
  const [editNextInvoice, setEditNextInvoice] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editProfit, setEditProfit] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadClient() {
      try {
        const data = await fetchClientByIdFromSupabase(clientId);

        if (!isMounted) return;

        setClient(data);

        if (data) {
          setEditName(data.name);
          setEditOwner(data.owner);
          setEditModel(data.model);
          setEditStatus(data.status);
          setEditNextInvoice(data.nextInvoice);
          setEditAmount(data.amount);
          setEditProfit(data.profit);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setToastType("error");
          setToastMessage("Не удалось загрузить клиента");
        }
      } finally {
        if (isMounted) {
          setIsLoadingClient(false);
        }
      }
    }

    if (clientId) {
      loadClient();
    } else {
      setIsLoadingClient(false);
    }

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const linkedPayments = useMemo(() => {
    if (!client) return [];

    return payments.filter(
      (payment) =>
        payment.client.trim().toLowerCase() === client.name.trim().toLowerCase()
    );
  }, [payments, client]);

  const linkedExpenses = useMemo(() => {
    if (!client) return [];

    return expenses.filter(
      (expense) =>
        expense.client.trim().toLowerCase() === client.name.trim().toLowerCase()
    );
  }, [expenses, client]);

  const clientRevenueNumber = useMemo(() => {
    return linkedPayments.reduce(
      (sum, item) => sum + parseRubAmount(item.amount),
      0
    );
  }, [linkedPayments]);

  const clientExpensesNumber = useMemo(() => {
    return linkedExpenses.reduce(
      (sum, item) => sum + parseRubAmount(item.amount),
      0
    );
  }, [linkedExpenses]);

  const clientFotNumber = useMemo(() => {
    return payrollPayouts.reduce(
      (sum, item) => sum + parseRubAmount(item.amount),
      0
    );
  }, [payrollPayouts]);

  const clientTaxNumber = useMemo(() => {
    return clientRevenueNumber * 0.07;
  }, [clientRevenueNumber]);

  const clientProfitNumber = useMemo(() => {
    return (
      clientRevenueNumber -
      clientExpensesNumber -
      clientFotNumber -
      clientTaxNumber
    );
  }, [clientRevenueNumber, clientExpensesNumber, clientFotNumber, clientTaxNumber]);

  const paymentsChartData = useMemo(() => {
    if (linkedPayments.length === 0) {
      return [{ label: "Нет оплат", amount: 0 }];
    }

    return linkedPayments.map((payment) => ({
      label: payment.paidAt,
      amount: parseRubAmount(payment.amount),
    }));
  }, [linkedPayments]);

  const expensesChartData = useMemo(() => {
    if (linkedExpenses.length === 0) {
      return [{ label: "Нет расходов", amount: 0 }];
    }

    return linkedExpenses.map((expense) => ({
      label: expense.date,
      amount: parseRubAmount(expense.amount),
    }));
  }, [linkedExpenses]);

  const currentClient = useMemo(() => {
    return {
      id: client?.id ?? clientId,
      name: editName || client?.name || "Unknown client",
      status: editStatus,
      owner: editOwner || client?.owner || "—",
      model: editModel || client?.model || "—",
      nextInvoice: editNextInvoice || client?.nextInvoice || "—",
      amount: editAmount || client?.amount || "—",
      revenue: formatRub(clientRevenueNumber),
      expenses: formatRub(clientExpensesNumber),
      fot: formatRub(clientFotNumber),
      profit: formatRub(clientProfitNumber),
      notes:
        "Клиент стабильно оплачивает услуги. Требует плотного контроля по срокам выставления счёта и прозрачной отчетности.",
    };
  }, [
    client,
    clientId,
    editName,
    editStatus,
    editOwner,
    editModel,
    editNextInvoice,
    editAmount,
    clientRevenueNumber,
    clientExpensesNumber,
    clientFotNumber,
    clientProfitNumber,
  ]);

  async function handleSave(updatedClient: Omit<StoredClient, "id">) {
    if (!client) return;

    try {
      const saved = await updateClientInSupabase(client.id, updatedClient);
      setClient(saved);
      setEditName(saved.name);
      setEditOwner(saved.owner);
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

  if (isLoadingClient) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white">
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1">
            <AppTopbar
              breadcrumbs={[
                { label: "Dashboard", href: "/" },
                { label: "Clients", href: "/clients" },
                { label: "Loading..." },
              ]}
              eyebrow="Карточка клиента"
              title="Загрузка..."
              description="Подгружаем данные клиента из Supabase."
            />

            <div className="px-5 py-6 lg:px-8">
              <div className="rounded-[28px] border border-white/10 bg-[#121826] p-6 text-white/60">
                Загрузка клиента...
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white">
        <div className="flex min-h-screen">
          <AppSidebar />

          <main className="flex-1">
            <AppTopbar
              breadcrumbs={[
                { label: "Dashboard", href: "/" },
                { label: "Clients", href: "/clients" },
                { label: "Client not found" },
              ]}
              eyebrow="Карточка клиента"
              title="Client not found"
              description="Клиент не найден в Supabase."
            />

            <div className="px-5 py-6 lg:px-8">
              <div className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                <p className="text-white/70">
                  Клиент с таким ID не найден. Вернись в раздел Clients и открой карточку из таблицы.
                </p>
              </div>
            </div>
          </main>
        </div>

        {toastMessage ? (
          <AppToast message={toastMessage} type={toastType} />
        ) : null}
      </div>
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
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <main className="flex-1">
          <AppTopbar
            breadcrumbs={[
              { label: "Dashboard", href: "/" },
              { label: "Clients", href: "/clients" },
              { label: currentClient.name },
            ]}
            eyebrow="Карточка клиента"
            title={currentClient.name}
            description="Детальная информация, платежи, расходы, ФОТ и заметки по клиенту."
          />

          <div className="space-y-6 px-5 py-6 lg:px-8">
            <section className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="text-sm text-white/45">Карточка клиента</div>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                    {currentClient.name}
                  </h1>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-sm ${statusTone}`}>
                      {currentClient.status}
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-sm text-white/70">
                      Ответственный: {currentClient.owner}
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-sm text-white/70">
                      Модель: {currentClient.model}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setIsEditOpen(true)}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80"
                  >
                    Редактировать
                  </button>
                  <button className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]">
                    Добавить оплату
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "След. счёт", value: currentClient.nextInvoice },
                { label: "Сумма счёта", value: currentClient.amount },
                { label: "Выручка", value: currentClient.revenue },
                { label: "Расходы", value: currentClient.expenses },
                {
                  label: "Прибыль",
                  value: currentClient.profit,
                  tone: "text-emerald-300",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.28)]"
                >
                  <div className="text-sm text-white/55">{item.label}</div>
                  <div
                    className={`mt-3 text-2xl font-semibold tracking-tight ${
                      item.tone ?? ""
                    }`}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </section>

            <ClientFinancialChart
              paymentsData={paymentsChartData}
              expensesData={expensesChartData}
            />

            <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
              <div className="space-y-6">
                <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                  <div className="text-sm text-white/50">История оплат</div>
                  <div className="mt-4 space-y-3">
                    {linkedPayments.length > 0 ? (
                      linkedPayments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm text-white/45">{payment.paidAt}</div>
                            <div className="mt-1 font-medium">{payment.project}</div>
                          </div>

                          <div className="text-right">
                            <div className="font-medium text-emerald-300">
                              {payment.amount}
                            </div>
                            <div className="mt-1 text-xs text-white/45">
                              {payment.source}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl bg-white/[0.04] px-4 py-6 text-sm text-white/45">
                        У этого клиента пока нет реальных оплат в системе.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                  <div className="text-sm text-white/50">Расходы по клиенту</div>
                  <div className="mt-4 space-y-3">
                    {linkedExpenses.length > 0 ? (
                      linkedExpenses.map((expense) => (
                        <div
                          key={expense.id}
                          className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3"
                        >
                          <div>
                            <div className="text-sm text-white/45">{expense.date}</div>
                            <div className="mt-1 font-medium">{expense.title}</div>
                          </div>

                          <div className="font-medium text-rose-300">
                            {expense.amount}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl bg-white/[0.04] px-4 py-6 text-sm text-white/45">
                        У этого клиента пока нет реальных расходов в системе.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                  <div className="text-sm text-white/50">ФОТ</div>
                  <div className="mt-3 text-3xl font-semibold">
                    {currentClient.fot}
                  </div>
                  <div className="mt-2 text-sm text-white/50">
                    Текущая доля ФОТ, подтянутая из payroll
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                  <div className="text-sm text-white/50">Заметки</div>
                  <p className="mt-4 text-sm leading-6 text-white/75">
                    {currentClient.notes}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <EditClientModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            onSave={handleSave}
            name={editName}
            setName={setEditName}
            owner={editOwner}
            setOwner={setEditOwner}
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
          />
        </main>
      </div>

      {toastMessage ? (
        <AppToast message={toastMessage} type={toastType} />
      ) : null}
    </div>
  );
}