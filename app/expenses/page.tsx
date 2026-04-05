"use client";

import { EmptyState } from "../components/ui/empty-state";
import { AppToast } from "../components/ui/app-toast";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "../components/layout/app-sidebar";
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
import type { Expense, ExpenseFormData } from "../lib/types/expense";

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
    const [year, month, day] = value.split("-");
    if (!day || !month || !year) return value;
    return `${day}.${month}.${year}`;
  }

  return value;
}

function getClientDisplayName(client: ClientItem) {
  return client.name || client.clientName || client.title || "Клиент";
}

export default function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  function mapSupabaseExpenseToUi(expense: Expense): ExpenseItem {
    return {
      id: expense.id,
      title: expense.title,
      category: (expense.category as ExpenseCategory) || "other",
      amount: String(expense.amount),
      date: fromSupabaseDate(expense.expense_date),
      client: expense.client_id ? getClientNameById(expense.client_id) : "",
    };
  }

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
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
  }, []);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch =
        expense.title.toLowerCase().includes(search.toLowerCase()) ||
        expense.client.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        category === "all" ? true : expense.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, category]);

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

      const createdExpense = await createExpenseInSupabase(payload);

      const mappedExpense: ExpenseItem = {
        id: createdExpense.id,
        title: createdExpense.title,
        category: (createdExpense.category as ExpenseCategory) || "other",
        amount: String(createdExpense.amount),
        date: expense.date,
        client: getClientNameById(clientId),
      };

      setExpenses((prev) => [mappedExpense, ...prev]);

      setIsCreateOpen(false);
      setNewTitle("");
      setNewCategory("marketing");
      setNewAmount("");
      setNewDate("");
      setNewClient("");

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
    setEditingExpenseId(expense.id);
    setEditTitle(expense.title);
    setEditCategory(expense.category);
    setEditAmount(expense.amount);
    setEditDate(expense.date);
    setEditClient(expense.client);
    setIsEditOpen(true);
  }

  async function handleSaveEdit(updatedExpense: {
    title: string;
    category: ExpenseCategory;
    amount: string;
    date: string;
    client: string;
  }) {
    if (!editingExpenseId) return;

    try {
      const clientId = findClientIdByName(updatedExpense.client);

      if (!clientId) {
        setToastType("error");
        setToastMessage(
          "Клиент не найден. Выбери или введи имя точно как в разделе Clients."
        );
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
        date: updatedExpense.date,
        client: getClientNameById(clientId),
      };

      setExpenses((prev) =>
        prev.map((item) => (item.id === editingExpenseId ? mappedExpense : item))
      );

      setIsEditOpen(false);
      setEditingExpenseId(null);

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
      await deleteExpenseFromSupabase(expenseId);

      setExpenses((prev) => prev.filter((item) => item.id !== expenseId));

      if (editingExpenseId === expenseId) {
        setIsEditOpen(false);
        setEditingExpenseId(null);
      }

      setToastType("success");
      setToastMessage(`Расход "${target.title}" удалён`);
    } catch (error) {
      console.error("Ошибка удаления expense:", error);
      setToastType("error");
      setToastMessage("Не удалось удалить расход");
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <main className="flex-1">

          <div className="space-y-6 px-5 py-6 lg:px-8">
            <ExpensesPageHeader
              search={search}
              setSearch={setSearch}
              category={category}
              setCategory={setCategory}
              onAddExpense={() => setIsCreateOpen(true)}
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
                actionLabel={expenses.length === 0 ? "Добавить расход" : undefined}
                onAction={
                  expenses.length === 0 ? () => setIsCreateOpen(true) : undefined
                }
              />
            )}
          </div>

          <CreateExpenseModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
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
          />

          <EditExpenseModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
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
          />
        </main>
      </div>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </div>
  );
}