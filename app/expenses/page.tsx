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
import { formatRub, parseRubAmount } from "../lib/storage";
import {
  getExpensesFromSupabase,
  createExpenseInSupabase,
  updateExpenseInSupabase,
  deleteExpenseFromSupabase,
} from "../lib/supabase/expenses";
import { fetchClientsFromSupabase } from "../lib/supabase/clients";
import type { ExpenseFormData } from "../lib/types/expense";
import { canManageFinance, isAppRole, type AppRole } from "../lib/permissions";
import { useAppContextState } from "../providers/app-context-provider";
import { usePageAccess } from "../lib/use-page-access";

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

  if (value.includes("-")) {
    return value;
  }

  return value;
}

function getClientDisplayName(client: ClientItem) {
  return client.name || client.clientName || client.title || "Клиент";
}

export default function ExpensesPage() {
  const { role } = useAppContextState();
  const { isLoading: isAccessLoading, hasAccess } = usePageAccess("expenses");

  const currentRole: AppRole | null = isAppRole(role) ? role : null;
  const canManageExpenses = currentRole ? canManageFinance(currentRole) : false;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [isCreatingExpense, setIsCreatingExpense] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!hasAccess) return;

    let isMounted = true;

    async function loadPageData() {
      try {
        setLoading(true);

        const [clientsData, expensesData] = await Promise.all([
          fetchClientsFromSupabase(),
          getExpensesFromSupabase(),
        ]);

        if (!isMounted) return;

        const safeClients = (clientsData ?? []) as ClientItem[];
        setClients(safeClients);

        const clientNameMap = new Map(
          safeClients.map((client) => [client.id, getClientDisplayName(client)])
        );

        const mappedExpenses: ExpenseItem[] = expensesData.map((expense) => ({
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

        setExpenses(mappedExpenses);
      } catch (error) {
        console.error("Ошибка загрузки expenses:", error);

        if (!isMounted) return;

        setToastType("error");
        setToastMessage("Не удалось загрузить расходы");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPageData();

    return () => {
      isMounted = false;
    };
  }, [hasAccess]);

  const filteredExpenses = expenses.filter((item) => {
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.client.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = !category || item.category === category;

    return matchesSearch && matchesCategory;
  });

  const totals = useMemo(() => {
    const total = expenses.reduce(
      (sum, item) => sum + parseRubAmount(item.amount),
      0
    );

    const marketing = expenses
      .filter((item) => item.category === "marketing")
      .reduce((sum, item) => sum + parseRubAmount(item.amount), 0);

    const operations = expenses
      .filter((item) => item.category !== "marketing" && item.category !== "tax")
      .reduce((sum, item) => sum + parseRubAmount(item.amount), 0);

    return {
      total: formatRub(total),
      marketing: formatRub(marketing),
      operations: formatRub(operations),
    };
  }, [expenses]);

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

    if (isCreatingExpense) return;

    try {
      setIsCreatingExpense(true);

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

      const createdExpense = await createExpenseInSupabase(payload);

      const mappedExpense: ExpenseItem = {
        id: createdExpense.id,
        title: createdExpense.title,
        category: (createdExpense.category as ExpenseCategory) || "other",
        amount: String(createdExpense.amount),
        date: fromSupabaseDate(createdExpense.expense_date),
        clientId,
        client: getClientNameById(clientId),
      };

      setExpenses((prev) => [mappedExpense, ...prev]);
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
    } finally {
      setIsCreatingExpense(false);
    }
  }

  function handleStartEdit(expense: ExpenseItem) {
    if (!canManageExpenses) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование расходов");
      return;
    }

    if (isSavingExpense) return;

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
    if (isSavingExpense) return;

    try {
      setIsSavingExpense(true);

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

      const savedExpense = await updateExpenseInSupabase(
        editingExpenseId,
        payload
      );

      const mappedExpense: ExpenseItem = {
        id: savedExpense.id,
        title: savedExpense.title,
        category: (savedExpense.category as ExpenseCategory) || "other",
        amount: String(savedExpense.amount),
        date: fromSupabaseDate(savedExpense.expense_date),
        clientId,
        client: getClientNameById(clientId),
      };

      setExpenses((prev) =>
        prev.map((item) => (item.id === editingExpenseId ? mappedExpense : item))
      );

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
    } finally {
      setIsSavingExpense(false);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!canManageExpenses) {
      setToastType("error");
      setToastMessage("У тебя нет прав на удаление расходов");
      return;
    }

    if (deletingExpenseId) return;

    const target = expenses.find((item) => item.id === expenseId);

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
      setDeletingExpenseId(expenseId);

      await deleteExpenseFromSupabase(expenseId);

      setExpenses((prev) => prev.filter((item) => item.id !== expenseId));

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
    } finally {
      setDeletingExpenseId(null);
    }
  }

  function handleOpenCreateModal() {
    if (!canManageExpenses) {
      setToastType("error");
      setToastMessage("У тебя нет прав на создание расходов");
      return;
    }

    if (isCreatingExpense) return;

    setIsCreateOpen(true);
  }

  function handleCloseCreateModal() {
    if (isCreatingExpense) return;
    setIsCreateOpen(false);
  }

  function handleCloseEditModal() {
    if (isSavingExpense) return;
    setIsEditOpen(false);
    resetEditForm();
  }

  if (isAccessLoading) {
    return (
      <main className="flex-1">
        <div className="space-y-6 px-5 py-6 lg:px-8">
          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-8 text-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            Проверяем доступ...
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

          {loading ? (
            <EmptyState
              title="Загрузка расходов..."
              description="Подгружаем данные из Supabase."
            />
          ) : filteredExpenses.length > 0 ? (
            <ExpensesTable
              items={filteredExpenses}
              onEdit={handleStartEdit}
              onDelete={handleDeleteExpense}
              canManageExpenses={canManageExpenses}
            />
          ) : (
            <EmptyState
              title={
                expenses.length === 0
                  ? "Расходов пока нет"
                  : "Расходы не найдены"
              }
              description={
                expenses.length === 0
                  ? "Добавь первый расход, чтобы видеть структуру затрат и управлять прибыльностью."
                  : "Попробуй изменить поиск или выбрать другую категорию."
              }
              actionLabel={
                expenses.length === 0 && canManageExpenses
                  ? "Добавить расход"
                  : undefined
              }
              onAction={
                expenses.length === 0 && canManageExpenses
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
          isSubmitting={isCreatingExpense}
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
          isSubmitting={isSavingExpense}
        />
      </main>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}