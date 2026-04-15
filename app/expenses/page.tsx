"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../components/ui/empty-state";
import { AppToast } from "../components/ui/app-toast";
import { AccessDenied } from "../components/access/access-denied";
import { ExpensesPageHeader } from "../components/expenses/expenses-page-header";
import { ExpensesSummary } from "../components/expenses/expenses-summary";
import { ExpensesTable } from "../components/expenses/expenses-table";
import { CreateExpenseModal } from "../components/expenses/create-expense-modal";
import { EditExpenseModal } from "../components/expenses/edit-expense-modal";
import { Skeleton } from "../components/ui/skeleton";
import { formatRub, parseRubAmount } from "../lib/storage";
import type { ExpenseFormData } from "../lib/types/expense";
import { usePageAccess } from "../lib/use-page-access";
import { useSectionPermission } from "../lib/use-section-permission";
import { useClientsQuery } from "../lib/queries/use-clients-query";
import {
  useCreateExpenseMutation,
  useDeleteExpenseMutation,
  useExpensesQuery,
  useUpdateExpenseMutation,
} from "../lib/queries/use-expenses-query";

type ExpenseCategory =
  | "marketing"
  | "contractor"
  | "service"
  | "tax"
  | "other";

interface ExpenseItem {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: string;
  date: string;
  client: string;
  clientId?: string | null;
}

interface ClientItem {
  id: string;
  name?: string;
  clientName?: string;
  title?: string;
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
  return value;
}

function getClientDisplayName(client: ClientItem) {
  return client.name || client.clientName || client.title || "Клиент";
}

export default function ExpensesPage() {
  const { isLoading: isAccessLoading, hasAccess } = usePageAccess("expenses");
  const {
    isLoading: isPermissionLoading,
    canManage,
  } = useSectionPermission("expenses");

  const canManageExpenses = !isPermissionLoading && canManage;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] =
    useState<ExpenseCategory>("marketing");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newClient, setNewClient] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] =
    useState<ExpenseCategory>("marketing");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editClient, setEditClient] = useState("");

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const {
    data: clients = [],
    isLoading: isClientsLoading,
    error: clientsError,
  } = useClientsQuery(hasAccess);

  const {
    data: expensesData = [],
    isLoading: isExpensesLoading,
    error: expensesError,
  } = useExpensesQuery(hasAccess);

  const createExpenseMutation = useCreateExpenseMutation();
  const updateExpenseMutation = useUpdateExpenseMutation();
  const deleteExpenseMutation = useDeleteExpenseMutation();

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!clientsError) return;

    console.error(clientsError);
    setToastType("error");
    setToastMessage(
      clientsError instanceof Error
        ? clientsError.message
        : "Не удалось загрузить клиентов"
    );
  }, [clientsError]);

  useEffect(() => {
    if (!expensesError) return;

    console.error(expensesError);
    setToastType("error");
    setToastMessage(
      expensesError instanceof Error
        ? expensesError.message
        : "Не удалось загрузить расходы"
    );
  }, [expensesError]);

  useEffect(() => {
    if (canManageExpenses) return;

    setIsCreateOpen(false);
    setIsEditOpen(false);
    setEditingExpenseId(null);
  }, [canManageExpenses]);

  const mappedExpenses = useMemo<ExpenseItem[]>(() => {
    const clientNameMap = new Map(
      clients.map((client) => [client.id, getClientDisplayName(client)])
    );

    return expensesData.map((expense) => ({
      id: expense.id,
      title: expense.title,
      category: (expense.category as ExpenseCategory) || "other",
      amount: String(expense.amount),
      date: fromSupabaseDate(expense.expense_date),
      clientId: expense.client_id ?? "",
      client: expense.client_id
        ? clientNameMap.get(expense.client_id) ?? "Клиент"
        : "",
    }));
  }, [clients, expensesData]);

  const filteredExpenses = useMemo(() => {
    return mappedExpenses.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.client.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = !category || item.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [mappedExpenses, search, category]);

  const totals = useMemo(() => {
    const total = mappedExpenses.reduce(
      (sum, item) => sum + parseRubAmount(item.amount),
      0
    );

    const marketing = mappedExpenses
      .filter((item) => item.category === "marketing")
      .reduce((sum, item) => sum + parseRubAmount(item.amount), 0);

    const operations = mappedExpenses
      .filter((item) => item.category !== "marketing" && item.category !== "tax")
      .reduce((sum, item) => sum + parseRubAmount(item.amount), 0);

    return {
      total: formatRub(total),
      marketing: formatRub(marketing),
      operations: formatRub(operations),
    };
  }, [mappedExpenses]);

  function getClientNameById(id: string) {
    const client = clients.find((c) => c.id === id);
    return client ? getClientDisplayName(client) : "Клиент";
  }

  function resetCreateForm() {
    setNewTitle("");
    setNewCategory("marketing");
    setNewAmount("");
    setNewDate("");
    setNewClient("");
  }

  function resetEditForm() {
    setEditTitle("");
    setEditCategory("marketing");
    setEditAmount("");
    setEditDate("");
    setEditClient("");
    setEditingExpenseId(null);
  }

  async function handleCreateExpense(expense: {
    title: string;
    category: ExpenseCategory;
    amount: string;
    date: string;
    client: string;
  }) {
    if (!canManageExpenses) {
      setToastType("error");
      setToastMessage("У тебя нет прав на создание расходов");
      return;
    }

    try {
      const clientId = expense.client;

      if (!clientId) {
        setToastType("error");
        setToastMessage("Выбери клиента");
        return;
      }

      const payload: ExpenseFormData = {
        title: expense.title,
        category: expense.category,
        amount: parseRubAmount(expense.amount),
        expense_date: toSupabaseDate(expense.date),
        client_id: clientId,
        notes: "",
      };

      await createExpenseMutation.mutateAsync(payload);

      setIsCreateOpen(false);
      resetCreateForm();

      setToastType("success");
      setToastMessage(`Расход "${expense.title}" создан`);
    } catch (error) {
      console.error("Ошибка создания expense:", error);

      const message =
        error instanceof Error ? error.message : "Не удалось создать расход";

      setToastType("error");
      setToastMessage(message);
    }
  }

  function handleStartEdit(expense: ExpenseItem) {
    if (!canManageExpenses) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование расходов");
      return;
    }

    setEditingExpenseId(expense.id);
    setEditTitle(expense.title);
    setEditCategory(expense.category);
    setEditAmount(expense.amount);
    setEditDate(toSupabaseDate(expense.date));
    setEditClient(expense.clientId ?? "");
    setIsEditOpen(true);
  }

  async function handleSaveEdit(updatedExpense: {
    title: string;
    category: ExpenseCategory;
    amount: string;
    date: string;
    client: string;
  }) {
    if (!canManageExpenses) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование расходов");
      return;
    }

    if (!editingExpenseId) return;

    try {
      const clientId = updatedExpense.client;

      if (!clientId) {
        setToastType("error");
        setToastMessage("Выбери клиента");
        return;
      }

      const payload: ExpenseFormData = {
        title: updatedExpense.title,
        category: updatedExpense.category,
        amount: parseRubAmount(updatedExpense.amount),
        expense_date: toSupabaseDate(updatedExpense.date),
        client_id: clientId,
        notes: "",
      };

      await updateExpenseMutation.mutateAsync({
        expenseId: editingExpenseId,
        values: payload,
      });

      setIsEditOpen(false);
      resetEditForm();

      setToastType("success");
      setToastMessage(`Расход "${updatedExpense.title}" сохранён`);
    } catch (error) {
      console.error("Ошибка обновления expense:", error);

      const message =
        error instanceof Error ? error.message : "Не удалось сохранить расход";

      setToastType("error");
      setToastMessage(message);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!canManageExpenses) {
      setToastType("error");
      setToastMessage("У тебя нет прав на удаление расходов");
      return;
    }

    const target = mappedExpenses.find((item) => item.id === expenseId);

    if (!target) {
      setToastType("error");
      setToastMessage("Расход не найден");
      return;
    }

    const confirmed = window.confirm(
      `Удалить расход "${target.title}"? Это действие нельзя отменить.`
    );

    if (!confirmed) return;

    try {
      await deleteExpenseMutation.mutateAsync(expenseId);

      if (editingExpenseId === expenseId) {
        setIsEditOpen(false);
        resetEditForm();
      }

      setToastType("success");
      setToastMessage(`Расход "${target.title}" удалён`);
    } catch (error) {
      console.error("Ошибка удаления expense:", error);
      setToastType("error");
      setToastMessage("Не удалось удалить расход");
    }
  }

  function handleOpenCreateModal() {
    if (!canManageExpenses) {
      setToastType("error");
      setToastMessage("У тебя нет прав на создание расходов");
      return;
    }

    setIsCreateOpen(true);
  }

  function handleCloseCreateModal() {
    if (createExpenseMutation.isPending) return;
    setIsCreateOpen(false);
  }

  function handleCloseEditModal() {
    if (updateExpenseMutation.isPending) return;
    setIsEditOpen(false);
    resetEditForm();
  }

  const showInitialLoading =
    (isAccessLoading && !hasAccess) ||
    ((isClientsLoading || isExpensesLoading) &&
      clients.length === 0 &&
      expensesData.length === 0);

  if (showInitialLoading) {
    return (
      <main className="flex-1">
        <div className="space-y-6 px-5 py-6 lg:px-8">
          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-8 w-40" />
            <Skeleton className="mt-3 h-4 w-80" />

            <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_220px]">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Skeleton className="h-28 rounded-[28px]" />
            <Skeleton className="h-28 rounded-[28px]" />
            <Skeleton className="h-28 rounded-[28px]" />
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            <Skeleton className="h-5 w-32" />

            <div className="mt-5 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="flex-1">
        <div className="space-y-6 px-5 py-6 lg:px-8">
          <AccessDenied
            title="Нет доступа к расходам"
            description="У тебя нет прав для просмотра этого раздела."
          />
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1">
        <div className="space-y-6 px-5 py-6 lg:px-8">
          <ExpensesPageHeader
            search={search}
            setSearch={setSearch}
            category={category}
            setCategory={setCategory}
            onAddExpense={handleOpenCreateModal}
            canAddExpense={canManageExpenses}
          />

          <ExpensesSummary
            total={totals.total}
            marketing={totals.marketing}
            operations={totals.operations}
          />

          {filteredExpenses.length > 0 ? (
            <ExpensesTable
              items={filteredExpenses}
              onEdit={handleStartEdit}
              onDelete={handleDeleteExpense}
              canManageExpenses={canManageExpenses}
              isDeletingExpense={deleteExpenseMutation.isPending}
              deletingExpenseId={deleteExpenseMutation.variables ?? null}
            />
          ) : (
            <EmptyState
              title={
                mappedExpenses.length === 0
                  ? "Расходов пока нет"
                  : "Расходы не найдены"
              }
              description={
                mappedExpenses.length === 0
                  ? "Добавь первый расход, чтобы видеть структуру затрат и управлять прибыльностью."
                  : "Попробуй изменить поиск или выбрать другую категорию."
              }
              actionLabel={
                mappedExpenses.length === 0 && canManageExpenses
                  ? "Добавить расход"
                  : undefined
              }
              onAction={
                mappedExpenses.length === 0 && canManageExpenses
                  ? handleOpenCreateModal
                  : undefined
              }
            />
          )}
        </div>

        <CreateExpenseModal
          isOpen={isCreateOpen}
          onClose={handleCloseCreateModal}
          onCreate={handleCreateExpense}
          title={newTitle}
          setTitle={setNewTitle}
          category={newCategory}
          setCategory={setNewCategory}
          amount={newAmount}
          setAmount={setNewAmount}
          date={newDate}
          setDate={setNewDate}
          client={newClient}
          setClient={setNewClient}
          clients={clients}
          canManageExpenses={canManageExpenses}
          isSubmitting={createExpenseMutation.isPending}
        />

        <EditExpenseModal
          isOpen={isEditOpen}
          onClose={handleCloseEditModal}
          onSave={handleSaveEdit}
          title={editTitle}
          setTitle={setEditTitle}
          category={editCategory}
          setCategory={setEditCategory}
          amount={editAmount}
          setAmount={setEditAmount}
          date={editDate}
          setDate={setEditDate}
          client={editClient}
          setClient={setEditClient}
          clients={clients}
          canManageExpenses={canManageExpenses}
          isSubmitting={updateExpenseMutation.isPending}
        />
      </main>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}