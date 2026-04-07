"use client";

import { AppToast } from "../components/ui/app-toast";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "../components/layout/app-sidebar";
import { PaymentsPageHeader } from "../components/payments/payments-page-header";
import { PlannedPaymentsTable } from "../components/payments/planned-payments-table";
import { FactPaymentsTable } from "../components/payments/fact-payments-table";
import { CreatePaymentModal } from "../components/payments/create-payment-modal";
import { EditPaymentModal } from "../components/payments/edit-payment-modal";
import { EmptyState } from "../components/ui/empty-state";

import {
  sendInvoiceCreatedNotification,
  sendPaymentReceivedNotification,
} from "../lib/notifications-client";

import { generateEntityId, parseRubAmount } from "../lib/storage";
import { fetchClientsFromSupabase } from "../lib/supabase/clients";
import { fetchEmployeesFromSupabase } from "../lib/supabase/employees";
import {
  createPaymentInSupabase,
  deletePaymentFromSupabase,
  getPaymentsFromSupabase,
  updatePaymentInSupabase,
} from "../lib/supabase/payments";
import {
  createPayrollAccrualInSupabase,
  fetchPayrollAccrualsFromSupabase,
  updatePayrollAccrualInSupabase,
  deletePayrollAccrualFromSupabase,
} from "../lib/supabase/payroll";
import { getProjects } from "../lib/supabase/projects";
import type { PaymentFormData } from "../lib/types/payment";

interface ClientItem {
  id: string;
  name?: string;
  clientName?: string;
  title?: string;
  owner?: string;
  ownerId?: string | null;
}

interface ProjectItem {
  id: string;
  name: string;
  client_id: string;
  employee_id?: string | null;
}

interface EmployeeItem {
  id: string;
  name: string;
  role: string;
  payType: "fixed_per_paid_project" | "fixed_salary" | "fixed_salary_plus_project";
  payValue: string;
  isActive: boolean;
}

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

interface PlannedPaymentRow {
  id: string;
  clientId: string;
  client: string;
  projectId: string | null;
  project: string;
  invoiceDate: string;
  paymentDate: string;
  amount: string;
  status: "planned" | "waiting" | "overdue" | "paid";
  notes: string;
  documentUrl: string;
}

type PaymentClientMap = Record<string, string>;

function toSupabaseDate(value: string) {
  if (!value) return "";

  if (value.includes(".")) {
    const [day, month, year] = value.split(".");
    if (!day || !month || !year) return value;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return value;
}

function fromSupabaseDate(value: string | null) {
  if (!value) return "";

  if (value.includes("-")) {
    const [year, month, day] = value.split("-");
    if (!day || !month || !year) return value;
    return `${day}.${month}.${year}`;
  }

  return value;
}

function getPlannedStatus(payment: {
  status: string;
  due_date: string;
}) {
  if (payment.status === "paid") {
    return "paid" as const;
  }

  const today = new Date();
  const dueDate = new Date(payment.due_date);

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    return "overdue" as const;
  }

  return "planned" as const;
}

function getClientDisplayName(client: ClientItem) {
  return client.name || client.clientName || client.title || "Без названия";
}

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<"planned" | "fact">("planned");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [factPayments, setFactPayments] = useState<FactPaymentRow[]>([]);
  const [plannedPayments, setPlannedPayments] = useState<PlannedPaymentRow[]>(
    []
  );
  const [loadingPayments, setLoadingPayments] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [mode, setMode] = useState<"invoice" | "payment">("invoice");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"planned" | "fact">("fact");

  const [newClientId, setNewClientId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newPaidAt, setNewPaidAt] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newDocumentUrl, setNewDocumentUrl] = useState("");

  const [editClientId, setEditClientId] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editPaidAt, setEditPaidAt] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editDocumentUrl, setEditDocumentUrl] = useState("");

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const plannedTotal = plannedPayments.reduce(
    (sum, item) => sum + parseRubAmount(item.amount),
    0
  );

  const overdueTotal = plannedPayments
    .filter((item) => item.status === "overdue")
    .reduce((sum, item) => sum + parseRubAmount(item.amount), 0);

  const paidTotal = factPayments.reduce(
    (sum, item) => sum + parseRubAmount(item.amount),
    0
  );

  const projectsMap = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project]));
  }, [projects]);

  function getClientNameById(id: string) {
    const client = clients.find((c) => c.id === id);
    return client ? getClientDisplayName(client) : "Клиент";
  }

  function getProjectNameById(id: string | null | undefined) {
    if (!id) return "";
    return projectsMap.get(id)?.name ?? "";
  }

  async function syncPayrollAccrualForPayment(params: {
    paymentId: string;
    clientId: string;
    projectId: string | null;
    paidAt: string;
    shouldExist: boolean;
  }) {
    const allAccruals = await fetchPayrollAccrualsFromSupabase();
    const existingAccrual = allAccruals.find(
      (accrual) => accrual.paymentId === params.paymentId
    );

    if (!params.shouldExist) {
      if (existingAccrual) {
        await deletePayrollAccrualFromSupabase(existingAccrual.id);
      }
      return;
    }

    if (!params.projectId) {
      if (existingAccrual) {
        await deletePayrollAccrualFromSupabase(existingAccrual.id);
      }
      return;
    }

    const project = projects.find((item) => item.id === params.projectId);
    const client = clients.find((item) => item.id === params.clientId);

    if (!project || !client || !project.employee_id) {
      if (existingAccrual) {
        await deletePayrollAccrualFromSupabase(existingAccrual.id);
      }
      return;
    }

    const employee = employees.find(
      (item) =>
        item.id === project.employee_id &&
        item.isActive &&
        (item.payType === "fixed_per_paid_project" ||
          item.payType === "fixed_salary_plus_project")
    );

    if (!employee) {
      if (existingAccrual) {
        await deletePayrollAccrualFromSupabase(existingAccrual.id);
      }
      return;
    }

    const nextAccrualData = {
      employee: employee.name,
      employeeId: employee.id,
      client: getClientDisplayName(client),
      clientId: client.id,
      project: project.name,
      projectId: project.id,
      paymentId: params.paymentId,
      amount: employee.payValue,
      date: params.paidAt,
      status: "accrued" as const,
    };

    if (existingAccrual) {
      await updatePayrollAccrualInSupabase(existingAccrual.id, nextAccrualData);
      return;
    }

    await createPayrollAccrualInSupabase({
      id: generateEntityId("payroll_accrual"),
      ...nextAccrualData,
    });
  }

  async function loadPaymentsData() {
    try {
      setLoadingPayments(true);

      const [clientsData, projectsData, employeesData, paymentsData] =
        await Promise.all([
          fetchClientsFromSupabase(),
          getProjects(),
          fetchEmployeesFromSupabase(),
          getPaymentsFromSupabase(),
        ]);

      const safeClients = (clientsData ?? []) as ClientItem[];
      const safeProjects = (projectsData ?? []) as ProjectItem[];
      const safeEmployees = (employeesData ?? []) as EmployeeItem[];

      setClients(safeClients);
      setProjects(safeProjects);
      setEmployees(safeEmployees);

      const clientMap = safeClients.reduce<PaymentClientMap>((acc, client) => {
        acc[client.id] = getClientDisplayName(client);
        return acc;
      }, {});

      const projectMap = safeProjects.reduce<Record<string, string>>((acc, project) => {
        acc[project.id] = project.name;
        return acc;
      }, {});

      const mappedFactPayments: FactPaymentRow[] = paymentsData
        .filter((payment) => payment.status === "paid")
        .map((payment) => ({
          id: payment.id,
          clientId: payment.client_id,
          client: clientMap[payment.client_id] ?? "Неизвестный клиент",
          projectId: payment.project_id ?? null,
          project: payment.project_id ? projectMap[payment.project_id] ?? "" : "",
          paidAt: fromSupabaseDate(payment.paid_date),
          amount: String(payment.amount),
          source: payment.notes ?? "",
          documentUrl: payment.document_url ?? "",
        }));

      const mappedPlannedPayments: PlannedPaymentRow[] = paymentsData
        .filter((payment) => payment.status !== "paid")
        .map((payment) => ({
          id: payment.id,
          clientId: payment.client_id,
          client: clientMap[payment.client_id] ?? "Неизвестный клиент",
          projectId: payment.project_id ?? null,
          project: payment.project_id ? projectMap[payment.project_id] ?? "" : "",
          invoiceDate: fromSupabaseDate(payment.created_at?.slice(0, 10) ?? null),
          paymentDate: fromSupabaseDate(payment.due_date),
          amount: `₽${Number(payment.amount).toLocaleString("ru-RU")}`,
          status: getPlannedStatus(payment),
          notes: payment.notes ?? "",
          documentUrl: payment.document_url ?? "",
        }));

      const sortedPlanned = mappedPlannedPayments.sort((a, b) => {
        if (a.status === "overdue" && b.status !== "overdue") return -1;
        if (a.status !== "overdue" && b.status === "overdue") return 1;
        return 0;
      });

      setFactPayments(mappedFactPayments);
      setPlannedPayments(sortedPlanned);
    } catch (error) {
      console.error("Ошибка загрузки payments:", error);
      setToastType("error");
      setToastMessage("Не удалось загрузить оплаты");
    } finally {
      setLoadingPayments(false);
    }
  }

  useEffect(() => {
    loadPaymentsData();
  }, []);

  async function handleCreatePayment(payment: {
    clientId: string;
    projectId: string;
    paidAt: string;
    amount: string;
    source: string;
    documentUrl: string;
  }) {
    try {
      if (!payment.clientId) {
        setToastType("error");
        setToastMessage("Выбери клиента");
        return;
      }

      if (!payment.projectId) {
        setToastType("error");
        setToastMessage("Выбери проект");
        return;
      }

      const supabaseDate = toSupabaseDate(payment.paidAt);
      const isInvoice = mode === "invoice";

      const payload: PaymentFormData = {
        client_id: payment.clientId,
        project_id: payment.projectId,
        amount: parseRubAmount(payment.amount),
        due_date: supabaseDate,
        paid_date: isInvoice ? null : supabaseDate,
        status: isInvoice ? "pending" : "paid",
        period_label: getProjectNameById(payment.projectId),
        notes: payment.source,
        document_url: payment.documentUrl || null,
      };

      const createdPayment = await createPaymentInSupabase(payload);

      await syncPayrollAccrualForPayment({
        paymentId: createdPayment.id,
        clientId: payment.clientId,
        projectId: payment.projectId,
        paidAt: payment.paidAt,
        shouldExist: !isInvoice,
      });

      if (!isInvoice) {
  try {
    await sendPaymentReceivedNotification({
      paymentId: createdPayment.id,
      clientName: getClientNameById(payment.clientId),
      projectName: getProjectNameById(payment.projectId),
      amount: payment.amount,
      paidAt: payment.paidAt,
    });
  } catch (notificationError) {
    console.error(
      "Ошибка отправки Telegram-уведомления о полученной оплате:",
      notificationError
    );
  }
}

if (isInvoice) {
  try {
    await sendInvoiceCreatedNotification({
      paymentId: createdPayment.id,
      clientName: getClientNameById(payment.clientId),
      projectName: getProjectNameById(payment.projectId),
      amount: payment.amount,
      dueDate: payment.paidAt,
    });
  } catch (notificationError) {
    console.error(
      "Ошибка отправки Telegram-уведомления о создании счёта:",
      notificationError
    );
  }
}

      setIsCreateOpen(false);
      setNewClientId("");
      setNewProjectId("");
      setNewPaidAt("");
      setNewAmount("");
      setNewSource("");
      setNewDocumentUrl("");

      await loadPaymentsData();

      setActiveTab(isInvoice ? "planned" : "fact");
      setToastType("success");
      setToastMessage(isInvoice ? "Счёт создан" : "Оплата создана");
    } catch (error) {
      console.error("Ошибка создания payment:", error);
      const message =
        error instanceof Error ? error.message : "Не удалось создать";
      setToastType("error");
      setToastMessage(message);
    }
  }

  function handleStartEdit(payment: FactPaymentRow) {
    if (!payment.clientId) {
      setToastType("error");
      setToastMessage("Не удалось определить клиента");
      return;
    }

    setEditMode("fact");
    setEditingPaymentId(payment.id);
    setEditClientId(payment.clientId);
    setEditProjectId(payment.projectId ?? "");
    setEditPaidAt(
      payment.paidAt.includes(".")
        ? toSupabaseDate(payment.paidAt)
        : payment.paidAt
    );
    setEditAmount(payment.amount);
    setEditSource(payment.source);
    setEditDocumentUrl(payment.documentUrl ?? "");
    setIsEditOpen(true);
  }

  function handleStartEditPlanned(paymentId: string) {
    const target = plannedPayments.find((item) => item.id === paymentId);

    if (!target) {
      setToastType("error");
      setToastMessage("Счёт не найден");
      return;
    }

    setEditMode("planned");
    setEditingPaymentId(target.id);
    setEditClientId(target.clientId);
    setEditProjectId(target.projectId ?? "");
    setEditPaidAt(
      target.paymentDate.includes(".")
        ? toSupabaseDate(target.paymentDate)
        : target.paymentDate
    );
    setEditAmount(target.amount);
    setEditSource(target.notes);
    setEditDocumentUrl(target.documentUrl);
    setIsEditOpen(true);
  }

  async function handleSaveEdit(updatedPayment: {
    clientId: string;
    projectId: string;
    paidAt: string;
    amount: string;
    source: string;
    documentUrl: string;
  }) {
    if (!editingPaymentId) return;

    try {
      if (!updatedPayment.clientId) {
        setToastType("error");
        setToastMessage("Выбери клиента");
        return;
      }

      if (!updatedPayment.projectId) {
        setToastType("error");
        setToastMessage("Выбери проект");
        return;
      }

      const supabaseDate = toSupabaseDate(updatedPayment.paidAt);
      const shouldExist = editMode === "fact";

      const payload: PaymentFormData = {
        client_id: updatedPayment.clientId,
        project_id: updatedPayment.projectId,
        amount: parseRubAmount(updatedPayment.amount),
        due_date: supabaseDate,
        paid_date: shouldExist ? supabaseDate : null,
        status: shouldExist ? "paid" : "pending",
        period_label: getProjectNameById(updatedPayment.projectId),
        notes: updatedPayment.source,
        document_url: updatedPayment.documentUrl || null,
      };

      await updatePaymentInSupabase(editingPaymentId, payload);

      await syncPayrollAccrualForPayment({
        paymentId: editingPaymentId,
        clientId: updatedPayment.clientId,
        projectId: updatedPayment.projectId,
        paidAt: fromSupabaseDate(supabaseDate),
        shouldExist,
      });

      setIsEditOpen(false);
      setEditingPaymentId(null);

      await loadPaymentsData();

      setToastType("success");
      setToastMessage(
        editMode === "planned" ? "Счёт сохранён" : "Оплата сохранена"
      );
    } catch (error) {
      console.error("Ошибка обновления payment:", error);
      const message =
        error instanceof Error ? error.message : "Не удалось сохранить";
      setToastType("error");
      setToastMessage(message);
    }
  }

  async function handleMarkAsPaid(id: string) {
    try {
      const target = plannedPayments.find((item) => item.id === id);

      if (!target) {
        setToastType("error");
        setToastMessage("Счёт не найден");
        return;
      }

      if (!target.clientId || !target.projectId) {
        setToastType("error");
        setToastMessage("У счёта не хватает клиента или проекта");
        return;
      }

      const paymentDate = new Date().toISOString().slice(0, 10);

      const payload: PaymentFormData = {
        client_id: target.clientId,
        project_id: target.projectId,
        amount: parseRubAmount(target.amount),
        due_date: toSupabaseDate(target.paymentDate),
        paid_date: paymentDate,
        status: "paid",
        period_label: getProjectNameById(target.projectId),
        notes: target.notes,
        document_url: target.documentUrl || null,
      };

      await updatePaymentInSupabase(id, payload);

      await syncPayrollAccrualForPayment({
        paymentId: id,
        clientId: target.clientId,
        projectId: target.projectId,
        paidAt: fromSupabaseDate(paymentDate),
        shouldExist: true,
      });

      try {
  await sendPaymentReceivedNotification({
    paymentId: id,
    clientName: target.client,
    projectName: target.project,
    amount: target.amount,
    paidAt: fromSupabaseDate(paymentDate),
  });
} catch (notificationError) {
  console.error(
    "Ошибка отправки Telegram-уведомления о полученной оплате:",
    notificationError
  );
}

      await loadPaymentsData();

      setToastType("success");
      setToastMessage(`Счёт для "${target.client}" отмечен как оплаченный`);
    } catch (error) {
      console.error("Ошибка отметки оплаты:", error);
      const message =
        error instanceof Error ? error.message : "Не удалось отметить оплату";
      setToastType("error");
      setToastMessage(message);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    const target =
      factPayments.find((item) => item.id === paymentId) ||
      plannedPayments.find((item) => item.id === paymentId);

    if (!target) {
      setToastType("error");
      setToastMessage("Оплата не найдена");
      return;
    }

    const confirmed = window.confirm(
      `Удалить оплату "${target.client}" на сумму ${target.amount}? Это действие нельзя отменить.`
    );

    if (!confirmed) return;

    try {
      await deletePaymentFromSupabase(paymentId);

      await syncPayrollAccrualForPayment({
        paymentId,
        clientId: "",
        projectId: null,
        paidAt: "",
        shouldExist: false,
      });

      if (editingPaymentId === paymentId) {
        setIsEditOpen(false);
        setEditingPaymentId(null);
      }

      await loadPaymentsData();

      setToastType("success");
      setToastMessage(`Оплата для "${target.client}" удалена`);
    } catch (error) {
      console.error("Ошибка удаления payment:", error);
      const message =
        error instanceof Error ? error.message : "Не удалось удалить оплату";
      setToastType("error");
      setToastMessage(message);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <main className="flex-1">
          <div className="space-y-6 px-5 py-6 lg:px-8">
            <PaymentsPageHeader
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onCreateInvoice={() => {
                setMode("invoice");
                setIsCreateOpen(true);
              }}
              onCreatePayment={() => {
                setMode("payment");
                setIsCreateOpen(true);
              }}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#121826] p-4">
                <div className="text-xs uppercase tracking-wide text-white/40">
                  Ожидается
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">
                  ₽{plannedTotal.toLocaleString("ru-RU")}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#121826] p-4">
                <div className="text-xs uppercase tracking-wide text-white/40">
                  Просрочено
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-rose-400">
                  ₽{overdueTotal.toLocaleString("ru-RU")}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#121826] p-4">
                <div className="text-xs uppercase tracking-wide text-white/40">
                  Получено
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-emerald-400">
                  ₽{paidTotal.toLocaleString("ru-RU")}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("planned")}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      activeTab === "planned"
                        ? "bg-white text-[#0B0F1A]"
                        : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    Плановые счета
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("fact")}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      activeTab === "fact"
                        ? "bg-white text-[#0B0F1A]"
                        : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    Оплаченные счета
                  </button>
                </div>
              </div>

              {activeTab === "planned" ? (
                loadingPayments ? (
                  <EmptyState
                    title="Загрузка счетов..."
                    description="Подгружаем данные из Supabase."
                  />
                ) : plannedPayments.length > 0 ? (
                  <PlannedPaymentsTable
                    items={plannedPayments}
                    onMarkPaid={handleMarkAsPaid}
                    onEdit={handleStartEditPlanned}
                    onDelete={handleDeletePayment}
                  />
                ) : (
                  <EmptyState
                    title="Плановых счетов пока нет"
                    description="Когда ты добавишь плановые счета, они появятся здесь."
                  />
                )
              ) : loadingPayments ? (
                <EmptyState
                  title="Загрузка оплат..."
                  description="Подгружаем данные из Supabase."
                />
              ) : factPayments.length > 0 ? (
                <FactPaymentsTable
                  items={factPayments}
                  onEdit={handleStartEdit}
                  onDelete={handleDeletePayment}
                />
              ) : (
                <EmptyState
                  title="Оплаченных счетов пока нет"
                  description="Добавь первую оплату, чтобы видеть фактически полученные деньги."
                  actionLabel="Добавить оплату"
                  onAction={() => {
                    setMode("payment");
                    setIsCreateOpen(true);
                  }}
                />
              )}
            </div>
          </div>

          <CreatePaymentModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onCreate={handleCreatePayment}
            clients={clients}
            projects={projects}
            clientId={newClientId}
            setClientId={setNewClientId}
            projectId={newProjectId}
            setProjectId={setNewProjectId}
            paidAt={newPaidAt}
            setPaidAt={setNewPaidAt}
            amount={newAmount}
            setAmount={setNewAmount}
            source={newSource}
            setSource={setNewSource}
            documentUrl={newDocumentUrl}
            setDocumentUrl={setNewDocumentUrl}
            mode={mode}
          />

          <EditPaymentModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            onSave={handleSaveEdit}
            clientId={editClientId}
            setClientId={setEditClientId}
            projectId={editProjectId}
            setProjectId={setEditProjectId}
            paidAt={editPaidAt}
            setPaidAt={setEditPaidAt}
            amount={editAmount}
            setAmount={setEditAmount}
            source={editSource}
            setSource={setEditSource}
            clients={clients}
            projects={projects}
            mode={editMode}
            documentUrl={editDocumentUrl}
            setDocumentUrl={setEditDocumentUrl}
          />
        </main>
      </div>

      {toastMessage ? (
        <AppToast message={toastMessage} type={toastType} />
      ) : null}
    </div>
  );
}