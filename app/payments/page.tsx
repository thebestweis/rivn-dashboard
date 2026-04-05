"use client";

import { AppToast } from "../components/ui/app-toast";
import { useEffect, useState } from "react";
import { AppSidebar } from "../components/layout/app-sidebar";
import { AppTopbar } from "../components/layout/app-topbar";
import { PaymentsPageHeader } from "../components/payments/payments-page-header";
import { PlannedPaymentsTable } from "../components/payments/planned-payments-table";
import { FactPaymentsTable } from "../components/payments/fact-payments-table";
import { CreatePaymentModal } from "../components/payments/create-payment-modal";
import { EditPaymentModal } from "../components/payments/edit-payment-modal";
import { EmptyState } from "../components/ui/empty-state";
import { parseRubAmount } from "../lib/storage";
import { fetchClientsFromSupabase } from "../lib/supabase/clients";
import {
  createPaymentInSupabase,
  deletePaymentFromSupabase,
  getPaymentsFromSupabase,
  updatePaymentInSupabase,
} from "../lib/supabase/payments";
import type { PaymentFormData } from "../lib/types/payment";

interface ClientItem {
  id: string;
  name?: string;
  clientName?: string;
  title?: string;
}

interface FactPaymentRow {
  id: string;
  client: string;
  project: string;
  paidAt: string;
  amount: string;
  source: string;
}

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
  const [factPayments, setFactPayments] = useState<FactPaymentRow[]>([]);
  const [plannedPayments, setPlannedPayments] = useState<PlannedPaymentRow[]>(
    []
  );
  const [paymentClientMap, setPaymentClientMap] = useState<PaymentClientMap>(
    {}
  );
  const [loadingPayments, setLoadingPayments] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [mode, setMode] = useState<"invoice" | "payment">("invoice");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"planned" | "fact">("fact");

  const [newClient, setNewClient] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newPaidAt, setNewPaidAt] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newDocumentUrl, setNewDocumentUrl] = useState("");

  const [editClient, setEditClient] = useState("");
const [editProject, setEditProject] = useState("");
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
  function getClientNameById(id: string) {
    const client = clients.find((c) => c.id === id);
    return client ? getClientDisplayName(client) : "Клиент";
  }

  function findClientIdByName(name: string) {
    const normalized = name.trim().toLowerCase();

    const targetClient = clients.find((client) => {
      const displayName = getClientDisplayName(client).trim().toLowerCase();
      return displayName === normalized;
    });

    return targetClient?.id ?? null;
  }

  async function loadPaymentsData() {
    try {
      setLoadingPayments(true);

      const [clientsData, paymentsData] = await Promise.all([
        fetchClientsFromSupabase(),
        getPaymentsFromSupabase(),
      ]);

      const safeClients = (clientsData ?? []) as ClientItem[];
      setClients(safeClients);

      const clientMap = safeClients.reduce<PaymentClientMap>((acc, client) => {
        acc[client.id] = getClientDisplayName(client);
        return acc;
      }, {});

      setPaymentClientMap(clientMap);

      const mappedFactPayments: FactPaymentRow[] = paymentsData
        .filter((payment) => payment.status === "paid")
        .map((payment) => ({
          id: payment.id,
          client: clientMap[payment.client_id] ?? "Неизвестный клиент",
          project: payment.period_label ?? "",
          paidAt: fromSupabaseDate(payment.paid_date),
          amount: String(payment.amount),
          source: payment.notes ?? "",
        }));

      const mappedPlannedPayments: PlannedPaymentRow[] = paymentsData
  .filter((payment) => payment.status !== "paid")
  .map((payment) => ({
    id: payment.id,
    client: clientMap[payment.client_id] ?? "Неизвестный клиент",
    project: payment.period_label ?? "",
    invoiceDate: fromSupabaseDate(payment.created_at?.slice(0, 10) ?? null),
    paymentDate: fromSupabaseDate(payment.due_date),
    amount: `₽${Number(payment.amount).toLocaleString("ru-RU")}`,
    status: getPlannedStatus(payment),
    notes: payment.notes ?? "",
    documentUrl: "",
  }));
const sortedPlanned = mappedPlannedPayments.sort((a, b) => {
  if (a.status === "overdue" && b.status !== "overdue") return -1;
  if (a.status !== "overdue" && b.status === "overdue") return 1;
  return 0;
});

setPlannedPayments(sortedPlanned);
      setFactPayments(mappedFactPayments);
      setPlannedPayments(mappedPlannedPayments);
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
  client: string;
  project: string;
  paidAt: string;
  amount: string;
  source: string;
  documentUrl: string;
}) {
  try {
    const clientId = payment.client;

    if (!clientId) {
      setToastType("error");
      setToastMessage("Выбери клиента");
      return;
    }

    const supabaseDate = toSupabaseDate(payment.paidAt);
    const isInvoice = mode === "invoice";

    const payload: PaymentFormData = {
      client_id: clientId,
      amount: parseRubAmount(payment.amount),
      due_date: supabaseDate,
      paid_date: isInvoice ? null : supabaseDate,
      status: isInvoice ? "pending" : "paid",
      period_label: payment.project,
      notes: payment.source,
      document_url: payment.documentUrl || null,
    };

    await createPaymentInSupabase(payload);

    setIsCreateOpen(false);
    setNewClient("");
    setNewProject("");
    setNewPaidAt("");
    setNewAmount("");
    setNewSource("");
    setNewDocumentUrl("");

    await loadPaymentsData();

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
  const clientId = findClientIdByName(payment.client);

  if (!clientId) {
    setToastType("error");
    setToastMessage("Не удалось определить клиента");
    return;
  }

  setEditMode("fact");
  setEditingPaymentId(payment.id);
  setEditClient(clientId);
  setEditProject(payment.project);
  setEditPaidAt(payment.paidAt);
  setEditAmount(payment.amount);
  setEditSource(payment.source);
  setEditDocumentUrl("");
  setIsEditOpen(true);
}
function handleStartEditPlanned(paymentId: string) {
  const target = plannedPayments.find((item) => item.id === paymentId);

  if (!target) {
    setToastType("error");
    setToastMessage("Счёт не найден");
    return;
  }

  const clientId = findClientIdByName(target.client);

  if (!clientId) {
    setToastType("error");
    setToastMessage("Не удалось определить клиента");
    return;
  }

  setEditMode("planned");
  setEditingPaymentId(target.id);
  setEditClient(clientId);
  setEditProject(target.project);
  setEditPaidAt(target.paymentDate);
  setEditAmount(target.amount);
  setEditSource(target.notes);
  setEditDocumentUrl(target.documentUrl);
  setIsEditOpen(true);
}
  async function handleSaveEdit(updatedPayment: {
  client: string;
  project: string;
  paidAt: string;
  amount: string;
  source: string;
  documentUrl: string;
}) {
  if (!editingPaymentId) return;

  try {
    const clientId = updatedPayment.client;

    if (!clientId) {
      setToastType("error");
      setToastMessage("Выбери клиента");
      return;
    }

    const supabaseDate = toSupabaseDate(updatedPayment.paidAt);

    const payload: PaymentFormData = {
  client_id: clientId,
  amount: parseRubAmount(updatedPayment.amount),
  due_date: supabaseDate,
  paid_date: editMode === "planned" ? null : supabaseDate,
  status: editMode === "planned" ? "pending" : "paid",
  period_label: updatedPayment.project,
  notes: updatedPayment.source,
  document_url: updatedPayment.documentUrl || null,
};
    await updatePaymentInSupabase(editingPaymentId, payload);

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

    const paymentDate = new Date().toISOString().slice(0, 10);

    const clientId = findClientIdByName(target.client);

    if (!clientId) {
      setToastType("error");
      setToastMessage("Не удалось определить клиента для счёта");
      return;
    }

    const payload: PaymentFormData = {
      client_id: clientId,
      amount: parseRubAmount(target.amount),
      due_date: toSupabaseDate(target.paymentDate),
      paid_date: paymentDate,
      status: "paid",
      period_label: target.project,
      notes: "",
    };

    await updatePaymentInSupabase(id, payload);

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
          <AppTopbar
            eyebrow="Раздел"
            title="Payments"
            description="Контроль счетов, ожидаемых поступлений, фактических оплат и просрочек."
          />

          <div className="space-y-6 px-5 py-6 lg:px-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
  <div className="rounded-2xl border border-white/10 bg-[#121826] p-4">
    <div className="text-xs uppercase tracking-wide text-white/40">Ожидается</div>
    <div className="mt-1 text-2xl font-semibold tracking-tight">
      ₽{plannedTotal.toLocaleString("ru-RU")}
    </div>
  </div>

  <div className="rounded-2xl border border-white/10 bg-[#121826] p-4">
    <div className="text-xs uppercase tracking-wide text-white/40">Просрочено</div>
    <div className="mt-1 text-2xl font-semibold tracking-tight text-rose-400">
      ₽{overdueTotal.toLocaleString("ru-RU")}
    </div>
  </div>

  <div className="rounded-2xl border border-white/10 bg-[#121826] p-4">
    <div className="text-xs uppercase tracking-wide text-white/40">Получено</div>
    <div className="mt-1 text-2xl font-semibold tracking-tight text-emerald-400">
      ₽{paidTotal.toLocaleString("ru-RU")}
    </div>
  </div>
</div>
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
                title="Фактических оплат пока нет"
                description="Добавь первую оплату, чтобы видеть реальную выручку и аналитику."
                actionLabel="Добавить оплату"
                onAction={() => setIsCreateOpen(true)}
              />
            )}
          </div>

          <CreatePaymentModal
  isOpen={isCreateOpen}
  onClose={() => setIsCreateOpen(false)}
  onCreate={handleCreatePayment}
  clients={clients}
  client={newClient}
  setClient={setNewClient}
  project={newProject}
  setProject={setNewProject}
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
  client={editClient}
  setClient={setEditClient}
  project={editProject}
  setProject={setEditProject}
  paidAt={editPaidAt}
  setPaidAt={setEditPaidAt}
  amount={editAmount}
  setAmount={setEditAmount}
  source={editSource}
  setSource={setEditSource}
  clients={clients}
  mode={editMode}
  documentUrl={editDocumentUrl}
  setDocumentUrl={setEditDocumentUrl}
/>
        </main>
      </div>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </div>
  );
}