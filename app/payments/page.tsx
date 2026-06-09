"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../lib/query-keys";
import { useAppContextState } from "../providers/app-context-provider";

import { AppToast } from "../components/ui/app-toast";
import { PaymentsPageHeader } from "../components/payments/payments-page-header";
import { PlannedPaymentsTable } from "../components/payments/planned-payments-table";
import { FactPaymentsTable } from "../components/payments/fact-payments-table";
import { CreatePaymentModal } from "../components/payments/create-payment-modal";
import { EditPaymentModal } from "../components/payments/edit-payment-modal";
import { EmptyState } from "../components/ui/empty-state";
import { Skeleton } from "../components/ui/skeleton";
import { useConfirmDialog } from "../components/ui/confirm-dialog-provider";
import { RivnDateRangePicker } from "../components/ui/rivn-date-picker";

import { AccessDenied } from "../components/access/access-denied";
import { usePageAccess } from "../lib/use-page-access";
import { useSectionPermission } from "../lib/use-section-permission";
import {
  sendInvoiceCreatedNotification,
  sendPaymentReceivedNotification,
} from "../lib/notifications-client";
import { formatDisplayDate, parseRubAmount } from "../lib/storage";
import type { PaymentFormData } from "../lib/types/payment";
import type {
  PaymentSortDirection,
  PaymentSortField,
} from "../lib/supabase/payments";
import {
  createPaymentInSupabase,
  deletePaymentFromSupabase,
  updatePaymentInSupabase,
} from "../lib/supabase/payments";
import {
  usePaymentClientsQuery,
  usePaymentProjectsQuery,
  usePaymentsQuery,
} from "../lib/queries/use-payments-query";

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
type DatePreset = "month" | "7d" | "30d" | "all" | "custom";

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    from: toInputDate(start),
    to: toInputDate(now),
  };
}

function getPresetRange(preset: DatePreset) {
  const now = new Date();

  if (preset === "all" || preset === "custom") {
    return { from: "", to: "" };
  }

  if (preset === "month") {
    return getCurrentMonthRange();
  }

  const days = preset === "7d" ? 7 : 30;
  const start = new Date(now);
  start.setDate(now.getDate() - days + 1);

  return {
    from: toInputDate(start),
    to: toInputDate(now),
  };
}

function formatPeriodDate(value: string) {
  return value ? formatDisplayDate(value) : "";
}

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
  return formatDisplayDate(value);
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

function compareText(a: string, b: string, direction: PaymentSortDirection) {
  const result = a.localeCompare(b, "ru", { sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

function PaymentsStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rivn-card p-4"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-36" />
        </div>
      ))}
    </div>
  );
}

function PaymentsTableSkeleton() {
  return (
    <div className="rivn-card p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36 rounded-full" />
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>
      </div>

      <div className="rivn-table-wrap overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-6 gap-4 bg-white/[0.04] px-4 py-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>

        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid min-w-[760px] grid-cols-6 gap-4 border-t border-white/[0.055] px-4 py-4"
          >
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";
  const { confirm } = useConfirmDialog();

  const {
    isLoading: isAccessLoading,
    hasAccess,
  } = usePageAccess("payments");

  const { isLoading: isPermissionLoading, canManage } =
    useSectionPermission("payments");

  const [activeTab, setActiveTab] = useState<"planned" | "fact">("planned");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<PaymentSortField>("due_date");
  const [sortDirection, setSortDirection] =
    useState<PaymentSortDirection>("asc");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(
    null
  );
  const [mode, setMode] = useState<"invoice" | "payment">("invoice");
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(
    null
  );
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

  const {
    data: clients = [],
    isLoading: isClientsLoading,
    error: clientsError,
  } = usePaymentClientsQuery(hasAccess);

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = usePaymentProjectsQuery(hasAccess);

  const {
    data: paymentsData = [],
    isLoading: isPaymentsLoading,
    error: paymentsError,
  } = usePaymentsQuery(hasAccess, {
    status: activeTab === "fact" ? "paid" : "planned",
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortDirection,
  });

  useEffect(() => {
    setSortBy(activeTab === "fact" ? "paid_date" : "due_date");
    setSortDirection(activeTab === "fact" ? "desc" : "asc");
  }, [activeTab]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

    const loadingPayments =
    isClientsLoading ||
    isProjectsLoading ||
    isPaymentsLoading;

    useEffect(() => {
    const firstError =
      clientsError || projectsError || paymentsError;

    if (!firstError) return;

    console.error("Ошибка загрузки payments:", firstError);
    setToastType("error");
    setToastMessage(
      firstError instanceof Error
        ? firstError.message
        : "Не удалось загрузить оплаты"
    );
    }, [clientsError, projectsError, paymentsError]);

  const clientMap = useMemo<PaymentClientMap>(() => {
    const safeClients = (clients ?? []) as ClientItem[];

    return safeClients.reduce<PaymentClientMap>((acc, client) => {
      acc[client.id] = getClientDisplayName(client);
      return acc;
    }, {});
  }, [clients]);

  const projectNameMap = useMemo(() => {
    const safeProjects = (projects ?? []) as ProjectItem[];

    return safeProjects.reduce<Record<string, string>>((acc, project) => {
      acc[project.id] = project.name;
      return acc;
    }, {});
  }, [projects]);

  const factPayments = useMemo<FactPaymentRow[]>(() => {
    if (!hasAccess) return [];

    const mapped = paymentsData
      .filter((payment) => payment.status === "paid")
      .map((payment) => ({
        id: payment.id,
        clientId: payment.client_id,
        client: clientMap[payment.client_id] ?? "Неизвестный клиент",
        projectId: payment.project_id ?? null,
        project: payment.project_id ? projectNameMap[payment.project_id] ?? "" : "",
        paidAt: fromSupabaseDate(payment.paid_date),
        amount: String(payment.amount),
        source: payment.notes ?? "",
        documentUrl: payment.document_url ?? "",
      }));

    if (sortBy === "client") {
      return [...mapped].sort((a, b) => compareText(a.client, b.client, sortDirection));
    }

    if (sortBy === "project") {
      return [...mapped].sort((a, b) => compareText(a.project, b.project, sortDirection));
    }

    return mapped;
  }, [hasAccess, paymentsData, clientMap, projectNameMap, sortBy, sortDirection]);

  const plannedPayments = useMemo<PlannedPaymentRow[]>(() => {
    if (!hasAccess) return [];

    const mapped = paymentsData
      .filter((payment) => payment.status !== "paid")
      .map((payment) => ({
        id: payment.id,
        clientId: payment.client_id,
        client: clientMap[payment.client_id] ?? "Неизвестный клиент",
        projectId: payment.project_id ?? null,
        project: payment.project_id ? projectNameMap[payment.project_id] ?? "" : "",
        invoiceDate: fromSupabaseDate(payment.created_at?.slice(0, 10) ?? null),
        paymentDate: fromSupabaseDate(payment.due_date),
        amount: `₽${Number(payment.amount).toLocaleString("ru-RU")}`,
        status: getPlannedStatus(payment),
        notes: payment.notes ?? "",
        documentUrl: payment.document_url ?? "",
      }));

    if (sortBy === "client") {
      return [...mapped].sort((a, b) => compareText(a.client, b.client, sortDirection));
    }

    if (sortBy === "project") {
      return [...mapped].sort((a, b) => compareText(a.project, b.project, sortDirection));
    }

    if (sortBy !== "status") {
      return mapped;
    }

    return [...mapped].sort((a, b) => {
      const priorities = { overdue: 0, waiting: 1, planned: 1, paid: 2 };
      const result = priorities[a.status] - priorities[b.status];
      return sortDirection === "asc" ? result : -result;
    });
  }, [hasAccess, paymentsData, clientMap, projectNameMap, sortBy, sortDirection]);

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

  function handleDatePresetChange(preset: DatePreset) {
    const range = getPresetRange(preset);
    setDatePreset(preset);
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function handleDateFromChange(value: string) {
    setDatePreset("all");
    setDateFrom(value);
  }

  function handleDateToChange(value: string) {
    setDatePreset("all");
    setDateTo(value);
  }

  function handleDateRangeChange(range: { from: string; to: string }) {
    setDatePreset(range.from || range.to ? "custom" : "all");
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function handleSort(field: string) {
    const nextField = field as PaymentSortField;

    if (sortBy === nextField) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextField);
    setSortDirection(
      nextField === "client" || nextField === "project" ? "asc" : "desc"
    );
  }

  function showNoAccessMessage() {
    setToastType("error");
    setToastMessage("У тебя нет прав на управление платежами");
  }

  function getClientNameById(id: string) {
    const client = clients.find((c) => c.id === id);
    return client ? getClientDisplayName(client) : "Клиент";
  }

  function getProjectNameById(id: string | null | undefined) {
    if (!id) return "";
    return projectsMap.get(id)?.name ?? "";
  }

  function resetCreateForm() {
    setNewClientId("");
    setNewProjectId("");
    setNewPaidAt("");
    setNewAmount("");
    setNewSource("");
    setNewDocumentUrl("");
  }

  function resetEditForm() {
    setEditClientId("");
    setEditProjectId("");
    setEditPaidAt("");
    setEditAmount("");
    setEditSource("");
    setEditDocumentUrl("");
    setEditingPaymentId(null);
    setEditMode("fact");
  }

  useEffect(() => {
    if (canManage) return;

    setIsCreateOpen(false);
    setIsEditOpen(false);
    resetEditForm();
  }, [canManage]);

  async function handleCreatePayment(payment: {
    clientId: string;
    projectId: string;
    paidAt: string;
    amount: string;
    source: string;
    documentUrl: string;
  }) {
    if (!canManage) {
      showNoAccessMessage();
      return;
    }

    if (isCreatingPayment) return;

    try {
      setIsCreatingPayment(true);

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
      resetCreateForm();

      await queryClient.invalidateQueries({
        queryKey: queryKeys.paymentsByWorkspace(workspaceId),
      });

      setActiveTab(isInvoice ? "planned" : "fact");
      setToastType("success");
      setToastMessage(isInvoice ? "Счёт создан" : "Оплата создана");
    } catch (error) {
      console.error("Ошибка создания payment:", error);
      const message =
        error instanceof Error ? error.message : "Не удалось создать";
      setToastType("error");
      setToastMessage(message);
    } finally {
      setIsCreatingPayment(false);
    }
  }

  function handleStartEdit(payment: FactPaymentRow) {
    if (!canManage) {
      showNoAccessMessage();
      return;
    }

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
      payment.paidAt.includes(".") ? toSupabaseDate(payment.paidAt) : payment.paidAt
    );
    setEditAmount(payment.amount);
    setEditSource(payment.source);
    setEditDocumentUrl(payment.documentUrl ?? "");
    setIsEditOpen(true);
  }

  function handleStartEditPlanned(paymentId: string) {
    if (!canManage) {
      showNoAccessMessage();
      return;
    }

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
    if (!canManage) {
      showNoAccessMessage();
      return;
    }

    if (isSavingPayment) return;
    if (!editingPaymentId) return;

    try {
      setIsSavingPayment(true);

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

      setIsEditOpen(false);
      resetEditForm();

      await queryClient.invalidateQueries({
        queryKey: queryKeys.paymentsByWorkspace(workspaceId),
      });

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
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function handleMarkAsPaid(id: string) {
    if (!canManage) {
      showNoAccessMessage();
      return;
    }

    if (processingPaymentId === id) return;

    try {
      setProcessingPaymentId(id);
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

      await queryClient.invalidateQueries({
        queryKey: queryKeys.paymentsByWorkspace(workspaceId),
      });

      setToastType("success");
      setToastMessage(`Счёт для "${target.client}" отмечен как оплаченный`);
    } catch (error) {
      console.error("Ошибка отметки оплаты:", error);
      const message =
        error instanceof Error ? error.message : "Не удалось отметить оплату";
      setToastType("error");
      setToastMessage(message);
    } finally {
      setProcessingPaymentId(null);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!canManage) {
      showNoAccessMessage();
      return;
    }

    if (deletingPaymentId === paymentId) return;

    const target =
      factPayments.find((item) => item.id === paymentId) ||
      plannedPayments.find((item) => item.id === paymentId);

    if (!target) {
      setToastType("error");
      setToastMessage("Оплата не найдена");
      return;
    }

    const confirmed = await confirm({
      title: "Удалить оплату?",
      description: `Оплата для "${target.client}" на сумму ${target.amount} будет удалена. Это действие нельзя отменить.`,
      confirmLabel: "Удалить",
      tone: "danger",
    });

    if (!confirmed) return;

    try {
      setDeletingPaymentId(paymentId);
      await deletePaymentFromSupabase(paymentId);
      if (editingPaymentId === paymentId) {
        setIsEditOpen(false);
        resetEditForm();
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.paymentsByWorkspace(workspaceId),
      });

      setToastType("success");
      setToastMessage(`Оплата для "${target.client}" удалена`);
    } catch (error) {
      console.error("Ошибка удаления payment:", error);
      const message =
        error instanceof Error ? error.message : "Не удалось удалить оплату";
      setToastType("error");
      setToastMessage(message);
    } finally {
      setDeletingPaymentId(null);
    }
  }

  function handleOpenCreateInvoice() {
    if (!canManage) {
      showNoAccessMessage();
      return;
    }

    setMode("invoice");
    setIsCreateOpen(true);
  }

  function handleOpenCreatePayment() {
    if (!canManage) {
      showNoAccessMessage();
      return;
    }

    setMode("invoice");
    setIsCreateOpen(true);
  }

  function handleCloseCreateModal() {
    if (isCreatingPayment) return;
    setIsCreateOpen(false);
    resetCreateForm();
  }

  function handleCloseEditModal() {
    if (isSavingPayment) return;
    setIsEditOpen(false);
    resetEditForm();
  }

  const canShowManageActions = !isPermissionLoading && canManage;

  if (!isAccessLoading && !hasAccess) {
    return (
      <main className="flex-1 px-3 py-3 sm:px-5 sm:py-5 lg:px-7">
        <div className="rivn-page-shell overflow-visible px-4 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
          <div className="relative z-10 space-y-5 lg:space-y-6">
          <AccessDenied
            title="Нет доступа к платежам"
            description="У тебя нет прав для просмотра этого раздела."
          />
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 px-3 py-3 sm:px-5 sm:py-5 lg:px-7">
        <div className="rivn-page-shell px-4 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
          <div className="relative z-10 space-y-5 lg:space-y-6">
          <PaymentsPageHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            canManage={canShowManageActions}
            onCreatePayment={handleOpenCreatePayment}
          />

          <div className="rivn-card p-3.5 sm:p-4">
            <div className="grid gap-3 xl:grid-cols-[1.15fr_repeat(3,minmax(150px,0.5fr))] xl:items-center">
              <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/[0.035] px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    Период
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-white/78">
                    {dateFrom || dateTo
                      ? `${dateFrom ? formatPeriodDate(dateFrom) : "начало"} — ${
                          dateTo ? formatPeriodDate(dateTo) : "конец"
                        }`
                      : "Все платежи"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <RivnDateRangePicker
                    from={dateFrom}
                    to={dateTo}
                    onChange={handleDateRangeChange}
                    placeholder="Выбери период"
                    iconOnly
                  />

                  <div className="hidden grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:grid">
                    {[
                      ["month", "М"],
                      ["7d", "7"],
                      ["30d", "30"],
                      ["all", "∞"],
                    ].map(([preset, label]) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleDatePresetChange(preset as DatePreset)}
                        className={`rounded-xl px-2.5 py-2 text-xs font-medium transition duration-300 active:scale-95 ${
                          datePreset === preset
                            ? "bg-[#00f5a8] text-[#06101d] shadow-[0_14px_34px_rgba(0,245,168,0.18)]"
                            : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {[
                ["Ожидается", plannedTotal, "text-white"],
                ["Просрочено", overdueTotal, "text-rose-300"],
                ["Получено", paidTotal, "text-[#43ffc2]"],
              ].map(([label, value, tone]) => (
                <div
                  key={label}
                  className="rounded-[24px] border border-white/10 bg-white/[0.035] px-4 py-3 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.055]"
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    {label}
                  </div>
                  {loadingPayments ? (
                    <Skeleton className="mt-2 h-7 w-24 rounded-xl" />
                  ) : (
                    <div className={`mt-1 text-xl font-semibold tracking-[-0.04em] ${tone}`}>
                      ₽{Number(value).toLocaleString("ru-RU")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rivn-card p-4 sm:p-5">
            {activeTab === "planned" ? (
              loadingPayments ? (
                <PaymentsTableSkeleton />
              ) : plannedPayments.length > 0 ? (
                <PlannedPaymentsTable
                  items={plannedPayments}
                  onMarkPaid={handleMarkAsPaid}
                  onEdit={handleStartEditPlanned}
                  onDelete={handleDeletePayment}
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  processingPaymentId={processingPaymentId}
                  deletingPaymentId={deletingPaymentId}
                  canManagePayments={canShowManageActions}
                />
              ) : (
                <EmptyState
                  title="Плановых счетов пока нет"
                  description="Когда ты добавишь плановые счета, они появятся здесь."
                  actionLabel={canShowManageActions ? "Добавить оплату" : undefined}
                  onAction={canShowManageActions ? handleOpenCreatePayment : undefined}
                />
              )
            ) : loadingPayments ? (
              <PaymentsTableSkeleton />
            ) : factPayments.length > 0 ? (
              <FactPaymentsTable
                items={factPayments}
                onEdit={handleStartEdit}
                onDelete={handleDeletePayment}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
                deletingPaymentId={deletingPaymentId}
                canManage={canShowManageActions}
              />
            ) : (
              <EmptyState
                title="Оплаченных счетов пока нет"
                description="Добавь первую оплату, чтобы видеть фактически полученные деньги."
                actionLabel={canShowManageActions ? "Добавить оплату" : undefined}
                onAction={canShowManageActions ? handleOpenCreatePayment : undefined}
              />
            )}
          </div>
          </div>
        </div>

        <CreatePaymentModal
          isOpen={isCreateOpen}
          onClose={handleCloseCreateModal}
          onCreate={handleCreatePayment}
          isSubmitting={isCreatingPayment}
          canManage={canShowManageActions}
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
          setMode={setMode}
        />

        <EditPaymentModal
          isOpen={isEditOpen}
          onClose={handleCloseEditModal}
          onSave={handleSaveEdit}
          isSubmitting={isSavingPayment}
          canManage={canShowManageActions}
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

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}
